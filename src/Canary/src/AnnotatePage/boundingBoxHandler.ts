import * as fabric from 'fabric';
import { fabricBBPolygonProps, fabricBBProps, fabricGroupProps, fabricBBMarkerProps } from './constants';
import type { BoundingBoxAnnotation } from './constants';
import { UndoRedoHandler } from './undoRedoHandler';
import { getBoundingBoxLabelName } from './labelRegistry';
import { polygonCentroid } from './helper';
import { CallAPI } from '../utils/apis';
import { createBoundingBoxAnnotation } from './constants';

const baseUrl = import.meta.env.VITE_PROJECT_SERVICE_URL as string;
export const boundingBoxUndoRedo = new UndoRedoHandler();

export const BoundingBoxFabricHandler = {
  createFabricBoundingBox(ann: BoundingBoxAnnotation): { group: fabric.Group } {
    const poly = new fabric.Polygon(ann.points, fabricBBPolygonProps);
    const c = polygonCentroid(ann.points);
    const labelText = getBoundingBoxLabelName(ann.labelID);
    const text = new fabric.FabricText(labelText, fabricBBProps({ x: c.x, y: c.y }));
    const group = new fabric.Group([poly, text], fabricGroupProps);
    return { group };
  },

  deleteFabricBoundingBox(group: fabric.Group): void {
    group.remove();
  },

  renameFabricBoundingBox(group: fabric.Group, newLabel: string): void {
    const textObj = group.item(1) as fabric.FabricText;
    textObj.text = newLabel;
  },

  updateFabricBoundingBoxPosition(group: fabric.Group, newPoints: fabric.Point[]): void {
    const poly = group.item(0) as fabric.Polygon;
    poly.set({ points: newPoints });
  },

  createPendingMarker(x: number, y: number): fabric.Circle {
    return new fabric.Circle(fabricBBMarkerProps({ x, y }));
  },
};

export const boundingBoxDatabaseHandler = {
  // Create a bounding box in the database and get its ID
  async createBoundingBox(ann: BoundingBoxAnnotation): Promise<BoundingBoxAnnotation> {
    const url = `${baseUrl}/projects/${ann.projectID}/images/${ann.imageID}/boundingboxes`;
    const body = {
      box: getBox(ann),
      boundingBoxLabelID: ann.labelID,
    };
    try {
      const result = await CallAPI(url, {
        method: 'POST',
        json: body,
      });
      const newId = result as string;
      if (!newId) throw new Error('No bounding box ID returned from server');
      ann.id = newId;
    } catch (err) {
      console.error(`Failed to create bounding box ${ann.id}:`, err);
    }

    boundingBoxUndoRedo.addAction('bb', ann);
    console.log('Bounding box stored:', ann);
    return ann;
  },

  async renameBoundingBox(ann: BoundingBoxAnnotation, newLabelID: string): Promise<void> {
    const url = `${baseUrl}/projects/${ann.projectID}/boundingboxes/${ann.id}`;
    const body = {
      box: getBox(ann),
      boundingBoxLabelID: newLabelID,
    };
    try {
      await CallAPI(url, {
        method: 'PATCH',
        json: body,
      });
    } catch (err) {
      console.error(`Failed to rename bounding box ${ann.id}:`, err);
    }

    boundingBoxUndoRedo.editAction('bb', { ...ann, labelID: ann.labelID }, { ...ann, labelID: newLabelID });
    console.log(`Bounding box ${ann.id} renamed to label ${newLabelID}`);
  },

  async deleteBoundingBox(ann: BoundingBoxAnnotation): Promise<void> {
    const url = `${baseUrl}/projects/${ann.projectID}/boundingboxes/${ann.id}`;
    try {
      await CallAPI(url, {
        method: 'DELETE',
      });
    } catch (err) {
      console.error(`Failed to delete bounding box ${ann.id}:`, err);
    }

    console.log('Bounding box deleted:', ann);
    boundingBoxUndoRedo.deleteAction('bb', ann);
  },

  async getAllBoundingBoxes(projectID?: string, imageID?: string) {
    const url = `${baseUrl}/projects/${projectID}/images/${imageID}/boundingboxes`;
    let raw;
    try {
      raw = await CallAPI(url, {
        method: 'GET',
      });
    } catch (err) {
      throw new Error(`Failed to fetch bounding boxes for image ${imageID}: ${err}`);
    }
    const arr: unknown[] = Array.isArray(raw) ? raw : Array.isArray((raw as { items: unknown[] })?.items) ? (raw as { items: unknown[] }).items : [];
    const normalized: BoundingBoxAnnotation[] = arr
      .map((it) => {
        const item = it as Record<string, unknown>;
        const id = (item.boundingBoxID ?? item.id) as string;
        const labelID = (item.boundingBoxLabelID ?? '') as string;
        const box = item.box as { x: number; y: number; width: number; height: number };
        const x = box.x;
        const y = box.y;
        const w = box.width;
        const h = box.height;
        if (x == null || y == null || w == null || h == null) return null;
        const points = [
          { x: x, y: y },
          { x: x + w, y: y },
          { x: x + w, y: y + h },
          { x: x, y: y + h },
        ];
        const bb: BoundingBoxAnnotation = createBoundingBoxAnnotation({
          id,
          labelID,
          points,
          projectID: projectID!,
          imageID: imageID!,
        });
        return bb;
      })
      .filter((v): v is BoundingBoxAnnotation => Boolean(v));
    return normalized;
  },
};

function getBox(ann: BoundingBoxAnnotation): { x: number; y: number; width: number; height: number } {
  const xs = ann.points.map((p) => p.x);
  const ys = ann.points.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
