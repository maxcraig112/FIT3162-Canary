// src/Canary/src/AnnotatePage/annotateHandler.ts

import * as fabric from "fabric";
import { getAuthTokenFromCookie } from "../utils/cookieUtils";

export type ImageMeta = {
  imageURL: string;
  imageName: string;
  batchID: string;
};

const cache = new Map<string, ImageMeta[]>();
// Cache Fabric images by their original imageURL (not the dev-proxied URL)
const imageCache = new Map<string, fabric.FabricImage>();
type ToolMode = "kp" | "bb" | "none";
let currentTool: ToolMode = "none";

let currentImageNumber = 1; // 1-based
let totalImageCount = 0;
let canvasRef: fabric.Canvas | null = null;

// Label request eventing to UI
type LabelRequest = {
  kind: ToolMode;
  x: number;
  y: number;
  mode: "create" | "edit";
  currentLabel?: string;
};
const labelRequestSubs = new Set<(req: LabelRequest) => void>();

// Keypoint pending state
let pendingKP: { x: number; y: number; marker?: fabric.Circle } | null = null;

// Bounding box drawing state
let bbActive = false;
let bbPoints: { x: number; y: number; marker?: fabric.Circle }[] = [];
let bbPolyline: fabric.Polyline | null = null;
// Pending finalized polygon awaiting label
let pendingBB: { polygon: fabric.Polygon; points: Array<{ x: number; y: number }> } | null = null;
// Editing selection state
let pendingEdit: { group: fabric.Group; kind: "kp" | "bb" } | null = null;

// Helpers to avoid 'any' casts
function isGroup(obj: unknown): obj is fabric.Group {
  return Boolean(obj && (obj as { type?: string }).type === "group");
}

function getGroupChildren(group: fabric.Group): fabric.Object[] {
  const g = group as unknown as {
    getObjects?: (type?: string) => fabric.Object[];
    _objects?: fabric.Object[];
  };
  if (typeof g.getObjects === "function") {
    return g.getObjects();
  }
  return g._objects ?? [];
}

function devRewriteURL(url: string): string {
  if (
    typeof window !== "undefined" &&
    window.location &&
    /localhost:5173$/.test(window.location.origin)
  ) {
    return url.replace(/^https?:\/\/storage\.googleapis\.com/, "/gcs");
  }
  return url;
}

