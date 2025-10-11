import * as fabric from 'fabric';
import type { BoundingBoxAnnotation, KeypointAnnotation } from '../utils/interfaces/interfaces';

export function createKeypointAnnotation(data: Omit<KeypointAnnotation, 'kind'>): KeypointAnnotation {
  return {
    kind: 'keypoint',
    ...data,
  };
}

export function createBoundingBoxAnnotation(data: Omit<BoundingBoxAnnotation, 'kind'>): BoundingBoxAnnotation {
  return {
    kind: 'boundingbox',
    ...data,
  };
}

export type LabelRequest = {
  kind: 'kp' | 'bb';
  x: number;
  y: number;
  mode: 'create' | 'edit';
  currentLabel?: string;
  boundingBoxID?: string;
  /**
   * When true, the request is only to reposition the existing open label/OK overlay (e.g. while dragging)
   * and the current typed value in the UI should be preserved (don't reset the input to currentLabel).
   */
  preserveLabel?: boolean;
};

export const fabricGroupProps = {
  selectable: true,
  evented: true,
  hasControls: false,
  lockScalingX: true,
  lockScalingY: true,
  lockRotation: true,
  lockMovementX: false,
  lockMovementY: false,
  hoverCursor: 'move',
  moveCursor: 'move',
  subTargetCheck: false,
};

export const fabricKPProps = (p: { x: number; y: number }): Partial<fabric.TextProps> => ({
  left: p.x + 12,
  top: p.y - 28,
  fill: '#0f172a',
  fontSize: 14,
  fontWeight: 600,
  fontFamily: 'Inter, "Segoe UI", sans-serif',
  backgroundColor: 'rgba(255,255,255,0.92)',
  padding: 4,
  hasControls: false,
  lockScalingX: true,
  lockScalingY: true,
  lockRotation: true,
  selectable: false,
  evented: false,
});

export const fabricKPMarkerProps = (p: { x: number; y: number }): Partial<fabric.CircleProps> => ({
  left: p.x,
  top: p.y,
  radius: 6,
  fill: '#f97316',
  stroke: '#ffffff',
  strokeWidth: 2,
  originX: 'center',
  originY: 'center',
  hasControls: false,
  lockScalingX: true,
  lockScalingY: true,
  lockRotation: true,
  selectable: false,
  evented: false,
});

export const fabricBBProps = (p: { x: number; y: number }): Partial<fabric.TextProps> => ({
  left: p.x + 12,
  top: p.y - 32,
  fill: '#0f172a',
  fontSize: 14,
  fontWeight: 600,
  fontFamily: 'Inter, "Segoe UI", sans-serif',
  backgroundColor: 'rgba(255,255,255,0.92)',
  padding: 4,
  hasControls: false,
  lockScalingX: true,
  lockScalingY: true,
  lockRotation: true,
  selectable: false,
  evented: false,
});

export const fabricBBColour = '#2563eb';
export const fabricBBMarkerProps = (p: { x: number; y: number }): Partial<fabric.CircleProps> => ({
  left: p.x,
  top: p.y,
  radius: 3,
  fill: fabricBBColour,
  stroke: '#ffffff',
  strokeWidth: 1.5,
  originX: 'center',
  originY: 'center',
  hasControls: false,
  lockScalingX: true,
  lockScalingY: true,
  lockRotation: true,
  selectable: false,
  evented: false,
});

export const fabricBBPolygonProps = {
  fill: 'rgba(37,99,235,0.14)',
  stroke: fabricBBColour,
  strokeWidth: 2,
  objectCaching: false,
  selectable: true,
  hasControls: false,
  lockScalingX: true,
  lockScalingY: true,
  lockRotation: true,
};

export const fabricBBRectProps = (size: { width: number; height: number }): Partial<fabric.RectProps> => ({
  left: 0,
  top: 0,
  width: Math.max(size.width, 1),
  height: Math.max(size.height, 1),
  rx: 6,
  ry: 6,
  fill: 'rgba(37,99,235,0.12)',
  stroke: fabricBBColour,
  strokeWidth: 2,
  objectCaching: false,
  selectable: false,
  evented: false,
});
