// src/Canary/src/AnnotatePage/annotateHandler.ts

import * as fabric from 'fabric';
import type { LabelRequest } from './constants';
import { createBoundingBoxAnnotation, createKeypointAnnotation, fabricBBColour } from './constants';
import { KeyPointFabricHandler, keypointDatabaseHandler } from './keypointHandler.ts';
import { boundingBoxDatabaseHandler, BoundingBoxFabricHandler } from './boundingBoxHandler.ts';
import { loadProjectLabels } from './labelLoader.ts';
import { polygonCentroid, polygonFromTwoPoints } from './helper.ts';
import { type ImageHandler, imageDatabaseHandler } from './imageStateHandler.ts';
import { getBoundingBoxLabelIdByName, getBoundingBoxLabelName, getKeypointLabelIdByName, getKeypointLabelName } from './labelRegistry.ts';
import { UndoRedoHandler } from './undoRedoHandler.ts';
import type { BoundingBoxAnnotation, KeypointAnnotation } from '../utils/intefaces/interfaces.ts';
import { sidebarHandler } from './sidebarHandler.ts';

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

function imageToCanvas(p: { x: number; y: number }): { x: number; y: number } {
  return { x: p.x * currentScale + currentOffsetX, y: p.y * currentScale + currentOffsetY };
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
type PendingEditState = {
  group: fabric.Group;
  kind: 'kp' | 'bb';
  annotation: KeypointAnnotation | BoundingBoxAnnotation;
  original: KeypointAnnotation | BoundingBoxAnnotation;
  draft: KeypointAnnotation | BoundingBoxAnnotation;
  startLeft: number;
  startTop: number;
};

let pendingEdit: PendingEditState | null = null;

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

  // Resize canvas and maintain annotations positioning
  resizeCanvas(containerWidth: number, containerHeight: number) {
    if (!canvasRef || !imageHandlerRef) return;
    
    const imageHandler = imageHandlerRef;
    const imageURL = imageHandler.currentImageURL;
    if (!imageURL || currentImageW <= 0 || currentImageH <= 0) return;

    // Update canvas dimensions
    canvasRef.setWidth(containerWidth);
    canvasRef.setHeight(containerHeight);

    // Recalculate scale and positioning for the image
    const scale = Math.min(containerWidth / currentImageW, containerHeight / currentImageH);
    const scaledW = currentImageW * scale;
    const scaledH = currentImageH * scale;
    const offsetX = (containerWidth - scaledW) / 2;
    const offsetY = (containerHeight - scaledH) / 2;

    // Update transform variables
    currentScale = scale;
    currentOffsetX = offsetX;
    currentOffsetY = offsetY;

    // Update background image positioning
    if (canvasRef.backgroundImage) {
      canvasRef.backgroundImage.set({
        left: offsetX,
        top: offsetY,
        scaleX: scale,
        scaleY: scale
      });
    }

    // Clear and redraw all annotations with new transform
    clearAnnotationGroups();
    drawAnnotationsForCurrentImage(imageHandler, imageURL);
    
    canvasRef.requestRenderAll();
  },
  // When you press OK to confirm the name of a label
  async confirmLabel(label: string, projectID: string) {
    const imageHandler = imageHandlerRef;
    if (!imageHandler) throw new Error('Image handler not set');
    // const imageHandler = getImageHandlerInstance();
    if (!canvasRef) return;
    try {
      if (pendingEdit) {
        const { group, kind, annotation, original, draft } = pendingEdit;
        const meta = groupToAnnotation.get(group);
        if (!meta) return;

        if (kind === 'kp' && isKeypointAnnotation(annotation) && isKeypointAnnotation(draft) && isKeypointAnnotation(original)) {
          const labelID = getKeypointLabelIdByName(label);
          draft.labelID = labelID;
          annotation.labelID = labelID;
          annotation.position = { ...draft.position };
          await keypointDatabaseHandler.updateKeyPoint(annotation, { labelID, position: annotation.position });
          KeyPointFabricHandler.renameFabricKeyPoint(canvasRef, group, label);
          groupToAnnotation.set(group, { kind: 'kp', ann: annotation });
          const beforeClone = cloneKeypointAnnotation(original);
          const afterClone = cloneKeypointAnnotation(annotation);
          undoRedoHandler.editAction('kp', beforeClone, afterClone, group);
        } else if (kind === 'bb' && isBoundingBoxAnnotation(annotation) && isBoundingBoxAnnotation(draft) && isBoundingBoxAnnotation(original)) {
          const labelID = getBoundingBoxLabelIdByName(label);
          draft.labelID = labelID;
          annotation.labelID = labelID;
          annotation.points = draft.points.map((p) => ({ ...p }));
          await boundingBoxDatabaseHandler.updateBoundingBox(annotation, { labelID, points: annotation.points });
          BoundingBoxFabricHandler.renameFabricBoundingBox(canvasRef, group, label);
          groupToAnnotation.set(group, { kind: 'bb', ann: annotation });
          const beforeClone = cloneBoundingBoxAnnotation(original);
          const afterClone = cloneBoundingBoxAnnotation(annotation);
          undoRedoHandler.editAction('bb', beforeClone, afterClone, group);
        }
        pendingEdit = null;
        sidebarHandler.updateSidebar(imageHandler);
        canvasRef.requestRenderAll();
        return;
      }

      const imageID = imageHandler.currentImageID;
      if (!imageID) return;

      if (currentTool === 'kp' && pendingKP) {
        const { x, y, marker } = pendingKP;
        if (!marker) return;

        const imgPt = canvasToImage({ x, y });
        const ann = createKeypointAnnotation({
          id: '',
          position: { x: imgPt.x, y: imgPt.y },
          labelID: getKeypointLabelIdByName(label),
          projectID,
          imageID,
        });

        const createdAnn = await keypointDatabaseHandler.createdKeyPoint(ann);
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
        sidebarHandler.updateSidebar(imageHandler);
        removePendingMarkers();
        return;
      }

      if (currentTool === 'bb' && pendingBB) {
        const { points } = pendingBB;
        const imgPts = points.map((p) => canvasToImage(p));
        const ann = createBoundingBoxAnnotation({
          id: '',
          points: imgPts,
          labelID: getBoundingBoxLabelIdByName(label),
          projectID,
          imageID,
        });

        const createdAnn = await boundingBoxDatabaseHandler.createBoundingBox(ann);
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
        sidebarHandler.updateSidebar(imageHandler);
        removePendingMarkers();
      }
    } catch (err) {
      console.error('[Annotate] confirmLabel failed', err);
    }
  },
  // If the cancel button is clicked
  cancelLabel() {
    if (currentTool == 'kp' && pendingKP) {
      if (pendingKP.marker) {
        canvasRef.remove(pendingKP.marker);
      }
      pendingKP = null;
      // console.log('[KP] Keypoint creation cancelled:', pendingKP);
    } else if (currentTool === 'bb' && pendingBB) {
      if (pendingBB.polygon) {
        canvasRef.remove(pendingBB.polygon);
      }
      pendingBB = null;
      // console.log('[BB] Bounding box creation cancelled:', pendingBB);
    } else if (pendingEdit) {
      const { group, startLeft, startTop } = pendingEdit;
      group.set({ left: startLeft, top: startTop });
      group.setCoords();
      canvasRef.requestRenderAll();
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

      if (pendingEdit && (!target || !isGroup(target) || target !== pendingEdit.group)) {
        return;
      }

      if (target && isGroup(target)) {
        const group = target as fabric.Group;
        const mapped = groupToAnnotation.get(group);
        const children = getGroupChildren(group);
        const hasPolygon = children.some((o) => (o as unknown as { type?: string }).type === 'polygon');
        const kind: 'kp' | 'bb' = mapped?.kind ?? (hasPolygon ? 'bb' : 'kp');
        const toolMatches = (currentTool === 'kp' && kind === 'kp') || (currentTool === 'bb' && kind === 'bb');
        if (toolMatches) {
          if (pendingEdit && pendingEdit.group === group) {
            return;
          }
          if (!mapped) {
            return;
          }
          const annotation = mapped.ann;
          const original = cloneAnnotation(annotation);
          const draft = cloneAnnotation(annotation);
          const focus = getAnnotationFocusPoint(kind, draft);
          const currentLabel = kind === 'kp' ? getKeypointLabelName(annotation.labelID) : getBoundingBoxLabelName(annotation.labelID);
          pendingEdit = {
            group,
            kind,
            annotation,
            original,
            draft,
            startLeft: group.left ?? 0,
            startTop: group.top ?? 0,
          };
          canvasRef.setActiveObject(group);
          labelRequestSubs.forEach((cb) => cb({ kind, x: focus.x, y: focus.y, mode: 'edit', currentLabel }));
          return;
        }
      }

      if (pendingEdit) {
        return;
      }

      if (!isPointWithinImageCanvas(p.x, p.y)) {
        return;
      }

      removePendingMarkers();
      if (currentTool === 'kp') {
        const c = KeyPointFabricHandler.createPendingMarker(canvasRef, p.x, p.y);
        pendingKP = { x: p.x, y: p.y, marker: c };
        labelRequestSubs.forEach((cb) => cb({ kind: 'kp', x: p.x, y: p.y, mode: 'create', currentLabel: '' }));
      } else if (currentTool === 'bb') {
        handleBoundingBoxClick(p.x, p.y);
      }
    });

    canvasRef.on('object:moving', (opt) => {
      if (!pendingEdit) return;
      const target = (opt as unknown as { target?: fabric.Object }).target;
      if (!target || !isGroup(target) || target !== pendingEdit.group) return;
      
      // Ensure we can only move annotations when the correct tool is selected
      const mapped = groupToAnnotation.get(target as fabric.Group);
      if (mapped) {
        const kind = mapped.kind;
        const toolMatches = (currentTool === 'kp' && kind === 'kp') || (currentTool === 'bb' && kind === 'bb');
        if (!toolMatches) {
          // Prevent movement by resetting position
          const group = target as fabric.Group;
          group.set({ left: pendingEdit.startLeft, top: pendingEdit.startTop });
          group.setCoords();
          canvasRef.requestRenderAll();
          return;
        }
      }
      
      updatePendingEditDraft();
    });

    canvasRef.on('selection:created', (opt) => {
      const target = (opt as unknown as { target?: fabric.Object }).target;
      if (target && isGroup(target)) {
        const group = target as fabric.Group;
        const mapped = groupToAnnotation.get(group);
        if (mapped) {
          const kind = mapped.kind;
          const toolMatches = (currentTool === 'kp' && kind === 'kp') || (currentTool === 'bb' && kind === 'bb');
          if (!toolMatches) {
            // Deselect if wrong tool is selected
            canvasRef.discardActiveObject();
            canvasRef.requestRenderAll();
          }
        }
      }
    });

    canvasRef.on('selection:updated', (opt) => {
      const target = (opt as unknown as { target?: fabric.Object }).target;
      if (target && isGroup(target)) {
        const group = target as fabric.Group;
        const mapped = groupToAnnotation.get(group);
        if (mapped) {
          const kind = mapped.kind;
          const toolMatches = (currentTool === 'kp' && kind === 'kp') || (currentTool === 'bb' && kind === 'bb');
          if (!toolMatches) {
            // Deselect if wrong tool is selected
            canvasRef.discardActiveObject();
            canvasRef.requestRenderAll();
          }
        }
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
      sidebarHandler.updateSidebar(imageHandler);
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

    // Fetch both keypoints and bounding boxes in parallel to avoid flickering
    const needsKpsFetch = !store.has(meta.imageURL) || (store.get(meta.imageURL)?.kps.length ?? 0) === 0;
    const needsBbsFetch = !store.has(meta.imageURL) || (store.get(meta.imageURL)?.bbs.length ?? 0) === 0;
    
    if (needsKpsFetch || needsBbsFetch) {
      try {
        const [kps, bbs] = await Promise.all([
          needsKpsFetch ? keypointDatabaseHandler.getAllKeyPoints(projectID, meta.imageID).catch((e) => {
            console.error('[KP] Failed to fetch existing keypoints:', e);
            return [];
          }) : Promise.resolve([]),
          needsBbsFetch ? boundingBoxDatabaseHandler.getAllBoundingBoxes(projectID, meta.imageID).catch((e) => {
            console.error('[BB] Failed to fetch existing bounding boxes:', e);
            return [];
          }) : Promise.resolve([])
        ]);

        // Update store with fetched annotations
        const s = store.get(meta.imageURL) ?? { kps: [], bbs: [] };
        if (needsKpsFetch && kps.length > 0) {
          s.kps.push(...kps);
        }
        if (needsBbsFetch && bbs.length > 0) {
          s.bbs.push(...bbs);
        }
        store.set(meta.imageURL, s);
      } catch (e) {
        console.error('[Annotate] Failed to fetch annotations:', e);
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
  sidebarHandler.updateSidebar(imageHandler, { imageURL: meta.imageURL });
    canvasRef.requestRenderAll();

    return { current: imageHandler.currentImageNumber, total };
  },

  copyPrevAnnotations(imageID: string, _batchID: string, projectID: string) {
    imageDatabaseHandler
      .copyPrevAnnotations(imageID)
      .then(() => {
        // Call refreshAnnotations instead of renderToCanvas
        annotateHandler.refreshAnnotations(projectID).catch((err) => console.warn('[Annotate] refreshAnnotations failed', err));
      })
      .catch((err) => console.error('[Annotate] copyPrevAnnotations failed', err));
  },

  hasPrevAnnotations(imageID: string) {
    return imageDatabaseHandler.hasPrevAnnotations(imageID);
  },

  // Force a refresh of annotations for the current image (re-fetch from backend and redraw)
  async refreshAnnotations(projectID: string) {
    const imageHandler = imageHandlerRef;
    if (!imageHandler || !canvasRef) return;
    const imageID = imageHandler.currentImageID;
    const imageURL = imageHandler.currentImageURL;
    if (!imageID || !imageURL) return;
    try {
      const [kps, bbs] = await Promise.all([
        keypointDatabaseHandler.getAllKeyPoints(projectID, imageID).catch(() => []),
        boundingBoxDatabaseHandler.getAllBoundingBoxes(projectID, imageID).catch(() => []),
      ]);
      imageHandler.annotationStore.set(imageURL, { kps, bbs });
      clearAnnotationGroups();
      drawAnnotationsForCurrentImage(imageHandler, imageURL);
  sidebarHandler.updateSidebar(imageHandler, { imageURL });
      canvasRef.requestRenderAll();
    } catch (e) {
      console.warn('[Annotate] refreshAnnotations failed', e);
    }
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
  // console.log('[BB] Point added:', { x, y, marker });

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
function updatePendingEditDraft() {
  if (!pendingEdit || currentScale === 0) return;
  const { group, kind, original, draft } = pendingEdit;
  const left = group.left ?? pendingEdit.startLeft;
  const top = group.top ?? pendingEdit.startTop;
  const dxCanvas = left - pendingEdit.startLeft;
  const dyCanvas = top - pendingEdit.startTop;
  const dxImage = dxCanvas / currentScale;
  const dyImage = dyCanvas / currentScale;

  if (kind === 'kp' && isKeypointAnnotation(original) && isKeypointAnnotation(draft)) {
    draft.position = {
      x: original.position.x + dxImage,
      y: original.position.y + dyImage,
    };
  } else if (kind === 'bb' && isBoundingBoxAnnotation(original) && isBoundingBoxAnnotation(draft)) {
    draft.points = original.points.map((pt) => ({ x: pt.x + dxImage, y: pt.y + dyImage }));
  }

  const focus = getAnnotationFocusPoint(kind, draft);
  const currentLabel = kind === 'kp' ? getKeypointLabelName(pendingEdit.annotation.labelID) : getBoundingBoxLabelName(pendingEdit.annotation.labelID);
  labelRequestSubs.forEach((cb) => cb({ kind, x: focus.x, y: focus.y, mode: 'edit', currentLabel, preserveLabel: true }));
}

function getAnnotationFocusPoint(kind: 'kp' | 'bb', ann: KeypointAnnotation | BoundingBoxAnnotation): { x: number; y: number } {
  if (kind === 'kp' && isKeypointAnnotation(ann)) {
    return imageToCanvas(ann.position);
  }
  if (kind === 'bb' && isBoundingBoxAnnotation(ann)) {
    const centre = polygonCentroid(ann.points);
    return imageToCanvas(centre);
  }
  return { x: 0, y: 0 };
}

function cloneKeypointAnnotation(ann: KeypointAnnotation): KeypointAnnotation {
  return {
    kind: 'keypoint',
    projectID: ann.projectID,
    imageID: ann.imageID,
    id: ann.id,
    labelID: ann.labelID,
    position: { ...ann.position },
  };
}

function cloneBoundingBoxAnnotation(ann: BoundingBoxAnnotation): BoundingBoxAnnotation {
  return {
    kind: 'boundingbox',
    projectID: ann.projectID,
    imageID: ann.imageID,
    id: ann.id,
    labelID: ann.labelID,
    points: ann.points.map((p) => ({ ...p })),
  };
}

function cloneAnnotation(ann: KeypointAnnotation | BoundingBoxAnnotation): KeypointAnnotation | BoundingBoxAnnotation {
  return isKeypointAnnotation(ann) ? cloneKeypointAnnotation(ann) : cloneBoundingBoxAnnotation(ann);
}

function translateGroup(group: fabric.Group, dxImage: number, dyImage: number) {
  if (!canvasRef || (dxImage === 0 && dyImage === 0)) return;
  const dxCanvas = dxImage * currentScale;
  const dyCanvas = dyImage * currentScale;
  if (dxCanvas === 0 && dyCanvas === 0) return;
  const nextLeft = (group.left ?? 0) + dxCanvas;
  const nextTop = (group.top ?? 0) + dyCanvas;
  group.set({ left: nextLeft, top: nextTop });
  group.setCoords();
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
    if (!canvasRef) return;
    const meta = groupToAnnotation.get(group);
    if (!meta) return;

    if (kind === 'bb' && isBoundingBoxAnnotation(before) && isBoundingBoxAnnotation(after) && isBoundingBoxAnnotation(meta.ann)) {
      const current = meta.ann as BoundingBoxAnnotation;
      const target = after;
      const dxImage = target.points[0].x - current.points[0].x;
      const dyImage = target.points[0].y - current.points[0].y;
      await boundingBoxDatabaseHandler.updateBoundingBox(current, { labelID: target.labelID, points: target.points });
      current.labelID = target.labelID;
      current.points = target.points.map((p) => ({ ...p }));
      BoundingBoxFabricHandler.renameFabricBoundingBox(canvasRef, group, getBoundingBoxLabelName(current.labelID));
      translateGroup(group, dxImage, dyImage);
      groupToAnnotation.set(group, { kind: 'bb', ann: current });
    } else if (kind === 'kp' && isKeypointAnnotation(before) && isKeypointAnnotation(after) && isKeypointAnnotation(meta.ann)) {
      const current = meta.ann as KeypointAnnotation;
      const target = after;
      const dxImage = target.position.x - current.position.x;
      const dyImage = target.position.y - current.position.y;
      await keypointDatabaseHandler.updateKeyPoint(current, { labelID: target.labelID, position: target.position });
      current.labelID = target.labelID;
      current.position = { ...target.position };
      KeyPointFabricHandler.renameFabricKeyPoint(canvasRef, group, getKeypointLabelName(current.labelID));
      translateGroup(group, dxImage, dyImage);
      groupToAnnotation.set(group, { kind: 'kp', ann: current });
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
