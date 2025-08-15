import type React from "react";
import * as fabric from "fabric";
import { getAuthTokenFromCookie } from "../utils/cookieUtils";

export type ImageMeta = {
  imageURL: string;
  imageName: string;
  batchID: string;
};

// Per-batch image list cache
const cache = new Map<string, ImageMeta[]>();

// Image position state (1-based index and total count)
let currentImageNumber = 1;
let totalImageCount = 0;

export function getCurrentImageNumber() {
  return currentImageNumber;
}

export function getTotalImageCount() {
  return totalImageCount;
}

export function setCurrentImageNumber(n: number) {
  currentImageNumber = Math.max(1, Math.floor(n));
}

async function fetchImagesForBatch(batchID: string): Promise<ImageMeta[]> {
  const baseUrl = import.meta.env.VITE_PROJECT_SERVICE_URL;
  const token = getAuthTokenFromCookie();
  const url = `${baseUrl}/batch/${batchID}/images`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Failed to fetch images for batch ${batchID}: ${res.status} ${res.statusText} - ${text}`
    );
  }

  const data = (await res.json()) as ImageMeta[];
  return data;
}

// Load and return the image URL for a given batch and image index
export async function loadImageURL(
  batchID: string,
  imageNumber: number
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
}

export function nextImage(
  setCurrentImage: React.Dispatch<React.SetStateAction<number>>
) {
  if (totalImageCount <= 0) return currentImageNumber;
  currentImageNumber =
    currentImageNumber < totalImageCount ? currentImageNumber + 1 : 1;
  setCurrentImage(currentImageNumber);
}

export function prevImage(
  setCurrentImage: React.Dispatch<React.SetStateAction<number>>
) {
  if (totalImageCount <= 0) return currentImageNumber;
  currentImageNumber =
    currentImageNumber > 1 ? currentImageNumber - 1 : totalImageCount;
  setCurrentImage(currentImageNumber);
}

// Dev helper to avoid CORS when running Vite locally against GCS
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

// Fabric image cache and loader
const fabricImageCache = new Map<string, fabric.FabricImage>();

export async function getFabricImage(
  imageURL: string
): Promise<fabric.FabricImage> {
  let img = fabricImageCache.get(imageURL);
  if (!img) {
    const url = devRewriteURL(imageURL);
    img = await fabric.FabricImage.fromURL(url, { crossOrigin: "anonymous" });
    fabricImageCache.set(imageURL, img);
  }
  return img;
}
