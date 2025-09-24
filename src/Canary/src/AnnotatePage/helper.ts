import * as fabric from 'fabric';
import { fabricBBPolygonProps } from './constants';

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
// From two clicked points, compute a normalized axis-aligned rectangle polygon and its centroid
export function polygonFromTwoPoints(
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
}

export function getCentreOfCanvas(canvas: fabric.Canvas): { x: number; y: number } {
  return {
    x: canvas.getWidth() / 2,
    y: canvas.getHeight() / 2,
  };
}

// Route all GCS requests through same-origin /gcs proxy (handled by Vite dev or NGINX) to avoid CORS
export function devRewriteURL(url: string): string {
  return url.replace(/^https?:\/\/storage\.googleapis\.com/, '/gcs');
}
