import { useCallback, useState } from 'react';
import { CallAPI } from '../../utils/apis';
import type { Project } from '../ProjectPage';

export function useUploadTab(project: Project | null) {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [batchName, setBatchName] = useState<string>('');

  const createBatch = useCallback(async (projectID: string, nameHint?: string): Promise<{ batchID: string; batchName: string }> => {
    const baseUrl = import.meta.env.VITE_PROJECT_SERVICE_URL as string;
    const url = `${baseUrl}/batch`;
    const finalName = (nameHint && nameHint.trim()) || `Upload ${new Date().toLocaleString()}`;

    const data = await CallAPI<{
      batchID?: string;
      message?: string;
      created?: boolean;
    }>(url, {
      method: 'POST',
      json: { projectID, batchName: finalName },
    });

    const batchID = data?.batchID;
    if (!batchID || typeof batchID !== 'string') {
      throw new Error('Failed to parse created batch ID.');
    }
    return { batchID, batchName: finalName };
  }, []);

const beginUpload = useCallback(
  async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => /^(image|video)\//i.test(f.type || ''));
    if (!list.length) {
      setError('No image or video files selected.');
      return;
    }
    if (!project?.projectID) {
      setError('Project not loaded yet.');
      return;
    }

    setUploading(true);
    setError(null);
    setMessage(null);

    try {
      const { batchID, batchName: finalBatchName } = await createBatch(project.projectID, batchName);
      const baseUrl = import.meta.env.VITE_PROJECT_SERVICE_URL as string;
      const url = `${baseUrl}/batch/${encodeURIComponent(batchID)}/images`;

      const formData = new FormData();
      list.forEach(f => {
        if (/^image\//i.test(f.type)) formData.append('images', f, f.name);
        else if (/^video\//i.test(f.type)) formData.append('videos', f, f.name);
      });

      await CallAPI<string>(url, {
        method: 'POST',
        body: formData,
        parseJson: false,
      });

      const imageCount = list.filter(f => /^image\//i.test(f.type)).length;
      const videoCount = list.filter(f => /^video\//i.test(f.type)).length;
      setMessage(`Uploaded ${imageCount} image${imageCount !== 1 ? 's' : ''} and ${videoCount} video${videoCount !== 1 ? 's' : ''} to batch "${finalBatchName}" (${batchID}).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload files.');
    } finally {
      setUploading(false);
    }
  },
  [batchName, createBatch, project?.projectID],
);

  const handleFilesSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        await beginUpload(files);
      }
      e.target.value = '';
    },
    [beginUpload],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!dragActive) setDragActive(true);
    },
    [dragActive],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) setDragActive(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (!project) {
        setError('Project not loaded yet.');
        return;
      }
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        await beginUpload(e.dataTransfer.files);
        e.dataTransfer.clearData();
      }
    },
    [beginUpload, project],
  );

  const openPicker = useCallback(
    (click: () => void) => {
      if (!project) {
        setError('Project not loaded yet.');
        return;
      }
      setError(null);
      setMessage(null);
      click();
    },
    [project],
  );

  return {
    // state
    uploading,
    message,
    error,
    dragActive,
    batchName,
    setBatchName,
    // actions
    openPicker,
    handleFilesSelected,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    clearMessage: () => setMessage(null),
    clearError: () => setError(null),
  } as const;
}
