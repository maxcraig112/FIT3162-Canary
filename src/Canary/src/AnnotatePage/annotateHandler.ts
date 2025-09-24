// src/Canary/src/AnnotatePage/annotateHandler.ts

import * as fabric from 'fabric';
import type { LabelRequest } from './constants';
import { createBoundingBoxAnnotation, createKeypointAnnotation, fabricBBColour } from './constants';
import type { KeypointAnnotation, BoundingBoxAnnotation } from './constants';
import { KeyPointFabricHandler, keypointDatabaseHandler } from './keypointHandler.ts';
import { boundingBoxDatabaseHandler, BoundingBoxFabricHandler } from './boundingBoxHandler.ts';
import { loadProjectLabels } from './labelLoader.ts';
import { polygonCentroid, polygonFromTwoPoints } from './helper.ts';
import { type ImageHandler } from './imageStateHandler.ts';
import { getBoundingBoxLabelIdByName, getBoundingBoxLabelName, getKeypointLabelIdByName, getKeypointLabelName } from './labelRegistry.ts';
import { UndoRedoHandler } from './undoRedoHandler.ts';

type ToolMode = 'kp' | 'bb' | 'none';
let currentTool: ToolMode = 'none';

let canvasRef: fabric.Canvas;
// Store a reference to the current ImageHandler instance provided by the React component
let imageHandlerRef: ImageHandler | null = null;

// Current transform from image space -> canvas space
let currentScale = 1;
let currentOffsetX = 0;
let currentOffsetY = 0;
let currentImageW = 0;
let currentImageH = 0;

function canvasToImage(p: { x: number; y: number }): { x: number; y: number } {
  return { x: (p.x - currentOffsetX) / currentScale, y: (p.y - currentOffsetY) / currentScale };
}

function isPointWithinImageCanvas(x: number, y: number): boolean {
  if (!canvasRef) return false;
  if (currentScale <= 0 || currentImageW <= 0 || currentImageH <= 0) return false;
  const left = currentOffsetX;
  const top = currentOffsetY;
  const right = left + currentImageW * currentScale;
  const bottom = top + currentImageH * currentScale;
  return x >= left && x <= right && y >= top && y <= bottom;
}

const labelRequestSubs = new Set<(req: LabelRequest) => void>();

// Map Fabric groups to backing annotation
const groupToAnnotation = new WeakMap<fabric.Group, { kind: 'kp' | 'bb'; ann: KeypointAnnotation | BoundingBoxAnnotation }>();
const undoRedoHandler = new UndoRedoHandler();

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

// Expose canvas for zoom handler
export function getCanvas(): fabric.Canvas | null {
  return canvasRef;
}

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

