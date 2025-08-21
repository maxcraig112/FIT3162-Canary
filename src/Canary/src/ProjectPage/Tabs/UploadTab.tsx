import React, { useRef, useState, useCallback } from "react";
import {
  Box,
  Button,
  Typography,
  LinearProgress,
  Alert,
  Fade,
  Stack,
  TextField,
} from "@mui/material";
import { CallAPI } from "../../utils/apis";
import type { Project } from "../ProjectPage";

interface UploadTabProps {
  project: Project | null;
}

export const UploadTab: React.FC<UploadTabProps> = ({ project }) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [batchName, setBatchName] = useState<string>("");

  function openPicker() {
    if (!project) {
      setError("Project not loaded yet.");
      return;
    }
    setError(null);
    setMessage(null);
    inputRef.current?.click();
  }

  async function createBatch(
    projectID: string,
    nameHint?: string,
  ): Promise<{ batchID: string; batchName: string }> {
    const baseUrl = import.meta.env.VITE_PROJECT_SERVICE_URL as string;
    const url = `${baseUrl}/batch`;
    const batchName =
      (nameHint && nameHint.trim()) || `Upload ${new Date().toLocaleString()}`;

    // Endpoint returns plain text "Batch <id> created"
    const text = await CallAPI<string>(url, {
      method: "POST",
      json: { projectID, batchName },
      parseJson: false,
    });

    // Try to extract the ID robustly
    const m = text?.match(/Batch\s+([A-Za-z0-9\-_]+)\s+created/i);
    const batchID = m?.[1] || text?.trim();
    if (!batchID) throw new Error("Failed to parse created batch ID.");
    return { batchID, batchName };
  }

  const beginUpload = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => /^image\//i.test(f.type || ""));
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
      // 1) Create a new batch automatically (use optional user-provided name)
      const { batchID, batchName: finalBatchName } = await createBatch(
        project.projectID,
        batchName,
      );

      // 2) Upload images to that batch
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
      setError(err instanceof Error ? err.message : "Failed to upload images.");
    } finally {
      setUploading(false);
    }
  };

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files && files.length > 0) {
      await beginUpload(files);
    }
    e.target.value = "";
  }

  // Drag & drop handlers
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
    [project],
  );

  return (
    <Box
      sx={{
        width: "100%",
        flexGrow: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        py: 4,
      }}
    >
      <Stack spacing={3} sx={{ width: "100%", maxWidth: 680 }}>
        {/* Batch name input OUTSIDE the clickable dropzone */}
        <TextField
          label="Batch name (optional)"
          size="small"
          fullWidth
          value={batchName}
          disabled={uploading}
          onChange={(e) => setBatchName(e.target.value)}
          variant="outlined"
          InputProps={{
            sx: {
              color: "#000",
              bgcolor: "#fff",
              borderRadius: 2,
            },
          }}
          InputLabelProps={{
            sx: {
              color: "#000",
              "&.Mui-focused": { color: "#000" },
            },
          }}
          sx={{
            alignSelf: "center",
            maxWidth: 480,
            "& .MuiOutlinedInput-notchedOutline": { borderColor: "#999" },
            "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#666" },
            "& .Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#666" },
          }}
          placeholder={`Upload ${new Date().toLocaleDateString()}`}
        />
        <Fade in>
          <Box
            onDragOver={handleDragOver}
            onDragEnter={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={openPicker}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openPicker();
              }
            }}
            sx={{
              cursor: uploading ? "default" : "pointer",
              border: "2px dashed",
              borderColor: dragActive ? "#666" : "#bbb",
              borderRadius: 4,
              bgcolor: dragActive ? "#fafafa" : "#fff",
              transition: "border-color 0.2s, background-color 0.2s",
              minHeight: 260,
              outline: "none",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              p: 4,
              textAlign: "center",
              position: "relative",
              "&:hover": {
                borderColor: "#888",
                backgroundColor: "#fcfcfc",
              },
              ...(uploading && {
                opacity: 0.7,
                pointerEvents: "none",
              }),
            }}
          >
            <Typography variant="h5" sx={{ mb: 2, fontWeight: 600, color: "#111" }}>
              {project ? `Upload images to "${project.projectName}"` : "Loading project..."}
            </Typography>
            <Typography variant="body1" sx={{ maxWidth: 480, color: "#444", mb: 2 }}>
              Drag & drop images here or click to select from your computer.
            </Typography>

            <Button
              variant="outlined"
              size="large"
              disabled={!project || uploading}
              onClick={(e) => {
                e.stopPropagation();
                openPicker();
              }}
              sx={{
                fontWeight: 600,
                textTransform: "none",
                px: 4,
                py: 1.2,
                borderRadius: 3,
                borderStyle: "solid",
                backgroundColor: "#f5f5f5",
                borderColor: "#999",
                color: "#222",
                "&:hover": {
                  backgroundColor: "#ececec",
                  borderColor: "#666",
                },
              }}
            >
              {uploading ? "Uploading..." : "Select Images"}
            </Button>

            {uploading && (
              <Box sx={{ mt: 4, width: "60%" }}>
                <LinearProgress />
                <Typography variant="caption" sx={{ display: "block", mt: 1, color: "#555" }}>
                  Uploading...
                </Typography>
              </Box>
            )}

            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={handleFilesSelected}
            />
          </Box>
        </Fade>

        {message && (
          <Alert severity="success" onClose={() => setMessage(null)} sx={{ borderRadius: 2 }}>
            {message}
          </Alert>
        )}
        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ borderRadius: 2 }}>
            {error}
          </Alert>
        )}
      </Stack>
    </Box>
  );
};