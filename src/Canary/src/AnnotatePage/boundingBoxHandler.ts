import * as fabric from 'fabric';
import { fabricBBPolygonProps, fabricBBProps, fabricGroupProps, fabricBBMarkerProps } from './constants';
import { getBoundingBoxLabelName } from './labelRegistry';
import { polygonCentroid } from './helper';
import { CallAPI, projectServiceUrl } from '../utils/apis';
import { createBoundingBoxAnnotation } from './constants';
import type { BoundingBoxAnnotation } from '../utils/intefaces/interfaces';

export const BoundingBoxFabricHandler = {
  createFabricBoundingBox(canvas: fabric.Canvas, ann: BoundingBoxAnnotation, transform?: { scale: number; offsetX: number; offsetY: number }): { group: fabric.Group } {
    const mapPoint = (p: { x: number; y: number }) => (transform ? { x: p.x * transform.scale + transform.offsetX, y: p.y * transform.scale + transform.offsetY } : p);
    const pts = ann.points.map(mapPoint);
    const poly = new fabric.Polygon(pts, fabricBBPolygonProps);
    const c = polygonCentroid(pts);
    const labelText = getBoundingBoxLabelName(ann.labelID);
    const text = new fabric.FabricText(labelText, fabricBBProps({ x: c.x, y: c.y }));
    const group = new fabric.Group([poly, text], fabricGroupProps);
    canvas.add(group);
    return { group };
  },

  deleteFabricBoundingBox(canvas: fabric.Canvas, group: fabric.Group): void {
    canvas.remove(group);
  },

  renameFabricBoundingBox(canvas: fabric.Canvas, group: fabric.Group, newLabel: string): void {
    const textObj = group.item(1) as fabric.Text;
    textObj.set({ text: newLabel });
    canvas.requestRenderAll();
  },

  updateFabricBoundingBoxPosition(canvas: fabric.Canvas, group: fabric.Group, newPoints: fabric.Point[]): void {
    const poly = group.item(0) as fabric.Polygon;
    poly.set({ points: newPoints });
    canvas.add(group);
  },

  createPendingMarker(canvas: fabric.Canvas, x: number, y: number): fabric.Circle {
    const circle = new fabric.Circle(fabricBBMarkerProps({ x, y }));
    canvas.add(circle);
    return circle;
  },
};

export const boundingBoxDatabaseHandler = {
  // Create a bounding box in the database and get its ID
  async createBoundingBox(ann: BoundingBoxAnnotation): Promise<BoundingBoxAnnotation> {
    const url = `${projectServiceUrl()}/projects/${ann.projectID}/images/${ann.imageID}/boundingboxes`;
    const body = {
      box: getBox(ann),
      boundingBoxLabelID: ann.labelID,
    };
    try {
      const result = await CallAPI(url, {
        method: 'POST',
        json: body,
      });
      console.log(result);
      const newId = (result as { boundingBoxID: string }).boundingBoxID;
      if (!newId) throw new Error('No bounding box ID returned from server');
      ann.id = newId;
    } catch (err) {
      console.error(`Failed to create bounding box ${ann.id}:`, err);
    }

    console.log('Bounding box stored:', ann);
    return ann;
  },

  async renameBoundingBox(ann: BoundingBoxAnnotation, newLabelID: string): Promise<BoundingBoxAnnotation> {
    const url = `${projectServiceUrl()}/projects/${ann.projectID}/boundingboxes/${ann.id}`;
    const body = {
      box: getBox(ann),
      boundingBoxLabelID: newLabelID,
    };
    try {
      await CallAPI(url, {
        method: 'PATCH',
        json: body,
        ignoreResponse: true,
      });
    } catch (err) {
      console.error(`Failed to rename bounding box ${ann.id}:`, err);
    }

    console.log(`Bounding box ${ann.id} renamed to label ${newLabelID}`);
    return { ...ann, labelID: newLabelID };
  },

  async deleteBoundingBox(ann: BoundingBoxAnnotation): Promise<void> {
    const url = `${projectServiceUrl()}/projects/${ann.projectID}/boundingboxes/${ann.id}`;
    try {
      await CallAPI(url, {
        method: 'DELETE',
        ignoreResponse: true,
      });
    } catch (err) {
      console.error(`Failed to delete bounding box ${ann.id}:`, err);
    }

    console.log('Bounding box deleted:', ann);
  },

  async getAllBoundingBoxes(projectID: string, imageID: string) {
    const url = `${projectServiceUrl()}/projects/${projectID}/images/${imageID}/boundingboxes`;
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
          id: item.boundingBoxID as string,
          labelID: item.boundingBoxLabelID as string,
          points: points,
          projectID: projectID,
          imageID: imageID,
        });
        return bb;
      })
      .filter((v): v is BoundingBoxAnnotation => Boolean(v));
    console.log(`bounding boxes loaded:`, normalized);
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