export const annotateHandler = {
  // Inject the ImageHandler instance from the component (must be called once on mount)
  setImageHandler(instance: ImageHandler) {
    imageHandlerRef = instance;
  },
  setTool(tool: string) {
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

  subscribeLabelRequests(cb: (req: LabelRequest) => void) {
    labelRequestSubs.add(cb);
    return () => labelRequestSubs.delete(cb);
  },

  // When you press OK to confirm the name of a label
  async confirmLabel(label: string, projectID: string) {
    const imageHandler = imageHandlerRef;
    if (!imageHandler) throw new Error('Image handler not set');
    // const imageHandler = getImageHandlerInstance();
    if (!canvasRef) return;

    if (pendingEdit) {
      const { group, kind } = pendingEdit;
      const meta = groupToAnnotation.get(group);
      if (!meta) return;

      if (kind == 'kp') {
        const ann = meta.ann as KeypointAnnotation;
        keypointDatabaseHandler.renameKeyPoint(ann, getKeypointLabelIdByName(label)).then((updatedAnn) => {
          KeyPointFabricHandler.renameFabricKeyPoint(canvasRef, group, label);
          console.log(`Keypoint ${ann.id} renamed to label ${label}`);
          undoRedoHandler.editAction('kp', ann, updatedAnn, group);
        });
      } else if (kind == 'bb') {
        const ann = meta.ann as BoundingBoxAnnotation;
        boundingBoxDatabaseHandler.renameBoundingBox(ann, getBoundingBoxLabelIdByName(label)).then((updatedAnn) => {
          BoundingBoxFabricHandler.renameFabricBoundingBox(canvasRef, group, label);
          console.log(`Bounding box ${ann.id} renamed to label ${label}`);
          undoRedoHandler.editAction('bb', ann, updatedAnn, group);
        });
      }
      pendingEdit = null;
    } else {
      const imageID = imageHandler.currentImageID;
      if (!imageID) return;

      if (currentTool === 'kp' && pendingKP) {
        const { x, y, marker } = pendingKP;
        if (!marker) return;

        // Convert canvas click position to image-space before saving
        const imgPt = canvasToImage({ x, y });
        const ann = createKeypointAnnotation({
          id: '',
          position: { x: imgPt.x, y: imgPt.y },
          labelID: getKeypointLabelIdByName(label),
          projectID: projectID,
          imageID: imageID,
        });

        keypointDatabaseHandler.createdKeyPoint(ann).then((createdAnn) => {
          const { group }: { group: fabric.Group } = KeyPointFabricHandler.createFabricKeyPoint(canvasRef, createdAnn, {
            scale: currentScale,
            offsetX: currentOffsetX,
            offsetY: currentOffsetY,
          });
          groupToAnnotation.set(group, { kind: 'kp', ann: createdAnn });
          const s = imageHandler.annotationStore.get(imageHandler.currentImageURL) ?? { kps: [], bbs: [] };
          s.kps.push(createdAnn);
          imageHandler.annotationStore.set(imageHandler.currentImageURL, s);
          undoRedoHandler.addAction('kp', createdAnn, group);
        });
        console.log('[KP] Keypoint created:', { x, y, marker, ann });
        removePendingMarkers();
      }

      if (currentTool === 'bb' && pendingBB) {
        const { polygon, points } = pendingBB;

        // Convert pending canvas points to image-space before saving
        const imgPts = points.map((p) => canvasToImage(p));
        const ann = createBoundingBoxAnnotation({
          id: '',
          points: imgPts,
          labelID: getBoundingBoxLabelIdByName(label),
          projectID: projectID,
          imageID: imageID,
        });

        boundingBoxDatabaseHandler.createBoundingBox(ann).then((createdAnn) => {
          const { group }: { group: fabric.Group } = BoundingBoxFabricHandler.createFabricBoundingBox(canvasRef, createdAnn, {
            scale: currentScale,
            offsetX: currentOffsetX,
            offsetY: currentOffsetY,
          });
          groupToAnnotation.set(group, { kind: 'bb', ann: createdAnn });
          const s = imageHandler.annotationStore.get(imageHandler.currentImageURL) ?? { kps: [], bbs: [] };
          s.bbs.push(createdAnn);
          imageHandler.annotationStore.set(imageHandler.currentImageURL, s);
          undoRedoHandler.addAction('bb', createdAnn, group);
        });
        console.log('[BB] Bounding box created:', { points, polygon, ann });
        removePendingMarkers();
      }
    }
  },

  // If the cancel button is clicked
  cancelLabel() {
    if (currentTool == 'kp' && pendingKP) {
      if (pendingKP.marker) {
        canvasRef.remove(pendingKP.marker);
      }
      pendingKP = null;
      console.log('[KP] Keypoint creation cancelled:', pendingKP);
    } else if (currentTool === 'bb' && pendingBB) {
      if (pendingBB.polygon) {
        canvasRef.remove(pendingBB.polygon);
      }
      pendingBB = null;
      console.log('[BB] Bounding box creation cancelled:', pendingBB);
    } else if (pendingEdit) {
      pendingEdit = null;
    }
  },

  // Canvas lifecycle
  createCanvas(el: HTMLCanvasElement): fabric.Canvas {
    if (canvasRef) {
      canvasRef.dispose();
    }
    canvasRef = new fabric.Canvas(el);

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
          // Only allow editing when the active tool matches the annotation kind
          const toolMatches = (currentTool === 'kp' && kind === 'kp') || (currentTool === 'bb' && kind === 'bb');
          if (toolMatches) {
            pendingEdit = { group, kind };
            labelRequestSubs.forEach((cb) => cb({ kind, x: p.x, y: p.y, mode: 'edit', currentLabel }));
            return;
          }
        }
      }
      // Don't allow creating new annotations outside the image draw area
      if (!isPointWithinImageCanvas(p.x, p.y)) {
        return;
      }

      removePendingMarkers();
      if (currentTool === 'kp') {
        // add a small marker and request a label
        const c = KeyPointFabricHandler.createPendingMarker(canvasRef, p.x, p.y);
        pendingKP = { x: p.x, y: p.y, marker: c };
        // ask UI for label to the right
        labelRequestSubs.forEach((cb) => cb({ kind: 'kp', x: p.x, y: p.y, mode: 'create', currentLabel: '' }));
      } else if (currentTool === 'bb') {
        handleBoundingBoxClick(p.x, p.y);
      }
    });
    return canvasRef;
  },

  deleteSelected() {
    const imageHandler = imageHandlerRef;
    if (!imageHandler) throw new Error('Image handler not set');
    // const imageHandler = getImageHandlerInstance();
    if (!canvasRef) return;

    if (pendingEdit) {
      const g = pendingEdit.group;
      const meta = groupToAnnotation.get(g);
      if (meta && imageHandler.currentImageURL) {
        const s = imageHandler.getAnnotationStoreForCurrent();
        if (s) {
          if (meta.kind === 'kp') {
            const idx = s.kps.indexOf(meta.ann as KeypointAnnotation);
            if (idx >= 0) s.kps.splice(idx, 1);
            // backend delete
            keypointDatabaseHandler.deleteKeyPoint(meta.ann as KeypointAnnotation);
            KeyPointFabricHandler.deleteFabricKeyPoint(canvasRef, g);
            // Record a delete action so Undo will re-add it
            undoRedoHandler.deleteAction('kp', meta.ann, g);
          } else {
            const idx = s.bbs.indexOf(meta.ann as BoundingBoxAnnotation);
            // TODO i don't know what this does below
            if (idx >= 0) s.bbs.splice(idx, 1);
            boundingBoxDatabaseHandler.deleteBoundingBox(meta.ann as BoundingBoxAnnotation);
            BoundingBoxFabricHandler.deleteFabricBoundingBox(canvasRef, g);
            // Record a delete action so Undo will re-add it
            undoRedoHandler.deleteAction('bb', meta.ann, g);
          }
        }
        groupToAnnotation.delete(g);
      }

      pendingEdit = null;
      canvasRef.remove(g);
      return;
    }
    removePendingMarkers();
  },
  disposeCanvas() {
    canvasRef?.dispose();
  },

  /**
   * Render the current image to the Fabric canvas, centered and scaled.
   * Uses an in-memory cache of FabricImage instances to avoid re-downloading.
   */
  async renderToCanvas(batchID: string, projectID: string): Promise<{ current: number; total: number }> {
    const imageHandler = imageHandlerRef;
    if (!imageHandler) throw new Error('Image handler not set');
    if (!canvasRef) throw new Error('Canvas not initialized');

    // ✅ use metadata returned from loadImageURL, not React state
    const meta = await imageHandler.loadImageURL(batchID, imageHandler.currentImageNumber);
    if (!meta || !meta.imageURL) {
      throw new Error('Failed to load image metadata');
    }

    await loadProjectLabels(projectID);
    clearAnnotationGroups();

    const store = imageHandler.annotationStore;

    // Fetch keypoints if not already cached
    if (!store.has(meta.imageURL) || (store.get(meta.imageURL)?.kps.length ?? 0) === 0) {
      try {
        const kps = await keypointDatabaseHandler.getAllKeyPoints(projectID, meta.imageID);
        const s = store.get(meta.imageURL) ?? { kps: [], bbs: [] };
        s.kps.push(...kps);
        store.set(meta.imageURL, s);
      } catch (e) {
        console.error('[KP] Failed to fetch existing keypoints:', e);
      }
    }

    // Fetch bounding boxes if not already cached
    if (!store.has(meta.imageURL) || (store.get(meta.imageURL)?.bbs.length ?? 0) === 0) {
      try {
        const bbs = await boundingBoxDatabaseHandler.getAllBoundingBoxes(projectID, meta.imageID);
        const s = store.get(meta.imageURL) ?? { kps: [], bbs: [] };
        s.bbs.push(...bbs);
        store.set(meta.imageURL, s);
      } catch (e) {
        console.error('[BB] Failed to fetch existing bounding boxes:', e);
      }
    }

    const img = await imageHandler.getFabricImage(meta.imageURL);

    const total = imageHandler.getTotalImageCount();
    const iw = img.width ?? 1;
    const ih = img.height ?? 1;
    currentImageW = iw;
    currentImageH = ih;

    // Determine available canvas size from parent container; fallback to image size
    const canvasEl = canvasRef.getElement() as HTMLCanvasElement;
    const parent = canvasEl?.parentElement;
    const cw = Math.max(1, parent?.clientWidth ?? iw);
    const ch = Math.max(1, parent?.clientHeight ?? ih);

    canvasRef.setWidth(cw);
    canvasRef.setHeight(ch);

    // Compute scale to fit image into canvas while preserving aspect ratio
    const scale = Math.min(cw / iw, ch / ih);
    const scaledW = iw * scale;
    const scaledH = ih * scale;
    const offsetX = (cw - scaledW) / 2;
    const offsetY = (ch - scaledH) / 2;

    // Store transform for later conversions
    currentScale = scale;
    currentOffsetX = offsetX;
    currentOffsetY = offsetY;

    // Place the image as background, scaled and centered within the canvas
    img.set({ originX: 'left', originY: 'top', left: offsetX, top: offsetY, scaleX: scale, scaleY: scale });
    canvasRef.backgroundImage = img;

    // Draw annotations using current transform
    drawAnnotationsForCurrentImage(imageHandler, meta.imageURL);
    canvasRef.requestRenderAll();

    return { current: imageHandler.currentImageNumber, total };
  },
};

