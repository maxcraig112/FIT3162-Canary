import * as fabric from 'fabric';
import { fabricBBPolygonProps, fabricBBProps, fabricGroupProps, fabricBBMarkerProps } from './constants';
import type { BoundingBoxAnnotation } from './constants';
import { getAuthTokenFromCookie } from '../utils/cookieUtils';
import { getBoundingBoxLabelIdByName, getBoundingBoxLabelName } from './labelRegistry';

export function polygonCentroid(pts: Array<{ x: number; y: number }>) {
  let area = 0,
    cx = 0,
    cy = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const p1 = pts[j],
      p2 = pts[i];
    const f = p1.x * p2.y - p2.x * p1.y;
    area += f;
    cx += (p1.x + p2.x) * f;
    cy += (p1.y + p2.y) * f;
  }
  area *= 0.5;
  if (area === 0) return { x: pts[0].x, y: pts[0].y };
  return { x: cx / (6 * area), y: cy / (6 * area) };
}

export const boundingBoxHandler = {
  // Render a persisted bounding box as a group
  renderAnnotation(ann: BoundingBoxAnnotation): { group: fabric.Group } {
  const poly = new fabric.Polygon(ann.points, fabricBBPolygonProps);
    const c = polygonCentroid(ann.points);
  const labelText = ann.label || getBoundingBoxLabelName(ann.labelID) || '';
  const text = new fabric.FabricText(labelText, fabricBBProps({ x: c.x, y: c.y }));
    const group = new fabric.Group([poly, text], fabricGroupProps);
    return { group };
  },
  // Dummy API: rename an existing bounding box label (no-op for now)
  async renameBoundingBox(ann: BoundingBoxAnnotation, newLabel: string): Promise<void> {
    if (!ann.projectID || !ann.id) return;
    const baseUrl = import.meta.env.VITE_PROJECT_SERVICE_URL as string;
    const token = getAuthTokenFromCookie();
    const url = `${baseUrl}/projects/${ann.projectID}/boundingboxes/${ann.id}`;
    const xs = ann.points.map((p) => p.x);
    const ys = ann.points.map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    const body = {
      box: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
      boundingBoxLabelID: getBoundingBoxLabelIdByName(newLabel) ?? newLabel,
    };
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`Failed to rename bounding box ${ann.id}: ${res.status} ${res.statusText} - ${text}`);
    }
  },
  // Dummy API: delete an existing bounding box (no-op for now)
  async deleteBoundingBox(ann: BoundingBoxAnnotation): Promise<void> {
    if (!ann.projectID || !ann.id) return;
    const baseUrl = import.meta.env.VITE_PROJECT_SERVICE_URL as string;
    const token = getAuthTokenFromCookie();
    const url = `${baseUrl}/projects/${ann.projectID}/boundingboxes/${ann.id}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`Failed to delete bounding box ${ann.id}: ${res.status} ${res.statusText} - ${text}`);
    }
  },
  // Create a temporary point marker during rectangle creation
  createPointMarker(x: number, y: number): fabric.Circle {
    return new fabric.Circle(fabricBBMarkerProps({ x, y }));
  },
  // From two clicked points, compute a normalized axis-aligned rectangle polygon and its centroid
  polygonFromTwoPoints(
    p1: { x: number; y: number },
    p2: { x: number; y: number },
  ): {
    polygon: fabric.Polygon;
    points: Array<{ x: number; y: number }>;
    centroid: { x: number; y: number };
  } {
    const minX = Math.min(p1.x, p2.x);
    const maxX = Math.max(p1.x, p2.x);
    const minY = Math.min(p1.y, p2.y);
    const maxY = Math.max(p1.y, p2.y);
    const rectPts = [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY },
    ];
    const poly = new fabric.Polygon(rectPts, fabricBBPolygonProps);
    const c = polygonCentroid(rectPts);
    return { polygon: poly, points: rectPts, centroid: c };
  },
  // Finalize a polygon and label into a non-interactive group and annotation model
  finalizeCreate(
    polygon: fabric.Polygon,
    points: Array<{ x: number; y: number }>,
    label: string,
    projectID?: string,
    imageID?: string,
  ): {
    group: fabric.Group;
    annotation: BoundingBoxAnnotation;
  } {
    const c = polygonCentroid(points);
    const text = new fabric.FabricText(label, fabricBBProps({ x: c.x, y: c.y }));
    const group = new fabric.Group([polygon, text], fabricGroupProps);
    const annotation: BoundingBoxAnnotation = {
      label,
      labelID: getBoundingBoxLabelIdByName(label) ?? label,
      points,
      projectID,
      imageID,
      async addToDatabase() {
        const baseUrl = import.meta.env.VITE_PROJECT_SERVICE_URL as string;
        const token = getAuthTokenFromCookie();
        if (!projectID || !imageID) return;
        const xs = points.map((p) => p.x);
        const ys = points.map((p) => p.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const maxX = Math.max(...xs);
        const maxY = Math.max(...ys);
        const body = {
          box: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
          boundingBoxLabelID: getBoundingBoxLabelIdByName(label) ?? label,
        };
        const url = `${baseUrl}/projects/${projectID}/images/${imageID}/boundingboxes`;
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const t = await res.text();
          throw new Error(`Failed to create bounding box: ${res.status} ${res.statusText} - ${t}`);
        }
        // Firestore create returns text; ignore ID for now unless API changes to JSON
      },
    };
    void annotation.addToDatabase();
    return { group, annotation };
  },

  async getAllBoundingBoxes(projectID?: string, imageID?: string) {
    const baseUrl = import.meta.env.VITE_PROJECT_SERVICE_URL as string;
    const token = getAuthTokenFromCookie();
    const url = `${baseUrl}/projects/${projectID}/images/${imageID}/boundingboxes`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to fetch bounding boxes for image ${imageID}: ${res.status} ${res.statusText} - ${text}`);
    }

    const raw = await res.json();
    const arr: unknown[] = Array.isArray(raw) ? raw : Array.isArray((raw as { items?: unknown[] })?.items) ? (raw as { items: unknown[] }).items : [];
    const normalized: BoundingBoxAnnotation[] = arr
      .map((it) => {
        const item = it as Record<string, unknown>;
        const id = (item.boundingBoxID ?? item.id) as string | undefined;
        const labelID = (item.boundingBoxLabelID ?? '') as string | undefined;
        const label = getBoundingBoxLabelName(labelID) ?? (item.boundingBoxLabel as string) ?? (item.label as string) ?? '';
        const box = item.box as { x?: unknown; y?: unknown; width?: unknown; height?: unknown } | undefined;
        const x = typeof box?.x === 'number' ? (box.x as number) : undefined;
        const y = typeof box?.y === 'number' ? (box.y as number) : undefined;
        const w = typeof box?.width === 'number' ? (box.width as number) : undefined;
        const h = typeof box?.height === 'number' ? (box.height as number) : undefined;
        if (x == null || y == null || w == null || h == null) return null;
        const points = [
          { x: x, y: y },
          { x: x + w, y: y },
          { x: x + w, y: y + h },
          { x: x, y: y + h },
        ];
        const bb: BoundingBoxAnnotation = {
          id,
          label,
          labelID,
          points,
          projectID,
          imageID,
          addToDatabase() {
            /* no-op for loaded objects */
          },
        };
        return bb;
      })
      .filter((v): v is BoundingBoxAnnotation => Boolean(v));
    return normalized;
  },
};

export function createBoundingBox(label: string, points: Array<{ x: number; y: number }>): BoundingBoxAnnotation {
  const ann: BoundingBoxAnnotation = {
    label,
    points,
    async addToDatabase() {
      // TODO: implement when api routes are added
    },
  };
  void ann.addToDatabase();
  return ann;
}
