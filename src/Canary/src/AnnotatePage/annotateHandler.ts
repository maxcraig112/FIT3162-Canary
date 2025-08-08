// src/Canary/src/AnnotatePage/annotateHandler.ts

import * as fabric from "fabric";
import { getAuthTokenFromCookie } from "../utils/cookieUtils";

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
  if (!baseUrl) throw new Error("VITE_PROJECT_SERVICE_URL is not set");
  const token = getAuthTokenFromCookie();
  const url = `${baseUrl}/batch/${encodeURIComponent(batchID)}/images`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Failed to fetch images for batch ${batchID}: ${res.status} ${res.statusText} - ${text}`,
    );
  }
  const data = (await res.json()) as ImageMeta[];
  return data || [];
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

  /** Gets the current image number (1-based). */
  getCurrentImageNumber(): number {
    return currentImageNumber;
  },

  /** Gets the total number of images for the current batch (if loaded). */
  getTotalImageCount(): number {
    return totalImageCount;
  },

  /** Optionally allow UI to set the current image number (1-based). */
  setCurrentImageNumber(n: number) {
    currentImageNumber = Math.max(1, Math.floor(n));
  },

  nextImage(): number {
    if (totalImageCount <= 0) return currentImageNumber;
    currentImageNumber = currentImageNumber < totalImageCount ? currentImageNumber + 1 : 1;
    return currentImageNumber;
  },

  prevImage(): number {
    if (totalImageCount <= 0) return currentImageNumber;
    currentImageNumber = currentImageNumber > 1 ? currentImageNumber - 1 : totalImageCount;
    return currentImageNumber;
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

    currentImageNumber = Math.min(
      Math.max(1, Math.floor(imageNumber || 1)),
      totalImageCount,
    );

    const idx = currentImageNumber - 1; // convert to 0-based
    const meta = images[idx];
    if (!meta || !meta.imageURL) {
      throw new Error("Invalid image metadata or imageURL not found");
    }
    return { imageURL: meta.imageURL, total: totalImageCount };
  },

  /**
   * Render the current image to the Fabric canvas, centered and scaled.
   * Uses an in-memory cache of FabricImage instances to avoid re-downloading.
   */
  async renderToCanvas(batchID: string): Promise<{ current: number; total: number }> {
    if (!canvasRef) throw new Error("Canvas not initialized");

    const { imageURL, total } = await this.loadImageURL(
      batchID,
      this.getCurrentImageNumber(),
    );

    // Try in-memory cache first
    let img = imageCache.get(imageURL);
    if (!img) {
      const url = devRewriteURL(imageURL);
      img = await fabric.FabricImage.fromURL(url, { crossOrigin: "anonymous" });
      imageCache.set(imageURL, img);
    }

    const cw = canvasRef.getWidth();
    const ch = canvasRef.getHeight();
    if (!cw || !ch) return { current: this.getCurrentImageNumber(), total };

    const iw = img.width ?? 1;
    const ih = img.height ?? 1;
    const scale = Math.min(cw / iw, ch / ih);
    img.scale(scale);
    img.set({ originX: "center", originY: "center", left: cw / 2, top: ch / 2 });

    canvasRef.backgroundImage = img;
    canvasRef.requestRenderAll();

    return { current: this.getCurrentImageNumber(), total };
  },
};
