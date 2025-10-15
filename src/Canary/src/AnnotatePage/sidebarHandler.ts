// src/Canary/src/AnnotatePage/sidebarHandler.ts

import { getBoundingBoxLabelName, getKeypointLabelName } from './labelRegistry';
import type { ImageHandler } from './imageStateHandler';
import type { BoundingBoxAnnotation, KeypointAnnotation } from '../utils/interfaces/interfaces';

export interface SidebarKeypointItem {
  id: string;
  label: string;
  position: { x: number; y: number };
  boundingBoxID: string | null;
  boundingBoxLabel?: string;
  type: 'keypoint';
}

export interface SidebarBoundingBoxItem {
  id: string;
  label: string;
  center: { x: number; y: number };
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  type: 'boundingbox';
}

export type SidebarAnnotationItem = SidebarKeypointItem | SidebarBoundingBoxItem;

type SidebarUpdateCallback = (items: SidebarAnnotationItem[]) => void;

type AnnotationCollection = {
  kps: KeypointAnnotation[];
  bbs: BoundingBoxAnnotation[];
};

type SidebarUpdateOptions = {
  imageURL?: string;
  keypoints?: KeypointAnnotation[];
  boundingBoxes?: BoundingBoxAnnotation[];
};

class SidebarHandler {
  private callbacks = new Set<SidebarUpdateCallback>();
  private currentItems: SidebarAnnotationItem[] = [];

  // Subscribe to sidebar updates
  subscribe(callback: SidebarUpdateCallback): () => void {
    this.callbacks.add(callback);
    // Immediately call with current items
    callback(this.currentItems);
    return () => this.callbacks.delete(callback);
  }

  // Update sidebar with current annotations
  updateSidebar(imageHandler: ImageHandler, options: SidebarUpdateOptions = {}) {
    const targetURL = options.imageURL ?? imageHandler.currentImageURL;

    if (!targetURL) {
      this.clearIfNeeded();
      return;
    }

    const annotations = this.resolveAnnotations(imageHandler, targetURL, options);
    if (!annotations) {
      this.clearIfNeeded();
      return;
    }

    const items = this.buildSidebarItems(annotations);
    this.commitItems(items);
  }

  private resolveAnnotations(imageHandler: ImageHandler, targetURL: string, options: SidebarUpdateOptions): AnnotationCollection | undefined {
    if (options.keypoints || options.boundingBoxes) {
      return {
        kps: options.keypoints ?? [],
        bbs: options.boundingBoxes ?? [],
      };
    }

    if (options.imageURL && options.imageURL !== imageHandler.currentImageURL) {
      return imageHandler.annotationStore.get(targetURL);
    }

    try {
      if (targetURL === imageHandler.currentImageURL) {
        return imageHandler.getAnnotationStoreForCurrent();
      }
    } catch (error) {
      console.warn('[SidebarHandler] Failed to resolve annotations from current image, falling back to store.', error);
    }

    return imageHandler.annotationStore.get(targetURL);
  }

