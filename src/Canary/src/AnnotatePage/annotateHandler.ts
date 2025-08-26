// src/Canary/src/AnnotatePage/annotateHandler.ts

import * as fabric from 'fabric';
import type { LabelRequest } from './constants';
import { fabricBBColour } from './constants';
import type { KeypointAnnotation, BoundingBoxAnnotation } from './constants';
import { keypointHandler } from './keypointHandler.ts';
import { boundingBoxHandler, polygonCentroid } from './boundingBoxHandler.ts';
import { loadProjectLabels } from './labelLoader.ts';
import { loadImageURL, nextImage, prevImage, setCurrentImageNumber, getCurrentImageNumber, getTotalImageCount, getFabricImage } from './imageStateHandler.ts';

// Fabric image instances come from imageStateHandler now

type ToolMode = 'kp' | 'bb' | 'none';
let currentTool: ToolMode = 'none';

let currentImageNumber = 1; // 1-based (mirrors imageStateHandler)
let canvasRef: fabric.Canvas | null = null;

let currentImageID: string | null = null;

const labelRequestSubs = new Set<(req: LabelRequest) => void>();

// In-memory per-image annotation store
type ImageAnnotations = {
  kps: KeypointAnnotation[];
  bbs: BoundingBoxAnnotation[];
};
const annotationStore = new Map<string, ImageAnnotations>();
let currentImageKey: string | null = null; // canonical imageURL

// Map Fabric groups to backing annotation
const groupToAnnotation = new WeakMap<fabric.Group, { kind: 'kp' | 'bb'; ann: KeypointAnnotation | BoundingBoxAnnotation }>();

// Keypoint pending state
let pendingKP: { x: number; y: number; marker?: fabric.Circle } | null = null;

// Bounding box drawing state
let bbActive = false;
let bbPoints: { x: number; y: number; marker?: fabric.Circle }[] = [];
let bbPolyline: fabric.Polyline | null = null; // kept for compatibility, unused in rect flow
// Pending finalized polygon awaiting label
let pendingBB: {
  polygon: fabric.Polygon;
  points: Array<{ x: number; y: number }>;
} | null = null;
// Editing selection state
let pendingEdit: { group: fabric.Group; kind: 'kp' | 'bb' } | null = null;

// Helpers to avoid 'any' casts
function isGroup(obj: unknown): obj is fabric.Group {
  return Boolean(obj && (obj as { type?: string }).type === 'group');
}

function getGroupChildren(group: fabric.Group): fabric.Object[] {
  const g = group as unknown as {
    getObjects?: (type?: string) => fabric.Object[];
    _objects?: fabric.Object[];
  };
  if (typeof g.getObjects === 'function') {
    return g.getObjects();
  }
  return g._objects ?? [];
}

// devRewriteURL is handled in imageStateHandler

