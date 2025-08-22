// src/Canary/src/AnnotatePage/annotateHandler.ts

import * as fabric from "fabric";
import { CallAPI } from "../utils/apis";

export type ImageMeta = {
  imageURL: string;
  imageName: string;
  batchID: string;
};

const cache = new Map<string, ImageMeta[]>();
// Cache Fabric images by their original imageURL (not the dev-proxied URL)
const imageCache = new Map<string, fabric.FabricImage>();
let currentImageNumber = 1; // 1-based
let totalImageCount = 0;
let canvasRef: fabric.Canvas | null = null;

function devRewriteURL(url: string): string {
  if (
    typeof window !== "undefined" &&
    window.location &&
    /localhost:5173$/.test(window.location.origin)
  ) {
    return url.replace(/^https?:\/\/storage\.googleapis\.com/, "/gcs");
  }
  return url;
}

async function fetchImagesForBatch(batchID: string): Promise<ImageMeta[]> {
  const baseUrl = import.meta.env.VITE_PROJECT_SERVICE_URL;
  const url = `${baseUrl}/batch/${batchID}/images`;

  // get all the image metadata from the firestore database
  return CallAPI<ImageMeta[]>(url);
}

export const annotateHandler = {
  // Canvas lifecycle
  createCanvas(el: HTMLCanvasElement): fabric.Canvas {
    if (canvasRef) {
      canvasRef.dispose();
      canvasRef = null;
    }
    canvasRef = new fabric.Canvas(el);
    return canvasRef;
  },
  disposeCanvas() {
    canvasRef?.dispose();
    canvasRef = null;
  },

  /** Optionally allow UI to set the current image number (1-based). */
  setCurrentImageNumber(n: number) {
    currentImageNumber = Math.max(1, Math.floor(n));
  },

  nextImage(setCurrentImage: React.Dispatch<React.SetStateAction<number>>) {
    if (totalImageCount <= 0) return currentImageNumber;
    currentImageNumber =
      currentImageNumber < totalImageCount ? currentImageNumber + 1 : 1;
    setCurrentImage(currentImageNumber);
  },

  prevImage(setCurrentImage: React.Dispatch<React.SetStateAction<number>>) {
    if (totalImageCount <= 0) return currentImageNumber;
    currentImageNumber =
      currentImageNumber > 1 ? currentImageNumber - 1 : totalImageCount;
    setCurrentImage(currentImageNumber);
  },

  /**
   * Loads and returns the image URL for the given batch and current image index.
   * Also updates internal totalImageCount and currentImageNumber.
   * Note: This returns the canonical imageURL. Fabric image instances are cached separately.
   */
  async loadImageURL(
    batchID: string,
    imageNumber: number,
  ): Promise<{ imageURL: string; total: number }> {
    if (!batchID) throw new Error("batchID is required");

    let images = cache.get(batchID);
    if (!images) {
      images = await fetchImagesForBatch(batchID);
      cache.set(batchID, images);
    }

    totalImageCount = images.length;
    if (totalImageCount === 0) {
      throw new Error("No images found for this batch");
    }

    const imageMetadata = images[imageNumber - 1];
    if (!imageMetadata || !imageMetadata.imageURL) {
      throw new Error("Invalid image metadata or imageURL not found");
    }
    return { imageURL: imageMetadata.imageURL, total: totalImageCount };
  },

  /**
   * Render the current image to the Fabric canvas, centered and scaled.
   * Uses an in-memory cache of FabricImage instances to avoid re-downloading.
   */
  async renderToCanvas(
    batchID: string,
  ): Promise<{ current: number; total: number }> {
    if (!canvasRef) throw new Error("Canvas not initialized");

    const { imageURL, total } = await this.loadImageURL(
      batchID,
      currentImageNumber,
    );

    // Try in-memory cache first
    let img = imageCache.get(imageURL);
    if (!img) {
      // this is used to get around CORS issues when developing locally
      const url = devRewriteURL(imageURL);
      img = await fabric.FabricImage.fromURL(url, { crossOrigin: "anonymous" });
      imageCache.set(imageURL, img);
    }

    const cw = canvasRef.getWidth();
    const ch = canvasRef.getHeight();
    if (!cw || !ch) return { current: currentImageNumber, total };

    const iw = img.width ?? 1;
    const ih = img.height ?? 1;
    const scale = Math.min(cw / iw, ch / ih);
    img.scale(scale);
    img.set({
      originX: "center",
      originY: "center",
      left: cw / 2,
      top: ch / 2,
    });

    canvasRef.backgroundImage = img;
    canvasRef.requestRenderAll();

    return { current: currentImageNumber, total };
  },
};