  private buildSidebarItems(annotations: AnnotationCollection): SidebarAnnotationItem[] {
    const items: SidebarAnnotationItem[] = [];
    const boundingBoxItems = new Map<string, SidebarBoundingBoxItem>();

    for (const bb of annotations.bbs) {
      const labelName = getBoundingBoxLabelName(bb.labelID);
      if (labelName && bb.id) {
        const xs = bb.points.map((p) => p.x);
        const ys = bb.points.map((p) => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const centerX = Math.round((minX + maxX) / 2);
        const centerY = Math.round((minY + maxY) / 2);

        const item: SidebarBoundingBoxItem = {
          id: bb.id,
          label: labelName,
          center: { x: centerX, y: centerY },
          bounds: {
            minX: Math.round(minX),
            minY: Math.round(minY),
            maxX: Math.round(maxX),
            maxY: Math.round(maxY),
          },
          type: 'boundingbox',
        };
        boundingBoxItems.set(bb.id, item);
      }
    }

    const groupedKeypoints = new Map<string, SidebarKeypointItem[]>();
    const orphanKeypoints: SidebarKeypointItem[] = [];

    for (const kp of annotations.kps) {
      const labelName = getKeypointLabelName(kp.labelID);
      if (!labelName || !kp.id) continue;

      const keypointItem: SidebarKeypointItem = {
        id: kp.id,
        label: labelName,
        position: { x: Math.round(kp.position.x), y: Math.round(kp.position.y) },
        boundingBoxID: kp.boundingBoxID || null,
        type: 'keypoint',
      };

      if (kp.boundingBoxID && boundingBoxItems.has(kp.boundingBoxID)) {
        const bboxItem = boundingBoxItems.get(kp.boundingBoxID)!;
        keypointItem.boundingBoxLabel = bboxItem.label;
        const arr = groupedKeypoints.get(kp.boundingBoxID) ?? [];
        arr.push(keypointItem);
        groupedKeypoints.set(kp.boundingBoxID, arr);
      } else {
        orphanKeypoints.push(keypointItem);
      }
    }

    const sortedBoundingBoxes = [...boundingBoxItems.values()].sort((a, b) => a.label.localeCompare(b.label));

    for (const bboxItem of sortedBoundingBoxes) {
      items.push(bboxItem);
      const kps = groupedKeypoints.get(bboxItem.id);
      if (kps && kps.length > 0) {
        kps.sort((a, b) => a.label.localeCompare(b.label));
        items.push(...kps);
      }
    }

    if (orphanKeypoints.length > 0) {
      orphanKeypoints.sort((a, b) => a.label.localeCompare(b.label));
      items.push(...orphanKeypoints);
    }

    return items;
  }

  private commitItems(items: SidebarAnnotationItem[]) {
    if (this.hasItemsChanged(items)) {
      this.currentItems = items;
      this.notifySubscribers();
    }
  }

  private clearIfNeeded() {
    if (this.currentItems.length > 0) {
      this.currentItems = [];
      this.notifySubscribers();
    }
  }

  // Helper method to check if items have changed
  private hasItemsChanged(newItems: SidebarAnnotationItem[]): boolean {
    if (this.currentItems.length !== newItems.length) {
      return true;
    }

    // Check if any item has changed
    for (let i = 0; i < newItems.length; i++) {
      const current = this.currentItems[i];
      const newItem = newItems[i];

      if (!current || current.id !== newItem.id || current.label !== newItem.label || current.type !== newItem.type) {
        return true;
      }

      // Check position/bounds for changes
      if (current.type === 'keypoint' && newItem.type === 'keypoint') {
        if (
          current.position.x !== newItem.position.x ||
          current.position.y !== newItem.position.y ||
          current.boundingBoxID !== newItem.boundingBoxID ||
          current.boundingBoxLabel !== newItem.boundingBoxLabel
        ) {
          return true;
        }
      } else if (current.type === 'boundingbox' && newItem.type === 'boundingbox') {
        if (
          current.center.x !== newItem.center.x ||
          current.center.y !== newItem.center.y ||
          current.bounds.minX !== newItem.bounds.minX ||
          current.bounds.minY !== newItem.bounds.minY ||
          current.bounds.maxX !== newItem.bounds.maxX ||
          current.bounds.maxY !== newItem.bounds.maxY
        ) {
          return true;
        }
      }
    }

    return false;
  }

  // Get current sidebar items
  getCurrentItems(): SidebarAnnotationItem[] {
    return [...this.currentItems];
  }

  // Clear sidebar
  clear() {
    this.currentItems = [];
    this.notifySubscribers();
  }

  private notifySubscribers() {
    for (const callback of this.callbacks) {
      try {
        callback([...this.currentItems]);
      } catch (error) {
        console.error('[SidebarHandler] Error in subscriber callback:', error);
      }
    }
  }
}

// Export singleton instance
export const sidebarHandler = new SidebarHandler();
