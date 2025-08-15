import * as fabric from 'fabric';
import { fabricGroupProps, fabricKPMarkerProps, fabricKPProps } from './constants';
import type { KeypointAnnotation } from './constants';
import { getAuthTokenFromCookie } from '../utils/cookieUtils';

export const keypointHandler = {
    // Render a persisted keypoint annotation as a Fabric group
    renderAnnotation(ann: KeypointAnnotation): { group: fabric.Group } {
        const p = ann.points[0];
        const marker = new fabric.Circle(fabricKPMarkerProps({ x: p.x, y: p.y }));
        const text = new fabric.FabricText(ann.label, fabricKPProps({ x: p.x, y: p.y }));
        const group = new fabric.Group([marker, text], fabricGroupProps);
        return { group };
    },
    // Rename an existing keypoint's label in the backend (PATCH)
    async renameKeyPoint(ann: KeypointAnnotation, newLabel: string): Promise<void> {
        console.log(ann);
        if (!ann.projectID || !ann.id) return;
        const baseUrl = import.meta.env.VITE_PROJECT_SERVICE_URL;
        const token = getAuthTokenFromCookie();
        const url = `${baseUrl}/projects/${ann.projectID}/keypoints/${ann.id}`;
        const p = ann.points[0] ?? { x: 0, y: 0 };
        const body = {
            position: { x: p.x, y: p.y },
            keypointLabelID: newLabel, // TODO: map text -> label ID
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
            // Non-blocking error; UI already updated text locally
            console.error(`Failed to rename keypoint ${ann.id}: ${res.status} ${res.statusText} - ${text}`);
        }
    },
    // Delete an existing keypoint in the backend (DELETE)
    async deleteKeyPoint(ann: KeypointAnnotation): Promise<void> {
        if (!ann.projectID || !ann.id) return;
        const baseUrl = import.meta.env.VITE_PROJECT_SERVICE_URL;
        const token = getAuthTokenFromCookie();
        const url = `${baseUrl}/projects/${ann.projectID}/keypoints/${ann.id}`;
        const res = await fetch(url, {
            method: 'DELETE',
            headers: {
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
        });
        if (!res.ok) {
            const text = await res.text();
            console.error(`Failed to delete keypoint ${ann.id}: ${res.status} ${res.statusText} - ${text}`);
        }
    },

    // Create a temporary marker used during point placement before labeling
    createPendingMarker(x: number, y: number): fabric.Circle {
        return new fabric.Circle(fabricKPMarkerProps({ x, y }));
    },
    // Finalize a pending keypoint marker into a group and model (and persist via addToDatabase)
    finalizeCreate(marker: fabric.Circle, x: number, y: number, label: string, projectID?: string, imageID?: string): { group: fabric.Group; annotation: KeypointAnnotation } {
        const text = new fabric.FabricText(label, fabricKPProps({ x, y }));
        marker.set({ ...fabricKPMarkerProps({ x, y }) });
        const group = new fabric.Group([marker, text], fabricGroupProps);
        const annotation = keypointHandler.createdKeyPoint(label, x, y, projectID, imageID);
        return { group, annotation };
    },

    // Factory to create a KeypointAnnotation instance with methods, and call addToDatabase
    createdKeyPoint(label: string, x: number, y: number, projectID?: string, imageID?: string): KeypointAnnotation {
        const kp: KeypointAnnotation = {
            label,
            points: [{ x, y }],
            async addToDatabase() {
                if (!projectID || !imageID) return;

                kp.projectID = projectID;
                kp.imageID = imageID;

                const baseUrl = import.meta.env.VITE_PROJECT_SERVICE_URL;
                const token = getAuthTokenFromCookie();
                const url = `${baseUrl}/projects/${projectID}/images/${imageID}/keypoints`;

                const requestBody = {
                    position: { x, y },
                    keypointLabelID: label,
                };

                const res = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                    body: JSON.stringify(requestBody),
                });

                if (!res.ok) {
                    const text = await res.text();
                    throw new Error(`Failed to create keypoint for image ${imageID}: ${res.status} ${res.statusText} - ${text}`);
                }

                try {
                    const data = await res.json();
                    const newId = data?.keypointID || data?.id;
                    if (!newId) throw new Error('No keypoint ID returned from server');
                    kp.id = newId;
                } catch (err) {
                    throw new Error(`Invalid JSON response: ${err}`);
                }

                console.log('Keypoint stored:', kp);
            },
        };
        // Fire and forget for now
        void kp.addToDatabase();
        return kp;
    },
    // Back-compat alias
    createKeyPoint(label: string, x: number, y: number, projectID?: string): KeypointAnnotation {
        return this.createdKeyPoint(label, x, y, projectID);
    },
};

export function createdKeyPoint(label: string, x: number, y: number, projectID?: string) {
    return keypointHandler.createdKeyPoint(label, x, y, projectID);
}
