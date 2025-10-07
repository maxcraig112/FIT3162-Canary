import * as fabric from 'fabric';
import type { BoundingBoxAnnotation, KeypointAnnotation } from '../utils/intefaces/interfaces';

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
  left: p.x + 10,
  top: p.y - 8,
  fill: '#222',
  fontSize: 14,
  backgroundColor: 'rgba(255,255,255,0.6)',
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
  radius: 4,
  fill: '#ff1744',
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
  left: p.x + 8,
  top: p.y - 8,
  fill: '#222',
  fontSize: 14,
  backgroundColor: 'rgba(255,255,255,0.6)',
  hasControls: false,
  lockScalingX: true,
  lockScalingY: true,
  lockRotation: true,
  selectable: false,
  evented: false,
});

export const fabricBBColour = '#2979ff';
export const fabricBBMarkerProps = (p: { x: number; y: number }): Partial<fabric.CircleProps> => ({
  left: p.x,
  top: p.y,
  radius: 3,
  fill: fabricBBColour,
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
  fill: 'rgba(41,121,255,0.15)',
  stroke: fabricBBColour,
  strokeWidth: 2,
  objectCaching: false,
  selectable: true,
  hasControls: false,
  lockScalingX: true,
  lockScalingY: true,
  lockRotation: true,
};
