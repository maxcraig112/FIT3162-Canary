import { useCallback, useState } from 'react';
import { CallAPI, projectServiceUrl } from '../../utils/apis';
import type { Project } from '../../utils/intefaces/interfaces';

const DEFAULT_FRAME_INTERVAL = 1;

interface PreparedFile {
  file: File;
  sanitizedName: string;
  kind: 'image' | 'video';
}

interface PreparedVideoWithDuration extends PreparedFile {
  kind: 'video';
  duration: number;
}

interface PendingUpload {
  files: PreparedFile[];
  videos: PreparedVideoWithDuration[];
}

export interface VideoOptionTarget {
  sanitizedName: string;
  originalName: string;
  duration: number;
}

export interface VideoOptionSubmission {
  sanitizedName: string;
  frameInterval: number;
  startTime: number;
  endTime: number;
  maxFrames: number | null;
}

const loadVideoDuration = (file: File): Promise<number> =>
  new Promise((resolve, reject) => {
    const blobUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    let resolved = false;

    const cleanup = () => {
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(blobUrl);
    };

    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      resolved = true;
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      cleanup();
      resolve(duration > 0 ? duration : 0);
    };
    video.onerror = () => {
      if (!resolved) {
        cleanup();
        reject(new Error('Failed to read video metadata.'));
      }
    };

    video.src = blobUrl;
  });

