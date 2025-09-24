// imagehandlercontext.tsx
import React, { createContext, useContext } from 'react';
import { useImageHandler } from './imageStateHandler';

type ImageHandler = ReturnType<typeof useImageHandler>;

let singleton: ImageHandler | null = null;

const ImageHandlerContext = createContext<ImageHandler | null>(null);

export const ImageHandlerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const handler = useImageHandler();

  if (!singleton) {
    singleton = handler;
  }

  return (
    <ImageHandlerContext.Provider value={handler}>
      {children}
    </ImageHandlerContext.Provider>
  );
};

export function useSharedImageHandler(): ImageHandler {
  const ctx = useContext(ImageHandlerContext);
  if (!ctx) throw new Error('useSharedImageHandler must be used inside <ImageHandlerProvider>');
  return ctx;
}

export function getImageHandlerInstance(): ImageHandler {
  if (!singleton) throw new Error('ImageHandler not initialized (wrap with <ImageHandlerProvider>)');
  return singleton;
}
