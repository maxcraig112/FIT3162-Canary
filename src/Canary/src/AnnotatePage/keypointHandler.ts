import * as fabric from "fabric";
import {
  fabricGroupProps,
  fabricKPMarkerProps,
  fabricKPProps,
} from "./constants";
import type { KeypointAnnotation } from "./constants";
import { getAuthTokenFromCookie } from "../utils/cookieUtils";

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
    label: string,
    projectID?: string,
    imageID?: string
  ): { group: fabric.Group; annotation: KeypointAnnotation } {
    const text = new fabric.FabricText(label, fabricKPProps({ x, y }));
    marker.set({ ...fabricKPMarkerProps({ x, y }) });
    const group = new fabric.Group([marker, text], fabricGroupProps);
    const annotation = keypointHandler.createdKeyPoint(label, x, y, projectID, imageID);
    return { group, annotation };
  },
  // Factory to create a KeypointAnnotation instance with methods, and call addToDatabase
  createdKeyPoint(
    label: string,
    x: number,
    y: number,
    projectID?: string,
    imageID?: string
  ): KeypointAnnotation {
    const kp: KeypointAnnotation = {
      label,
      points: [{ x, y }],
      async addToDatabase() {
        if (!projectID || !imageID) return; // can't persist yet
        const baseUrl = import.meta.env.VITE_PROJECT_SERVICE_URL;
        const token = getAuthTokenFromCookie();
        const url = `${baseUrl}/projects/${projectID}/images/${imageID}/keypoints`;
        const requestBody = {
          position: { x, y },
          keypointLabelID: label, // TODO: map label text to keypointLabelID
        };
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(requestBody),
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(
            `Failed to create keypoint for image ${imageID}: ${res.status} ${res.statusText} - ${text}`
          );
        }

        // set ID from post request
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("application/json")) {
          try {
            const data = (await res.json()) as { keypointID?: string; id?: string };
            const newId = data.keypointID ?? data.id;
            if (newId) {
              kp.id = newId;
            }
          } catch {
            // ignore errors
          }
        }

        return;
      },
    };
    // Fire and forget for now
    void kp.addToDatabase();
    return kp;
  },
  // Back-compat alias
  createKeyPoint(
    label: string,
    x: number,
    y: number,
    projectID?: string
  ): KeypointAnnotation {
    return this.createdKeyPoint(label, x, y, projectID);
  },
};

export function createdKeyPoint(
  label: string,
  x: number,
  y: number,
  projectID?: string
) {
  return keypointHandler.createdKeyPoint(label, x, y, projectID);
}