export function useUploadTab(project: Project | null) {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [batchName, setBatchName] = useState<string>('');
  const [pendingUpload, setPendingUpload] = useState<PendingUpload | null>(null);
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);

  const createBatch = useCallback(async (projectID: string, nameHint?: string): Promise<{ batchID: string; batchName: string }> => {
    const url = `${projectServiceUrl()}/batch`;
    const finalName = (nameHint && nameHint.trim()) || `Upload ${new Date().toLocaleString('en-GB')}`;

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

  const finalizeUpload = useCallback(
    async (preparedFiles: PreparedFile[], submittedVideoOptions?: VideoOptionSubmission[]) => {
      if (!preparedFiles.length) {
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
        const videos = preparedFiles.filter((file): file is PreparedFile & { kind: 'video' } => file.kind === 'video');
        const images = preparedFiles.filter((file) => file.kind === 'image');

        const optionLookup = new Map<string, VideoOptionSubmission>();
        submittedVideoOptions?.forEach((opt) => optionLookup.set(opt.sanitizedName, opt));

        const configsToSend = videos.map((video) => {
          const option = optionLookup.get(video.sanitizedName);
          const frameInterval = option && Number.isFinite(option.frameInterval) && option.frameInterval > 0 ? option.frameInterval : DEFAULT_FRAME_INTERVAL;
          const startTime = option && Number.isFinite(option.startTime) && option.startTime > 0 ? option.startTime : 0;
          const hasValidEnd = option && Number.isFinite(option.endTime) && option.endTime > startTime;
          const endTime = hasValidEnd && option ? option.endTime : 0;
          const maxFrames = option && option.maxFrames !== null && Number.isFinite(option.maxFrames) && option.maxFrames > 0 ? option.maxFrames : null;
          return {
            fileName: video.sanitizedName,
            frameInterval,
            startTime,
            endTime,
            maxFrames,
          };
        });

        images.forEach((image) => {
          formData.append('images', image.file, image.sanitizedName);
        });

        videos.forEach((video) => {
          formData.append('videos', video.file, video.sanitizedName);
        });

        if (configsToSend.length) {
          formData.append('videoConfigs', JSON.stringify(configsToSend));
        }

        await CallAPI<string>(url, {
          method: 'POST',
          body: formData,
          parseJson: false,
        });

        const imageCount = images.length;
        const videoCount = videos.length;
        setMessage(`Uploaded ${imageCount} image${imageCount !== 1 ? 's' : ''} and ${videoCount} video${videoCount !== 1 ? 's' : ''} to batch "${finalBatchName}" (${batchID}).`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to upload files.');
      } finally {
        setUploading(false);
        setPendingUpload(null);
        setVideoDialogOpen(false);
      }
    },
    [batchName, createBatch, project?.projectID],
  );

  const processSelectedFiles = useCallback(
    async (files: FileList | File[]) => {
      if (!project?.projectID) {
        setError('Project not loaded yet.');
        return;
      }
      if (pendingUpload) {
        setError('Finish configuring the current video upload before adding more files.');
        return;
      }
      if (uploading) {
        return;
      }
      setError(null);
      setMessage(null);
      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];

      const prepared: PreparedFile[] = [];
      const invalidFiles: string[] = [];

      Array.from(files).forEach((file) => {
        const fileType = file.type.toLowerCase();
        const fileName = file.name.toLowerCase();
        const sanitizedName = sanitizeFileName(file.name);

        if (fileType.startsWith('video/')) {
          prepared.push({ file, sanitizedName, kind: 'video' });
        } else if (allowedTypes.includes(fileType)) {
          prepared.push({ file, sanitizedName, kind: 'image' });
        } else if ((fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) && fileType.startsWith('image/')) {
          prepared.push({ file, sanitizedName, kind: 'image' });
        } else {
          if (fileType.startsWith('image/')) {
            const format = fileType.replace('image/', '').toUpperCase();
            invalidFiles.push(`${file.name} (${format} format not supported)`);
          } else {
            invalidFiles.push(`${file.name} (unsupported file type)`);
          }
        }
      });

      if (invalidFiles.length > 0) {
        const fileWord = invalidFiles.length === 1 ? 'file' : 'files';
        setError(`The following ${fileWord} ${invalidFiles.length === 1 ? 'is' : 'are'} not supported: ${invalidFiles.join(', ')}. Only PNG, JPEG, and video files are allowed.`);
        return;
      }

      const videos = prepared.filter((file): file is PreparedFile & { kind: 'video' } => file.kind === 'video');
      if (videos.length > 0) {
        try {
          const videosWithDuration: PreparedVideoWithDuration[] = await Promise.all(
            videos.map(async (video) => ({
              ...video,
              duration: await loadVideoDuration(video.file),
            })),
          );
          if (videosWithDuration.some((video) => !Number.isFinite(video.duration) || video.duration <= 0)) {
            setError('Unable to determine video duration. Please check the video file and try again.');
            return;
          }
          setPendingUpload({ files: prepared, videos: videosWithDuration });
          setVideoDialogOpen(true);
          return;
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to read video metadata.');
          return;
        }
      }

      if (!prepared.length) {
        setError('No supported files selected. Only PNG, JPEG, and video files are allowed.');
        return;
      }

      await finalizeUpload(prepared);
    },
    [finalizeUpload, pendingUpload, project?.projectID, sanitizeFileName, uploading],
  );

  const submitVideoOptions = useCallback(
    async (options: VideoOptionSubmission[]) => {
      if (!pendingUpload) {
        return;
      }
      if (options.length !== pendingUpload.videos.length) {
        setError('Video configuration is incomplete.');
        return;
      }
      setVideoDialogOpen(false);
      await finalizeUpload(pendingUpload.files, options);
    },
    [finalizeUpload, pendingUpload],
  );

  const cancelVideoOptions = useCallback(() => {
    if (pendingUpload) {
      setMessage('Video upload cancelled.');
    }
    setError(null);
    setPendingUpload(null);
    setVideoDialogOpen(false);
  }, [pendingUpload]);

  const handleFilesSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        await processSelectedFiles(files);
      }
      e.target.value = '';
    },
    [processSelectedFiles],
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
        await processSelectedFiles(e.dataTransfer.files);
        e.dataTransfer.clearData();
      }
    },
    [processSelectedFiles, project],
  );

  const openPicker = useCallback(
    (click: () => void) => {
      if (!project) {
        setError('Project not loaded yet.');
        return;
      }
      if (uploading || pendingUpload) {
        return;
      }
      setError(null);
      setMessage(null);
      click();
    },
    [pendingUpload, project, uploading],
  );

  const videoTargets: VideoOptionTarget[] = pendingUpload?.videos.map((video) => ({
    sanitizedName: video.sanitizedName,
    originalName: video.file.name,
    duration: video.duration,
  })) ?? [];

  return {
    // state
    uploading,
    message,
    error,
    dragActive,
    batchName,
    setBatchName,
    videoDialogOpen,
    videoTargets,
    // actions
    openPicker,
    handleFilesSelected,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    submitVideoOptions,
    cancelVideoOptions,
    clearMessage: () => setMessage(null),
    clearError: () => setError(null),
  } as const;
}