function handleBoundingBoxClick(x: number, y: number) {
  const imageHandler = imageHandlerRef;
  if (!imageHandler) throw new Error('Image handler not set');
  // const imageHandler = getImageHandlerInstance();
  if (!canvasRef) return;
  if (!imageHandler.currentImageURL) return;

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
  const marker = BoundingBoxFabricHandler.createPendingMarker(canvasRef, x, y);
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
    bbPoints.forEach((pt) => pt.marker && canvasRef.remove(pt.marker));
    // TODO might not need this
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
    const { polygon: poly } = polygonFromTwoPoints({ x: p1.x, y: p1.y }, { x: p2.x, y: p2.y });
    canvasRef.add(poly);
    console.log('[BB] Rectangle created (corrected to axis-aligned):', {
      from: [p1, p2],
      normalized: rectPts,
    });

    // Ask for label near centroid and set pending state
    pendingBB = { polygon: poly, points: rectPts };
    const c = polygonCentroid(rectPts);
    labelRequestSubs.forEach((cb) => cb({ kind: 'bb', x: c.x, y: c.y, mode: 'create', currentLabel: '' }));

    // Reset drawing state
    bbActive = false;
    bbPoints = [];
  }
  canvasRef.requestRenderAll();
}

// Remove all existing non-background annotation visuals from the canvas
function clearAnnotationGroups() {
  if (!canvasRef) return;
  const objs = canvasRef.getObjects();

  // Collect any objects we should preserve while a label is pending or a shape is in-progress
  const preserve = new Set<fabric.Object>();
  if (pendingKP?.marker) preserve.add(pendingKP.marker);
  if (pendingBB?.polygon) preserve.add(pendingBB.polygon);
  if (bbPolyline) preserve.add(bbPolyline);
  // Also preserve any in-progress bb markers
  for (const pt of bbPoints) {
    if (pt.marker) preserve.add(pt.marker);
  }

  // Remove everything except background image and preserved objects
  const toRemove = objs.filter((o) => {
    const type = (o as unknown as { type?: string }).type;
    if (preserve.has(o)) return false;
    // Background image isn't in getObjects when using backgroundImage, but keep the condition for safety
    return type !== 'image';
  });

  toRemove.forEach((o) => canvasRef.remove(o));
  canvasRef.requestRenderAll();
}