async function fetchImagesForBatch(batchID: string): Promise<ImageMeta[]> {
  const baseUrl = import.meta.env.VITE_PROJECT_SERVICE_URL;
  const token = getAuthTokenFromCookie();
  const url = `${baseUrl}/batch/${batchID}/images`;

  // get all the image metadata from the firestore database
  const res = await fetch(url, {
    method: "GET",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Failed to fetch images for batch ${batchID}: ${res.status} ${res.statusText} - ${text}`,
    );
  }

  const data = (await res.json()) as ImageMeta[];
  return data;
}

export const annotateHandler = {
  // Tooling API
  setTool(tool: string | null) {
    switch (tool) {
      case "kp":
        currentTool = "kp";
        break;
      case "bb":
        currentTool = "bb";
        break;
      default:
        currentTool = "none";
    }
  },
  subscribeLabelRequests(cb: (req: LabelRequest) => void) {
    labelRequestSubs.add(cb);
    return () => labelRequestSubs.delete(cb);
  },
  confirmLabel(label: string) {
    if (!canvasRef) return;
    // If renaming an existing annotation
    if (pendingEdit && canvasRef) {
      const { group, kind } = pendingEdit;
      const texts = getGroupChildren(group).filter((o) => (o as unknown as { type?: string }).type === "text");
      const textObj = (texts[0] as fabric.Text) || undefined;
      if (textObj) {
        textObj.set({ text: label });
        canvasRef.requestRenderAll();
        console.log(kind === "kp" ? "[KP] Renamed:" : "[BB] Renamed:", { label, group });
      }
      pendingEdit = null;
      return;
    }
    if (currentTool === "kp" && pendingKP) {
      const { x, y, marker } = pendingKP;
      if (!marker) return;
      // Create text and group with marker; lock scaling/rotation and disable controls
      const text = new fabric.Text(label, {
        left: x + 10,
        top: y - 8,
        fill: "#222",
        fontSize: 14,
        backgroundColor: "rgba(255,255,255,0.6)",
        hasControls: false,
        lockScalingX: true,
        lockScalingY: true,
        lockRotation: true,
        selectable: false,
        evented: false,
      });
      canvasRef.remove(marker);
      marker.set({ hasControls: false, lockScalingX: true, lockScalingY: true, lockRotation: true, selectable: false, evented: false });
      const group = new fabric.Group([marker, text], {
        selectable: true,
        hasControls: false,
        lockScalingX: true,
        lockScalingY: true,
        lockRotation: true,
        subTargetCheck: false,
      });
      canvasRef.add(group);
      canvasRef.requestRenderAll();
  console.log("[KP] Created:", { x, y, marker, label });
      // placeholder hook
      this.onKeypointCreated(x, y, label);
      pendingKP = null;
    } else if (currentTool === "bb") {
      // Attach label to the last finalized polygon
      if (pendingBB && canvasRef) {
        const { polygon, points } = pendingBB;
        const centroid = polygonCentroid(points);
        const text = new fabric.Text(label, {
          left: centroid.x + 8,
          top: centroid.y - 8,
          fill: "#222",
          fontSize: 14,
          backgroundColor: "rgba(255,255,255,0.6)",
          hasControls: false,
          lockScalingX: true,
          lockScalingY: true,
          lockRotation: true,
          selectable: false,
          evented: false,
        });
        canvasRef.remove(polygon);
        const group = new fabric.Group([polygon, text], {
          selectable: true,
          hasControls: false,
          lockScalingX: true,
          lockScalingY: true,
          lockRotation: true,
          subTargetCheck: false,
        });
        canvasRef.add(group);
        canvasRef.requestRenderAll();
  console.log("[BB] Labeled:", { points, label });
        // hook
        this.onBoundingBoxCreated(points, label);
        pendingBB = null;
  }
    }
  },
  cancelLabel() {
    // If keypoint pending, remove marker
    if (pendingKP?.marker && canvasRef) {
      canvasRef.remove(pendingKP.marker);
      canvasRef.requestRenderAll();
    }
    pendingKP = null;
    // If editing existing, just clear edit mode
    if (pendingEdit) {
      pendingEdit = null;
    }
    // If a finalized polygon is awaiting label, remove it
    if (pendingBB && canvasRef) {
      canvasRef.remove(pendingBB.polygon);
      pendingBB = null;
      canvasRef.requestRenderAll();
    }
    // If cancelling during bbox creation, clear temp state
    if (currentTool === "bb" && bbActive && canvasRef) {
      if (bbPolyline) {
        canvasRef.remove(bbPolyline);
        bbPolyline = null;
      }
  bbPoints.forEach((p) => p.marker && canvasRef!.remove(p.marker));
      bbPoints = [];
  // no label pending in end-label flow
      bbActive = false;
      canvasRef.requestRenderAll();
    }
  },

  // Canvas lifecycle
  createCanvas(el: HTMLCanvasElement): fabric.Canvas {
    if (canvasRef) {
      canvasRef.dispose();
      canvasRef = null;
    }
    canvasRef = new fabric.Canvas(el);
    // install mouse handler
    canvasRef.on("mouse:down", (opt) => {
      const evt = opt.e as MouseEvent;
      const p = canvasRef!.getPointer(evt);
  const target = (opt as unknown as { target?: fabric.Object }).target;

      // If clicking on an existing annotation, open rename overlay and do not create a new one
      if (target && isGroup(target)) {
        const group = target as fabric.Group;
        if (group) {
          // Determine kind by children
          const children = getGroupChildren(group);
          const hasPolygon = children.some((o) => (o as unknown as { type?: string }).type === "polygon");
          const kind: "kp" | "bb" = hasPolygon ? "bb" : "kp";
          const textObj = children.find((o) => (o as unknown as { type?: string }).type === "text") as fabric.Text | undefined;
          const currentLabel = textObj?.text ?? "";
          pendingEdit = { group, kind };
          labelRequestSubs.forEach((cb) => cb({ kind, x: p.x, y: p.y, mode: "edit", currentLabel }));
          return;
        }
      }
      if (currentTool === "kp") {
        // add a small marker and request a label
        const c = new fabric.Circle({
          left: p.x,
          top: p.y,
          radius: 4,
          fill: "#ff1744",
          originX: "center",
          originY: "center",
          hasControls: false,
          lockScalingX: true,
          lockScalingY: true,
          lockRotation: true,
          selectable: false,
          evented: false,
        });
        canvasRef!.add(c);
        canvasRef!.requestRenderAll();
        pendingKP = { x: p.x, y: p.y, marker: c };
        console.log("[KP] Marker created:", { x: p.x, y: p.y, marker: c });
        // ask UI for label to the right
        labelRequestSubs.forEach((cb) => cb({ kind: "kp", x: p.x, y: p.y, mode: "create", currentLabel: "" }));
      } else if (currentTool === "bb") {
        handleBoundingBoxClick(p.x, p.y);
      }
    });
    return canvasRef;
  },
  deleteSelected() {
    if (!canvasRef) return;
    if (pendingEdit) {
      canvasRef.remove(pendingEdit.group);
      pendingEdit = null;
      canvasRef.requestRenderAll();
      return;
    }
    if (pendingBB) {
      canvasRef.remove(pendingBB.polygon);
      pendingBB = null;
      canvasRef.requestRenderAll();
    }
  },
  disposeCanvas() {
    canvasRef?.dispose();
    canvasRef = null;
  },

  /** Optionally allow UI to set the current image number (1-based). */
  setCurrentImageNumber(n: number) {
    currentImageNumber = Math.max(1, Math.floor(n));
  },

  nextImage(setCurrentImage: React.Dispatch<React.SetStateAction<number>>) {
    if (totalImageCount <= 0) return currentImageNumber;
    currentImageNumber =
      currentImageNumber < totalImageCount ? currentImageNumber + 1 : 1;
    setCurrentImage(currentImageNumber);
  },

  prevImage(setCurrentImage: React.Dispatch<React.SetStateAction<number>>) {
    if (totalImageCount <= 0) return currentImageNumber;
    currentImageNumber =
      currentImageNumber > 1 ? currentImageNumber - 1 : totalImageCount;
    setCurrentImage(currentImageNumber);
  },

  /**
   * Loads and returns the image URL for the given batch and current image index.
   * Also updates internal totalImageCount and currentImageNumber.
   * Note: This returns the canonical imageURL. Fabric image instances are cached separately.
   */
  async loadImageURL(
    batchID: string,
    imageNumber: number,
  ): Promise<{ imageURL: string; total: number }> {
    if (!batchID) throw new Error("batchID is required");

    let images = cache.get(batchID);
    if (!images) {
      images = await fetchImagesForBatch(batchID);
      cache.set(batchID, images);
    }

    totalImageCount = images.length;
    if (totalImageCount === 0) {
      throw new Error("No images found for this batch");
    }

    const imageMetadata = images[imageNumber - 1];
    if (!imageMetadata || !imageMetadata.imageURL) {
      throw new Error("Invalid image metadata or imageURL not found");
    }
    return { imageURL: imageMetadata.imageURL, total: totalImageCount };
  },

  /**
   * Render the current image to the Fabric canvas, centered and scaled.
   * Uses an in-memory cache of FabricImage instances to avoid re-downloading.
   */
  async renderToCanvas(
    batchID: string,
  ): Promise<{ current: number; total: number }> {
    if (!canvasRef) throw new Error("Canvas not initialized");

    const { imageURL, total } = await this.loadImageURL(
      batchID,
      currentImageNumber,
    );

    // Try in-memory cache first
    let img = imageCache.get(imageURL);
    if (!img) {
      // this is used to get around CORS issues when developing locally
      const url = devRewriteURL(imageURL);
      img = await fabric.FabricImage.fromURL(url, { crossOrigin: "anonymous" });
      imageCache.set(imageURL, img);
    }

    const cw = canvasRef.getWidth();
    const ch = canvasRef.getHeight();
    if (!cw || !ch) return { current: currentImageNumber, total };

    const iw = img.width ?? 1;
    const ih = img.height ?? 1;
    const scale = Math.min(cw / iw, ch / ih);
    img.scale(scale);
    img.set({
      originX: "center",
      originY: "center",
      left: cw / 2,
      top: ch / 2,
    });

    canvasRef.backgroundImage = img;
    canvasRef.requestRenderAll();

    return { current: currentImageNumber, total };
  },

  // Placeholder hooks for future integration
  onKeypointCreated(x: number, y: number, label: string) {
  // TODO: implement persistence/WS message
  void x; void y; void label;
  },
  onBoundingBoxCreated(points: Array<{ x: number; y: number }>, label: string) {
  // TODO: implement persistence/WS message
  void points; void label;
  },
};

// Bounding box helpers
function handleBoundingBoxClick(x: number, y: number) {
  if (!canvasRef) return;

  if (!bbActive) {
    // start new bbox
    bbActive = true;
    bbPoints = [];
    if (bbPolyline) {
      canvasRef.remove(bbPolyline);
      bbPolyline = null;
    }
  // defer label request until polygon is finalized
  }

  // If user is closing the polygon (click near first point) do that BEFORE adding a new marker
  if (bbPoints.length >= 3) {
    const first = bbPoints[0];
    const dx = x - first.x;
    const dy = y - first.y;
    const dist2 = dx * dx + dy * dy;
    if (dist2 <= 144) { // within 12px
      finalizeBoundingBox();
      return;
    }
  }

  // add point and marker
  const marker = new fabric.Circle({ left: x, top: y, radius: 3, fill: "#2979ff", originX: "center", originY: "center", hasControls: false, lockScalingX: true, lockScalingY: true, lockRotation: true, selectable: false, evented: false });
  canvasRef.add(marker);
  bbPoints.push({ x, y, marker });
  console.log("[BB] Point added:", { x, y, marker });

  // update polyline path
  const pts = bbPoints.map((p) => ({ x: p.x, y: p.y }));
  if (!bbPolyline) {
    bbPolyline = new fabric.Polyline(pts, {
      stroke: "#2979ff",
      strokeWidth: 2,
      fill: "",
      selectable: false,
      evented: false,
    });
    canvasRef.add(bbPolyline);
  } else {
    bbPolyline.set({ points: pts });
  }
  canvasRef.requestRenderAll();

  // Close detection handled before marker creation above
}

function finalizeBoundingBox() {
  if (!canvasRef || !bbActive || bbPoints.length < 3) return;
  const pts = bbPoints.map((p) => ({ x: p.x, y: p.y }));
  // remove temp polyline and markers
  if (bbPolyline) {
    canvasRef.remove(bbPolyline);
    bbPolyline = null;
  }
  bbPoints.forEach((p) => p.marker && canvasRef!.remove(p.marker));
  // defensive cleanup for any stray BB markers (blue circles with radius 3)
  const circles = canvasRef.getObjects("circle") as fabric.Circle[];
  circles.forEach((obj) => {
    const radius = (obj as unknown as { radius?: number }).radius ?? 0;
    const fill = (obj as unknown as { fill?: string }).fill ?? "";
    const hasGroup = Boolean((obj as unknown as { group?: unknown }).group);
    if (fill === "#2979ff" && Math.abs(radius - 3) < 0.001 && !hasGroup) {
      canvasRef!.remove(obj);
    }
  });

  const poly = new fabric.Polygon(pts, {
    fill: "rgba(41,121,255,0.15)",
    stroke: "#2979ff",
    strokeWidth: 2,
    objectCaching: false,
    selectable: true,
    hasControls: false,
    lockScalingX: true,
    lockScalingY: true,
    lockRotation: true,
  });
  canvasRef.add(poly);
  console.log("[BB] Polygon created:", { points: pts, marker: poly });
  // Ask for label at the end (near centroid)
  pendingBB = { polygon: poly, points: pts };
  const centroid = polygonCentroid(pts);
  labelRequestSubs.forEach((cb) => cb({ kind: "bb", x: centroid.x, y: centroid.y, mode: "create", currentLabel: "" }));
  canvasRef.requestRenderAll();

  // reset drawing state; labeling handled by confirmLabel
  bbActive = false;
  bbPoints = [];
  // no label pending in end-label flow
}

function polygonCentroid(pts: Array<{ x: number; y: number }>) {
  let area = 0, cx = 0, cy = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const p1 = pts[j], p2 = pts[i];
    const f = p1.x * p2.y - p2.x * p1.y;
    area += f;
    cx += (p1.x + p2.x) * f;
    cy += (p1.y + p2.y) * f;
  }
  area *= 0.5;
  if (area === 0) return { x: pts[0].x, y: pts[0].y };
  return { x: cx / (6 * area), y: cy / (6 * area) };
}
