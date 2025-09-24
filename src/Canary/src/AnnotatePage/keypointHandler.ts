import * as fabric from 'fabric';
import { createKeypointAnnotation, fabricGroupProps, fabricKPMarkerProps, fabricKPProps } from './constants';
import type { KeypointAnnotation } from './constants';
import { getKeypointLabelIdByName, getKeypointLabelName } from './labelRegistry';
import { CallAPI } from '../utils/apis';

// Singleton instance for undo/redo
const baseUrl = import.meta.env.VITE_PROJECT_SERVICE_URL;

export const KeyPointFabricHandler = {
  createFabricKeyPoint(canvas: fabric.Canvas, ann: KeypointAnnotation): { group: fabric.Group } {
    const marker = new fabric.Circle(fabricKPMarkerProps(ann.position));
    const labelText = getKeypointLabelName(ann.labelID);
    const text = new fabric.FabricText(labelText, fabricKPProps(ann.position));
    const group = new fabric.Group([marker, text], fabricGroupProps);
    canvas.add(group);
    //canvas.requestRenderAll();
    return { group };
  },

  deleteFabricKeyPoint(canvas: fabric.Canvas, group: fabric.Group): void {
    canvas.remove(group);
    //canvas.requestRenderAll();
  },

  renameFabricKeyPoint(canvas: fabric.Canvas, group: fabric.Group, newLabel: string): void {
    const textObj = group.item(1) as fabric.Text;
    textObj.set({ text: newLabel });
    canvas.requestRenderAll();
  },

  updateFabricKeyPointPosition(canvas: fabric.Canvas, group: fabric.Group, newX: number, newY: number): void {
    const marker = group.item(0) as fabric.Circle;
    marker.set({ left: newX, top: newY });
    canvas.add(group);
    //canvas.requestRenderAll();
  },

  createPendingMarker(canvas: fabric.Canvas, x: number, y: number): fabric.Circle {
    const circle = new fabric.Circle(fabricKPMarkerProps({ x, y }));
    canvas.add(circle);
    //canvas.requestRenderAll();
    return circle;
  },
};

export const keypointDatabaseHandler = {
  // Create a key point in the database and get its ID
  async createdKeyPoint(ann: KeypointAnnotation): Promise<KeypointAnnotation> {
    const url = `${baseUrl}/projects/${ann.projectID}/images/${ann.imageID}/keypoints`;
    const requestBody = {
      position: ann.position,
      keypointLabelID: ann.labelID,
    };
    try {
      const result = await CallAPI(url, {
        method: 'POST',
        json: requestBody,
      });
      const newId = (result as { keypointID: string }).keypointID;
      if (!newId) throw new Error('No keypoint ID returned from server');
      ann.id = newId;
    } catch (err) {
      throw new Error(`Invalid JSON response: ${err}`);
    }

    console.log('Keypoint stored:', ann);
    return ann;
  },

  // Rename an existing keypoint's label in the database
  async renameKeyPoint(ann: KeypointAnnotation, newLabelID: string): Promise<KeypointAnnotation> {
    const url = `${baseUrl}/projects/${ann.projectID}/keypoints/${ann.id}`;
    const body = {
      keypointLabelID: getKeypointLabelIdByName(newLabelID),
    };
    try {
      await CallAPI(url, {
        method: 'PATCH',
        json: body,
        ignoreResponse: true,
      });
    } catch (err) {
      console.error(`Failed to rename keypoint ${ann.id}:`, err);
    }

    console.log(`Keypoint ${ann.id} renamed to label ${newLabelID}`);
    return { ...ann, labelID: newLabelID };
  },

  // Delete an existing keypoint in the database
  async deleteKeyPoint(ann: KeypointAnnotation): Promise<void> {
    const url = `${baseUrl}/projects/${ann.projectID}/keypoints/${ann.id}`;
    console.log('Deleting keypoint:', ann);
    console.log(`URL: ${url}`);
    try {
      await CallAPI(url, {
        method: 'DELETE',
        ignoreResponse: true,
      });
    } catch (err) {
      console.error(`Failed to delete keypoint ${ann.id}:`, err);
    }

    console.log('Keypoint deleted:', ann);
  },

  async getAllKeyPoints(projectID: string, imageID: string) {
    const url = `${baseUrl}/projects/${projectID}/images/${imageID}/keypoints`;
    let raw: unknown;
    try {
      raw = await CallAPI(url, { method: 'GET' });
    } catch (err) {
      throw new Error(`Failed to fetch keypoints for image ${imageID}: ${err}`);
    }
    const arr: unknown[] = Array.isArray(raw) ? raw : Array.isArray((raw as { items?: unknown[] })?.items) ? (raw as { items: unknown[] }).items : [];
    const normalized: KeypointAnnotation[] = arr
      .map((it) => {
        const item = it as Record<string, unknown>;
        const kp: KeypointAnnotation = createKeypointAnnotation({
          id: item.keypointID as string,
          labelID: item.keypointLabelID as string,
          position: item.position as { x: number; y: number },
          projectID,
          imageID,
        });
        return kp;
      })
      .filter((v): v is KeypointAnnotation => Boolean(v));
    console.log(`keypoints loaded:`, normalized);
    return normalized;
  },
};
