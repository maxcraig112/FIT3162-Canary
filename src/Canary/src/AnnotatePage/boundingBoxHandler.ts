import * as fabric from "fabric";
import {
  fabricBBPolygonProps,
  fabricBBProps,
  fabricGroupProps,
  fabricBBMarkerProps,
} from "./constants";
import type { BoundingBoxAnnotation } from "./constants";
// import { getAuthTokenFromCookie } from "../utils/cookieUtils";

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
    const text = new fabric.FabricText(
      ann.label,
      fabricBBProps({ x: c.x, y: c.y })
    );
    const group = new fabric.Group([poly, text], fabricGroupProps);
    return { group };
  },
  // Create a temporary point marker during rectangle creation
  createPointMarker(x: number, y: number): fabric.Circle {
    return new fabric.Circle(fabricBBMarkerProps({ x, y }));
  },
  // From two clicked points, compute a normalized axis-aligned rectangle polygon and its centroid
  polygonFromTwoPoints(
    p1: { x: number; y: number },
    p2: { x: number; y: number }
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
    imageID?: string
  ): {
    group: fabric.Group;
    annotation: BoundingBoxAnnotation;
  } {
    const c = polygonCentroid(points);
    const text = new fabric.FabricText(
      label,
      fabricBBProps({ x: c.x, y: c.y })
    );
    const group = new fabric.Group([polygon, text], fabricGroupProps);
  const annotation: BoundingBoxAnnotation = {
      label,
      points,
      async addToDatabase() {
    // TODO: implement persistence using projectID
    // Likely endpoint (tbd): POST /projects/{projectID}/images/{imageID}/boxes
        void projectID;
        void imageID;
      },
    };
    void annotation.addToDatabase();
    return { group, annotation };
  },
};

export function createBoundingBox(
  label: string,
  points: Array<{ x: number; y: number }>
): BoundingBoxAnnotation {
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