// Redraw annotations for the current image key
export function drawAnnotationsForCurrentImage(handler: ImageHandler, forImageURL?: string) {
  // Use the provided handler instead of relying on a module-scoped reference
  const url = forImageURL ?? handler.currentImageURL;
  if (!canvasRef || !url) return;
  const s = handler.annotationStore.get(url);
  if (!s) return;

  // Draw keypoints
  for (const ann of s.kps) {
    const { group } = KeyPointFabricHandler.createFabricKeyPoint(canvasRef, ann, {
      scale: currentScale,
      offsetX: currentOffsetX,
      offsetY: currentOffsetY,
    });
    groupToAnnotation.set(group, { kind: 'kp', ann });
  }

  // Draw bounding boxes
  for (const ann of s.bbs) {
    const { group } = BoundingBoxFabricHandler.createFabricBoundingBox(canvasRef, ann, {
      scale: currentScale,
      offsetX: currentOffsetX,
      offsetY: currentOffsetY,
    });
    groupToAnnotation.set(group, { kind: 'bb', ann });
  }
}

function removePendingMarkers() {
  if (pendingBB) {
    canvasRef.remove(pendingBB.polygon);
    pendingBB = null;
  }
  if (pendingKP) {
    if (pendingKP.marker) {
      canvasRef.remove(pendingKP.marker);
    }
    pendingKP = null;
  }
}

