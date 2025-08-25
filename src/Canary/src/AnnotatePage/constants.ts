import * as fabric from 'fabric';

// Shared annotation types
export interface KeypointAnnotation {
  projectID?: string;
  imageID?: string;
  id?: string;
  label: string;
  // single point kept as array for shape consistency
  points: Array<{ x: number; y: number }>;
}

export interface BoundingBoxAnnotation {
  projectID?: string;
  imageID?: string;
  id?: string;
  label: string;
  // rectangle represented as 4 points clockwise, starting top-left
  points: Array<{ x: number; y: number }>;
  addToDatabase(): Promise<void> | void;
}

export type LabelRequest = {
  kind: 'kp' | 'bb';
  x: number;
  y: number;
  mode: 'create' | 'edit';
  currentLabel?: string;
};

export const fabricGroupProps = {
  selectable: true,
  evented: true,
  hasControls: false,
  lockScalingX: true,
  lockScalingY: true,
  lockRotation: true,
  lockMovementX: true,
  lockMovementY: true,
  hoverCursor: 'default',
  moveCursor: 'default',
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
