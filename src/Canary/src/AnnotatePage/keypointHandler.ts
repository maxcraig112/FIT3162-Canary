import * as fabric from "fabric";
import {
  fabricGroupProps,
  fabricKPMarkerProps,
  fabricKPProps,
} from "./constants";
import type { KeypointAnnotation } from "./constants";

export const keypointHandler = {
  // Render a persisted keypoint annotation as a Fabric group
  renderAnnotation(ann: KeypointAnnotation): { group: fabric.Group } {
    const p = ann.points[0];
    const marker = new fabric.Circle(fabricKPMarkerProps({ x: p.x, y: p.y }));
    const text = new fabric.FabricText(
      ann.label,
      fabricKPProps({ x: p.x, y: p.y })
    );
    const group = new fabric.Group([marker, text], fabricGroupProps);
    return { group };
  },

  // Create a temporary marker used during point placement before labeling
  createPendingMarker(x: number, y: number): fabric.Circle {
    return new fabric.Circle(fabricKPMarkerProps({ x, y }));
  },
  // Finalize a pending keypoint marker into a group and model (and persist via addToDatabase)
  finalizeCreate(
    marker: fabric.Circle,
    x: number,
    y: number,
    label: string
  ): { group: fabric.Group; annotation: KeypointAnnotation } {
    const text = new fabric.FabricText(label, fabricKPProps({ x, y }));
    marker.set({ ...fabricKPMarkerProps({ x, y }) });
    const group = new fabric.Group([marker, text], fabricGroupProps);
    const annotation = keypointHandler.createdKeyPoint(label, x, y);
    return { group, annotation };
  },
  // Factory to create a KeypointAnnotation instance with methods, and call addToDatabase
  createdKeyPoint(label: string, x: number, y: number): KeypointAnnotation {
    const kp: KeypointAnnotation = {
      label,
      points: [{ x, y }],
      async addToDatabase() {
        // TODO: implement persistence
      },
    };
    // Fire and forget for now
    void kp.addToDatabase();
    return kp;
  },
  // Back-compat alias
  createKeyPoint(label: string, x: number, y: number): KeypointAnnotation {
    return this.createdKeyPoint(label, x, y);
  },
};

export function createdKeyPoint(label: string, x: number, y: number) {
  return keypointHandler.createdKeyPoint(label, x, y);
}