export const annotateHandler = {
  /** Optionally allow UI to set the current image number (1-based). */
  setCurrentImageNumber(n: number) {
    setCurrentImageNumber(n);
    currentImageNumber = getCurrentImageNumber();
  },

  nextImage(setCurrentImage: React.Dispatch<React.SetStateAction<number>>) {
    nextImage(setCurrentImage);
    currentImageNumber = getCurrentImageNumber();
  },

  prevImage(setCurrentImage: React.Dispatch<React.SetStateAction<number>>) {
    prevImage(setCurrentImage);
    currentImageNumber = getCurrentImageNumber();
  },

  setTool(tool: string | null) {
    switch (tool) {
      case 'kp':
        currentTool = 'kp';
        break;
      case 'bb':
        currentTool = 'bb';
        break;
      default:
        currentTool = 'none';
    }
  },

  getKeypoints(): KeypointAnnotation[] {
    if (!currentImageKey) return [];
    const s = annotationStore.get(currentImageKey);
    return s ? s.kps : [];
  },

  getBoundingBoxes(): BoundingBoxAnnotation[] {
    if (!currentImageKey) return [];
    const s = annotationStore.get(currentImageKey);
    return s ? s.bbs : [];
  },

  subscribeLabelRequests(cb: (req: LabelRequest) => void) {
    labelRequestSubs.add(cb);
    return () => labelRequestSubs.delete(cb);
  },

  // When you press OK to confirm the name of a label
  async confirmLabel(label: string, projectID?: string) {
    if (!canvasRef) return;
    // If renaming an existing annotation
    if (pendingEdit) {
      const { group, kind } = pendingEdit;
      const texts = getGroupChildren(group).filter((o) => (o as unknown as { type?: string }).type === 'text');
      const textObj = (texts[0] as fabric.Text) || undefined;
      if (textObj) {
        textObj.set({ text: label });
        // Update backing store
        const meta = groupToAnnotation.get(group);
        if (meta) {
          (meta.ann as KeypointAnnotation | BoundingBoxAnnotation).label = label;

          if (kind === 'kp') {
            console.log('[KP] Renamed:', { label, group });
            void keypointHandler.renameKeyPoint(meta.ann as KeypointAnnotation, label);
          } else {
            console.log('[BB] Renamed:', { label, group });
            void boundingBoxHandler.renameBoundingBox(meta.ann as BoundingBoxAnnotation, label);
          }
        }
        canvasRef.requestRenderAll();
      }
      pendingEdit = null;
      return;
    }

    // New keypoint
    if (currentTool === 'kp' && pendingKP) {
      if (!currentImageKey) return; // no active image

      const { x, y, marker } = pendingKP;
      if (!marker) return;

      canvasRef.remove(marker);

      const { group, annotation: ann } = await keypointHandler.finalizeCreate(marker, x, y, label, projectID, currentImageID ?? undefined);

      canvasRef.add(group);
      canvasRef.requestRenderAll();

      const s = annotationStore.get(currentImageKey) ?? { kps: [], bbs: [] };

      s.kps.push(ann);

      annotationStore.set(currentImageKey, s);
      groupToAnnotation.set(group, { kind: 'kp', ann });

      console.log('[KP] Created:', { x, y, label, ann });
      pendingKP = null;
      return;
    }

    // Label a newly created rectangle
    if (currentTool === 'bb' && pendingBB) {
      if (!currentImageKey) return;

      const { polygon, points } = pendingBB;

      canvasRef.remove(polygon);

      const { group, annotation } = boundingBoxHandler.finalizeCreate(polygon, points, label, projectID, currentImageID ?? undefined);

      canvasRef.add(group);
      canvasRef.requestRenderAll();

      const ann: BoundingBoxAnnotation = annotation;

      const s = annotationStore.get(currentImageKey) ?? { kps: [], bbs: [] };

      s.bbs.push(ann);

      annotationStore.set(currentImageKey, s);
      groupToAnnotation.set(group, { kind: 'bb', ann });

      console.log('[BB] Labeled:', { points, label, ann });
      pendingBB = null;
      return;
    }
  },

  // If the cancel button is clicked
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
    if (currentTool === 'bb' && bbActive && canvasRef) {
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
    canvasRef.on('mouse:down', (opt) => {
      const evt = opt.e as MouseEvent;
      const p = canvasRef!.getScenePoint(evt);
      const target = (opt as unknown as { target?: fabric.Object }).target;

      // If clicking on an existing annotation, open rename overlay and do not create a new one
      if (target && isGroup(target)) {
        const group = target as fabric.Group;
        if (group) {
          // Prefer stored mapping; fall back to child shape detection
          const mapped = groupToAnnotation.get(group);
          const children = getGroupChildren(group);
          const hasPolygon = children.some((o) => (o as unknown as { type?: string }).type === 'polygon');
          const kind: 'kp' | 'bb' = mapped?.kind ?? (hasPolygon ? 'bb' : 'kp');
          const textObj = children.find((o) => (o as unknown as { type?: string }).type === 'text') as fabric.Text | undefined;
          const currentLabel = textObj?.text ?? '';
          pendingEdit = { group, kind };
          labelRequestSubs.forEach((cb) => cb({ kind, x: p.x, y: p.y, mode: 'edit', currentLabel }));
          return;
        }
      }
      if (currentTool === 'kp') {
        // add a small marker and request a label
        const c = keypointHandler.createPendingMarker(p.x, p.y);
        canvasRef!.add(c);
        canvasRef!.requestRenderAll();
        pendingKP = { x: p.x, y: p.y, marker: c };
        console.log('[KP] Marker created:', { x: p.x, y: p.y, marker: c });
        // ask UI for label to the right
        labelRequestSubs.forEach((cb) => cb({ kind: 'kp', x: p.x, y: p.y, mode: 'create', currentLabel: '' }));
      } else if (currentTool === 'bb') {
        handleBoundingBoxClick(p.x, p.y);
      }
    });
    return canvasRef;
  },
  deleteSelected() {
    if (!canvasRef) return;
    if (pendingEdit) {
      const g = pendingEdit.group;
      const meta = groupToAnnotation.get(g);
      if (meta && currentImageKey) {
        const s = annotationStore.get(currentImageKey);
        if (s) {
          if (meta.kind === 'kp') {
            const idx = s.kps.indexOf(meta.ann as KeypointAnnotation);
            if (idx >= 0) s.kps.splice(idx, 1);
            // backend delete
            void keypointHandler.deleteKeyPoint(meta.ann as KeypointAnnotation);
          } else {
            const idx = s.bbs.indexOf(meta.ann as BoundingBoxAnnotation);
            if (idx >= 0) s.bbs.splice(idx, 1);
            // placeholder for future bbox delete API
            void boundingBoxHandler.deleteBoundingBox(meta.ann as BoundingBoxAnnotation);
          }
        }
        groupToAnnotation.delete(g);
      }
      canvasRef.remove(g);
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

  /**
   * Render the current image to the Fabric canvas, centered and scaled.
   * Uses an in-memory cache of FabricImage instances to avoid re-downloading.
   */
  async renderToCanvas(batchID: string, projectID?: string): Promise<{ current: number; total: number }> {
    if (!canvasRef) throw new Error('Canvas not initialized');

    const { imageURL, imageID } = await loadImageURL(batchID, currentImageNumber);
    // Update current image key
    currentImageKey = imageURL;
    currentImageID = imageID ?? null;

  // Ensure labels are loaded for this project before rendering annotations
  await loadProjectLabels(projectID);

    // Clear existing annotation groups before drawing the new image
    clearAnnotationGroups();

  // On first load for this image, fetch existing keypoints from backend
    if (currentImageKey && (!annotationStore.has(currentImageKey) || (annotationStore.get(currentImageKey)?.kps.length ?? 0) === 0)) {
      try {
        const kps = await keypointHandler.getAllKeyPoints(projectID, currentImageID ?? undefined);
        const s = annotationStore.get(currentImageKey) ?? { kps: [], bbs: [] };
        for (const kp of kps) {
          // Ensure IDs are set for downstream rename/delete
          kp.projectID = kp.projectID ?? projectID;
          kp.imageID = kp.imageID ?? currentImageID ?? undefined;
          s.kps.push(kp);
        }
        annotationStore.set(currentImageKey, s);
      } catch (e) {
        console.error('[KP] Failed to fetch existing keypoints:', e);
      }
    }

  // TODO: optionally load bounding boxes to display if backend has any

    // Try in-memory cache first
    const img = await getFabricImage(imageURL);

    const cw = canvasRef.getWidth();
    const ch = canvasRef.getHeight();
    const total = getTotalImageCount();
    if (!cw || !ch) return { current: currentImageNumber, total };

    const iw = img.width ?? 1;
    const ih = img.height ?? 1;
    const scale = Math.min(cw / iw, ch / ih);
    img.scale(scale);
    img.set({
      originX: 'center',
      originY: 'center',
      left: cw / 2,
      top: ch / 2,
    });

    canvasRef.backgroundImage = img;
    // After background is set, draw annotations for this image (if any)
    drawAnnotationsForCurrentImage();
    canvasRef.requestRenderAll();

    return { current: currentImageNumber, total };
  },
};

function handleBoundingBoxClick(x: number, y: number) {
  if (!canvasRef) return;
  if (!currentImageKey) return;

  // Start a new bbox if not active
  if (!bbActive) {
    bbActive = true;
    bbPoints = [];
    if (bbPolyline) {
      canvasRef.remove(bbPolyline);
      bbPolyline = null;
    }
  }

  // Add marker for this click
  const marker = boundingBoxHandler.createPointMarker(x, y);
  canvasRef.add(marker);
  bbPoints.push({ x, y, marker });
  console.log('[BB] Point added:', { x, y, marker });

  // When we have 2 points, create a normalized rectangle polygon
  if (bbPoints.length === 2) {
    const p1 = bbPoints[0];
    const p2 = bbPoints[1];
    const minX = Math.min(p1.x, p2.x);
    const maxX = Math.max(p1.x, p2.x);
    const minY = Math.min(p1.y, p2.y);
    const maxY = Math.max(p1.y, p2.y);

    const rectPts = [
      { x: minX, y: minY }, // top-left
      { x: maxX, y: minY }, // top-right
      { x: maxX, y: maxY }, // bottom-right
      { x: minX, y: maxY }, // bottom-left
    ];

    // Remove temp markers
    bbPoints.forEach((pt) => pt.marker && canvasRef!.remove(pt.marker));
    // Defensive cleanup: remove any stray blue small circles not in a group
    const circles = canvasRef.getObjects('circle') as fabric.Circle[];
    circles.forEach((obj) => {
      const radius = (obj as unknown as { radius?: number }).radius ?? 0;
      const fill = (obj as unknown as { fill?: string }).fill ?? '';
      const hasGroup = Boolean((obj as unknown as { group?: unknown }).group);
      if (fill === fabricBBColour && Math.abs(radius - 3) < 0.001 && !hasGroup) {
        canvasRef!.remove(obj);
      }
    });

    // Create a polygon representing the rectangle (so downstream logic works the same)
    const { polygon: poly } = boundingBoxHandler.polygonFromTwoPoints({ x: p1.x, y: p1.y }, { x: p2.x, y: p2.y });
    canvasRef.add(poly);
    console.log('[BB] Rectangle created (corrected to axis-aligned):', {
      from: [p1, p2],
      normalized: rectPts,
    });

    // Ask for label near centroid and set pending state
    pendingBB = { polygon: poly, points: rectPts };
    const c = polygonCentroid(rectPts);
    labelRequestSubs.forEach((cb) => cb({ kind: 'bb', x: c.x, y: c.y, mode: 'create', currentLabel: '' }));
    canvasRef.requestRenderAll();

    // Reset drawing state
    bbActive = false;
    bbPoints = [];
  } else {
    canvasRef.requestRenderAll();
  }
}

// Remove all existing non-background annotation visuals from the canvas
function clearAnnotationGroups() {
  if (!canvasRef) return;
  const objs = canvasRef.getObjects();
  // Keep only background image; remove groups and any stray circles/lines
  const toRemove = objs.filter((o) => (o as unknown as { type?: string }).type !== 'image');
  toRemove.forEach((o) => canvasRef!.remove(o));
}

// Redraw annotations for the current image key
function drawAnnotationsForCurrentImage() {
  if (!canvasRef || !currentImageKey) return;
  const s = annotationStore.get(currentImageKey);
  if (!s) return;

  // Draw keypoints
  for (const ann of s.kps) {
    const { group } = keypointHandler.renderAnnotation(ann);
    groupToAnnotation.set(group, { kind: 'kp', ann });
    canvasRef.add(group);
  }

  // Draw bounding boxes
  for (const ann of s.bbs) {
    const { group } = boundingBoxHandler.renderAnnotation(ann);
    groupToAnnotation.set(group, { kind: 'bb', ann });
    canvasRef.add(group);
  }
}