function isBoundingBoxAnnotation(ann: KeypointAnnotation | BoundingBoxAnnotation): ann is BoundingBoxAnnotation {
  return ann.kind === 'boundingbox';
}
function isKeypointAnnotation(ann: KeypointAnnotation | BoundingBoxAnnotation): ann is KeypointAnnotation {
  return ann.kind === 'keypoint';
}

const undoRedoAPI = {
  onAdd: async (kind: 'kp' | 'bb', annotation: KeypointAnnotation | BoundingBoxAnnotation, group: fabric.Group) => {
    if (kind === 'bb' && isBoundingBoxAnnotation(annotation)) {
      await boundingBoxDatabaseHandler.createBoundingBox(annotation);
      // Re-add the visual group if provided
      if (group) {
        canvasRef.add(group);
        groupToAnnotation.set(group, { kind: 'bb', ann: annotation });
      } else {
        const { group: g } = BoundingBoxFabricHandler.createFabricBoundingBox(canvasRef, annotation, {
          scale: currentScale,
          offsetX: currentOffsetX,
          offsetY: currentOffsetY,
        });
        groupToAnnotation.set(g, { kind: 'bb', ann: annotation });
      }
    } else if (kind === 'kp' && isKeypointAnnotation(annotation)) {
      await keypointDatabaseHandler.createdKeyPoint(annotation);
      if (group) {
        canvasRef.add(group);
        groupToAnnotation.set(group, { kind: 'kp', ann: annotation });
      } else {
        const { group: g } = KeyPointFabricHandler.createFabricKeyPoint(canvasRef, annotation, {
          scale: currentScale,
          offsetX: currentOffsetX,
          offsetY: currentOffsetY,
        });
        groupToAnnotation.set(g, { kind: 'kp', ann: annotation });
      }
    } else {
      throw new Error('Mismatched kind/annotation in onAdd');
    }
  },
  onEdit: async (kind: 'kp' | 'bb', before: KeypointAnnotation | BoundingBoxAnnotation, after: KeypointAnnotation | BoundingBoxAnnotation, group: fabric.Group) => {
    if (kind === 'bb' && isBoundingBoxAnnotation(before) && isBoundingBoxAnnotation(after)) {
      const labelText = getBoundingBoxLabelName(after.labelID);
      await boundingBoxDatabaseHandler.renameBoundingBox(before, after.labelID);
      BoundingBoxFabricHandler.renameFabricBoundingBox(canvasRef, group, labelText);
      groupToAnnotation.set(group, { kind: 'bb', ann: after });
    } else if (kind === 'kp' && isKeypointAnnotation(before) && isKeypointAnnotation(after)) {
      const labelText = getKeypointLabelName(after.labelID);
      await keypointDatabaseHandler.renameKeyPoint(before, after.labelID);
      KeyPointFabricHandler.renameFabricKeyPoint(canvasRef, group, labelText);
      groupToAnnotation.set(group, { kind: 'kp', ann: after });
    } else {
      throw new Error('Mismatched kind/annotation in onEdit');
    }
  },
  onDelete: async (kind: 'kp' | 'bb', annotation: KeypointAnnotation | BoundingBoxAnnotation, group: fabric.Group) => {
    if (kind === 'bb' && isBoundingBoxAnnotation(annotation)) {
      await boundingBoxDatabaseHandler.deleteBoundingBox(annotation);
      BoundingBoxFabricHandler.deleteFabricBoundingBox(canvasRef, group);
      groupToAnnotation.delete(group);
    } else if (kind === 'kp' && isKeypointAnnotation(annotation)) {
      await keypointDatabaseHandler.deleteKeyPoint(annotation);
      KeyPointFabricHandler.deleteFabricKeyPoint(canvasRef, group);
      groupToAnnotation.delete(group);
    } else {
      throw new Error('Mismatched kind/annotation in onDelete');
    }
  },
  validate: () => true,
};

export const handleUndoRedo = async (action: 'undo' | 'redo') => {
  if (action === 'undo') {
    await undoRedoHandler.undo(undoRedoAPI);
  } else {
    await undoRedoHandler.redo(undoRedoAPI);
  }
  // Always redraw annotation visuals after undo/redo
  const canvas = getCanvas();
  if (canvas) canvas.requestRenderAll();
};
