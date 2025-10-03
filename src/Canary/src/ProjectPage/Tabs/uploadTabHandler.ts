import { useCallback, useState } from 'react';
import { CallAPI, projectServiceUrl } from '../../utils/apis';
import type { Project } from '../../utils/intefaces/interfaces';

export function useUploadTab(project: Project | null) {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [batchName, setBatchName] = useState<string>('');

  const createBatch = useCallback(async (projectID: string, nameHint?: string): Promise<{ batchID: string; batchName: string }> => {
    const url = `${projectServiceUrl()}/batch`;
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

  // Allow only letters, numbers, '-' and '_' in the basename; preserve a clean extension if present
  const sanitizeFileName = useCallback((name: string): string => {
    const trimmed = (name || '').trim();
    const dot = trimmed.lastIndexOf('.');
    let base = dot > 0 ? trimmed.slice(0, dot) : trimmed;
    let ext = dot > 0 ? trimmed.slice(dot + 1) : '';
    base = base
      .replace(/[^A-Za-z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (!base) base = 'image';
    ext = ext.replace(/[^A-Za-z0-9]/g, '');
    return ext ? `${base}.${ext.toLowerCase()}` : base;
  }, []);

  const beginUpload = useCallback(
    async (files: FileList | File[]) => {
      // Validate file types - only allow PNG, JPEG, and video files
      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];

      const validFiles: File[] = [];
      const invalidFiles: string[] = [];

      Array.from(files).forEach((file) => {
        const fileType = file.type.toLowerCase();
        const fileName = file.name.toLowerCase();

        // Check for video files (allow all video types)
        if (fileType.startsWith('video/')) {
          validFiles.push(file);
        }
        // Check for specifically allowed image types
        else if (allowedTypes.includes(fileType)) {
          validFiles.push(file);
        }
        // Also check file extension as backup for JPEG files
        else if ((fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) && fileType.startsWith('image/')) {
          validFiles.push(file);
        } else {
          // Identify the problematic file type for better error messaging
          if (fileType.startsWith('image/')) {
            const format = fileType.replace('image/', '').toUpperCase();
            invalidFiles.push(`${file.name} (${format} format not supported)`);
          } else {
            invalidFiles.push(`${file.name} (unsupported file type)`);
          }
        }
      });

      // Show error for invalid files
      if (invalidFiles.length > 0) {
        const fileWord = invalidFiles.length === 1 ? 'file' : 'files';
        setError(`The following ${fileWord} ${invalidFiles.length === 1 ? 'is' : 'are'} not supported: ${invalidFiles.join(', ')}. Only PNG, JPEG, and video files are allowed.`);
        return;
      }

      const list = validFiles;
      if (!list.length) {
        setError('No supported files selected. Only PNG, JPEG, and video files are allowed.');
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
        const url = `${projectServiceUrl()}/batch/${encodeURIComponent(batchID)}/images`;

        const formData = new FormData();
        list.forEach((f) => {
          const clean = sanitizeFileName(f.name);
          if (/^image\//i.test(f.type)) {
            formData.append('images', f, clean);
          } else if (/^video\//i.test(f.type)) {
            formData.append('videos', f, clean);
          }
        });

        await CallAPI<string>(url, {
          method: 'POST',
          body: formData,
          parseJson: false,
        });

        const imageCount = list.filter((f) => /^image\//i.test(f.type)).length;
        const videoCount = list.filter((f) => /^video\//i.test(f.type)).length;
        setMessage(`Uploaded ${imageCount} image${imageCount !== 1 ? 's' : ''} and ${videoCount} video${videoCount !== 1 ? 's' : ''} to batch "${finalBatchName}" (${batchID}).`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to upload files.');
      } finally {
        setUploading(false);
      }
    },
    [batchName, createBatch, project?.projectID, sanitizeFileName],
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
