import { Canvas } from 'fabric';

export type ZoomHandlerOptions = {
  canvas: Canvas; // fabric.Canvas
};

export class ZoomHandler {
  private canvas: Canvas; // fabric.Canvas
  private zoom: number = 1;
  private minZoom: number = 0.1;
  private maxZoom: number = 8;

  constructor(options: ZoomHandlerOptions) {
    this.canvas = options.canvas;
  }

  getZoom() {
    return this.zoom;
  }

  setZoom(zoom: number, center: { x: number; y: number }, keepPosition = true) {
    zoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));
    this.zoom = zoom;
    const vt = this.canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
    let cx = vt[4];
    let cy = vt[5];
    if (!keepPosition) {
      // Reset to center
      const cw = this.canvas.getWidth();
      const ch = this.canvas.getHeight();
      cx = cw / 2 - zoom * (cw / 2);
      cy = ch / 2 - zoom * (ch / 2);
    } else if (center) {
      // Zoom around mouse
      const prevZoom = vt[0];
      cx -= center.x * (zoom - prevZoom);
      cy -= center.y * (zoom - prevZoom);
    }
    this.canvas.viewportTransform = [zoom, 0, 0, zoom, cx, cy];
    this.canvas.requestRenderAll();
  }

  zoomIn(center: { x: number; y: number }) {
    this.setZoom(this.zoom * 1.25, center, true);
  }

  zoomOut(center: { x: number; y: number }) {
    this.setZoom(this.zoom / 1.25, center, true);
  }

  resetZoom() {
    this.setZoom(1, { x: 0, y: 0 }, false);
  }

  attachWheelListener(onZoom: (zoom: number) => void) {
    const el = this.canvas.upperCanvasEl;
    el.addEventListener(
      'wheel',
      (e: WheelEvent) => {
        if (e.ctrlKey) return;
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        // Get mouse position in canvas coordinates, accounting for zoom/pan
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const vt = this.canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
        // Inverse transform: (screen - pan) / zoom
        const mouse = {
          x: (screenX - vt[4]) / vt[0],
          y: (screenY - vt[5]) / vt[3],
        };
        if (e.deltaY < 0) {
          this.zoomIn(mouse);
        } else {
          this.zoomOut(mouse);
        }
        if (onZoom) onZoom(this.zoom);
      },
      { passive: false },
    );
  }
}
