import { useCallback, useState } from "react";
import { CallAPI } from "../../utils/apis";
import type { Project } from "../ProjectPage";

export function useUploadTab(project: Project | null) {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [batchName, setBatchName] = useState<string>("");

  const createBatch = useCallback(
    async (
      projectID: string,
      nameHint?: string,
    ): Promise<{ batchID: string; batchName: string }> => {
      const baseUrl = import.meta.env.VITE_PROJECT_SERVICE_URL as string;
      const url = `${baseUrl}/batch`;
      const finalName =
        (nameHint && nameHint.trim()) ||
        `Upload ${new Date().toLocaleString()}`;

      const text = await CallAPI<string>(url, {
        method: "POST",
        json: { projectID, batchName: finalName },
        parseJson: false,
      });

      const m = text?.match(/Batch\s+([A-Za-z0-9\-_]+)\s+created/i);
      const batchID = m?.[1] || text?.trim();
      if (!batchID) throw new Error("Failed to parse created batch ID.");
      return { batchID, batchName: finalName };
    },
    [],
  );

  const beginUpload = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files).filter((f) =>
        /^image\//i.test(f.type || ""),
      );
      if (!list.length) {
        setError("No image files selected.");
        return;
      }
      if (!project?.projectID) {
        setError("Project not loaded yet.");
        return;
      }

      setUploading(true);
      setError(null);
      setMessage(null);

      try {
        const { batchID, batchName: finalBatchName } = await createBatch(
          project.projectID,
          batchName,
        );

        const baseUrl = import.meta.env.VITE_PROJECT_SERVICE_URL as string;
        const url = `${baseUrl}/batch/${encodeURIComponent(batchID)}/images`;

        const formData = new FormData();
        list.forEach((f) => formData.append("images", f, f.name));

        await CallAPI<string>(url, {
          method: "POST",
          body: formData,
          parseJson: false,
        });

        setMessage(
          `Uploaded ${list.length} image${list.length === 1 ? "" : "s"} to batch "${finalBatchName}" (${batchID}).`,
        );
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to upload images.",
        );
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
      e.target.value = "";
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
        setError("Project not loaded yet.");
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
        setError("Project not loaded yet.");
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
