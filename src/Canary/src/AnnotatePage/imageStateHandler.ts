import * as fabric from 'fabric';
import { CallAPI, projectServiceUrl } from '../utils/apis';
import { devRewriteURL } from './helper';
import * as React from 'react';
import type { BoundingBoxAnnotation, KeypointAnnotation } from '../utils/interfaces/interfaces';

export type ImageMeta = {
  imageID: string;
  imageURL: string;
  imageName: string;
  batchID: string;
};

type ImageAnnotations = {
  kps: KeypointAnnotation[];
  bbs: BoundingBoxAnnotation[];
};

export function useImageHandler() {
  const [currentImageNumber, setCurrentImageNumber] = React.useState(1);
  const [currentImageURL, setCurrentImageURL] = React.useState<string>('');
  const [currentImageID, setCurrentImageID] = React.useState<string>('');
  const [totalImageCount, setTotalImageCount] = React.useState(0);

  const batchCache = React.useRef(new Map<string, ImageMeta[]>());
  const fabricImageCache = React.useRef(new Map<string, fabric.FabricImage>());
  const annotationStore = React.useRef(new Map<string, ImageAnnotations>());

  const getCurrentImageNumber = React.useCallback(() => currentImageNumber, [currentImageNumber]);
  const getTotalImageCount = React.useCallback(() => totalImageCount, [totalImageCount]);

  const setInputImage = React.useCallback(
    (input: string) => {
      const num = parseInt(input, 10);
      if (!isNaN(num)) {
        const clamp = (n: number) => Math.max(1, Math.min(n, totalImageCount));
        const clamped = clamp(num);
        setCurrentImageNumber(clamped);
      }
    },
    [totalImageCount],
  );

  const getInputImage = React.useCallback(() => currentImageNumber.toString(), [currentImageNumber]);

  const nextImage = React.useCallback(() => {
    if (totalImageCount <= 0) return currentImageNumber;
    const newNum = currentImageNumber < totalImageCount ? currentImageNumber + 1 : 1;
    setCurrentImageNumber(newNum);
    return newNum;
  }, [currentImageNumber, totalImageCount]);

  const prevImage = React.useCallback(() => {
    if (totalImageCount <= 0) return currentImageNumber;
    const newNum = currentImageNumber > 1 ? currentImageNumber - 1 : totalImageCount;
    setCurrentImageNumber(newNum);
    return newNum;
  }, [currentImageNumber, totalImageCount]);

  const goToImage = React.useCallback(
    (n: number) => {
      const total = totalImageCount;
      const clamped = Math.max(1, Math.min(n, total));
      setCurrentImageNumber(clamped);
      return clamped;
    },
    [totalImageCount],
  );

  const fetchImagesForBatch = React.useCallback(async (batchID: string): Promise<ImageMeta[]> => {
    const url = `${projectServiceUrl()}/batch/${batchID}/images`;
    try {
      const data = await CallAPI<ImageMeta[]>(url);
      data.sort((a, b) => a.imageName.localeCompare(b.imageName));
      return data;
    } catch (err) {
      throw new Error(`Failed to fetch images for batch ${batchID}: ${err}`);
    }
  }, []);

  const loadImageURL = React.useCallback(
    async (batchID: string, imageNumber: number): Promise<ImageMeta> => {
      if (!batchID) throw new Error('batchID is required');

      let images = batchCache.current.get(batchID);
      if (!images) {
        images = await fetchImagesForBatch(batchID);
        batchCache.current.set(batchID, images);
      }

      setTotalImageCount(images.length);

      if (images.length === 0) {
        throw new Error('No images found for this batch');
      }

      // Clamp requested image number into range [1, images.length]
      const clampedNumber = Math.max(1, Math.min(imageNumber, images.length));
      if (clampedNumber !== imageNumber) {
        setCurrentImageNumber(clampedNumber);
      }
      const imageMetadata = images[clampedNumber - 1];
      if (!imageMetadata || !imageMetadata.imageURL) {
        throw new Error('Invalid image metadata or imageURL not found');
      }

      setCurrentImageURL(imageMetadata.imageURL);
      setCurrentImageID(imageMetadata.imageID);
      return imageMetadata;
    },
    [fetchImagesForBatch],
  );

  const getFabricImage = React.useCallback(async (imageURL: string): Promise<fabric.FabricImage> => {
    let img = fabricImageCache.current.get(imageURL);
    if (!img) {
      const url = devRewriteURL(imageURL);
      img = await fabric.FabricImage.fromURL(url, {
        crossOrigin: 'anonymous',
      });
      fabricImageCache.current.set(imageURL, img);
    }
    return img;
  }, []);

  const getKeypoints = React.useCallback((): KeypointAnnotation[] => {
    if (!currentImageURL) return [];
    const s = annotationStore.current.get(currentImageURL);
    return s ? s.kps : [];
  }, [currentImageURL]);

  const getBoundingBoxes = React.useCallback((): BoundingBoxAnnotation[] => {
    if (!currentImageURL) return [];
    const s = annotationStore.current.get(currentImageURL);
    return s ? s.bbs : [];
  }, [currentImageURL]);

  const getAnnotationStoreForCurrent = React.useCallback((): ImageAnnotations => {
    if (!currentImageURL) throw new Error('currentImageURL is not set');
    const s = annotationStore.current.get(currentImageURL) ?? { kps: [], bbs: [] };
    return s;
  }, [currentImageURL]);

  return {
    currentImageNumber,
    totalImageCount,
    getCurrentImageNumber,
    getTotalImageCount,
    setCurrentImageNumber,
    setTotalImageCount,
    nextImage,
    prevImage,
    goToImage,
    fetchImagesForBatch,
    loadImageURL,
    getFabricImage,
    setInputImage,
    getInputImage,
    getKeypoints,
    getBoundingBoxes,
    currentImageURL,
    setCurrentImageURL,
    currentImageID,
    setCurrentImageID,
    getAnnotationStoreForCurrent,
    annotationStore: annotationStore.current, // expose stable ref
  };
}

export const imageDatabaseHandler = {
  async copyPrevAnnotations(imageID: string) {
    const url = `${projectServiceUrl()}/images/${imageID}/annotations/copy_previous`;
    try {
      await CallAPI(url, {
        method: 'POST',
      });
      // console.log(`[COPY] Copied annotations into image ${imageID}`, result);
    } catch (err) {
      console.error(`Failed to copy annotations for image ${imageID}:`, err);
    }
  },

  async hasPrevAnnotations(imageID: string): Promise<boolean> {
    const url = `${projectServiceUrl()}/images/${imageID}/previous`;
    try {
      const result = await CallAPI(url, {
        method: 'GET',
      });
      const has_prev = (result as { hasPrevious: boolean }).hasPrevious;

      return has_prev;
    } catch (err) {
      console.error(`Failed to check for prev image ${imageID}:`, err);
    }
    return false;
  },
};

// Convenience export for consumers that only need the instance type
export type ImageHandler = ReturnType<typeof useImageHandler>;
