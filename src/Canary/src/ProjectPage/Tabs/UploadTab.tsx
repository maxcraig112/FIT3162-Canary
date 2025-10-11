import React, { useRef } from 'react';
import { Box, Button, Typography, LinearProgress, Alert, Fade, Stack, TextField } from '@mui/material';
import { useUploadTab } from './uploadTabHandler';
import type { Project } from '../../utils/interfaces/interfaces';
import { useAuthGuard } from '../../utils/authUtil';

interface UploadTabProps {
  project: Project | null;
}

export const UploadTab: React.FC<UploadTabProps> = ({ project }) => {
  useAuthGuard();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { uploading, message, error, dragActive, batchName, setBatchName, openPicker, handleFilesSelected, handleDragOver, handleDragLeave, handleDrop, clearMessage, clearError } =
    useUploadTab(project);

  return (
    <Box
      sx={{
        width: '100%',
        flexGrow: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        py: 4,
      }}
    >
      <Stack spacing={3} sx={{ width: '100%', maxWidth: 680 }}>
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
              color: '#000',
              bgcolor: '#fff',
              borderRadius: 2,
            },
          }}
          InputLabelProps={{
            sx: {
              color: '#999',
              '&.Mui-focused': { color: '#000' },
            },
          }}
          sx={{
            alignSelf: 'center',
            maxWidth: 480,
            '& .MuiOutlinedInput-notchedOutline': { borderColor: '#999' },
          }}
          placeholder={`Upload ${new Date().toLocaleDateString()}`}
        />
        <Fade in>
          <Box
            onDragOver={handleDragOver}
            onDragEnter={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => openPicker(() => inputRef.current?.click?.())}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openPicker(() => inputRef.current?.click?.());
              }
            }}
            sx={{
              cursor: uploading ? 'default' : 'pointer',
              border: '2px dashed',
              borderColor: dragActive ? '#666' : '#bbb',
              borderRadius: 4,
              bgcolor: dragActive ? '#fafafa' : '#fff',
              transition: 'border-color 0.2s, background-color 0.2s',
              minHeight: 260,
              outline: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              p: 4,
              textAlign: 'center',
              position: 'relative',
              '&:hover': {
                borderColor: '#888',
                backgroundColor: '#fcfcfc',
              },
              ...(uploading && {
                opacity: 0.7,
                pointerEvents: 'none',
              }),
            }}
          >
            <Typography variant="h5" sx={{ mb: 2, fontWeight: 600, color: '#111' }}>
              {project ? `Upload PNG/JPEG images & videos to "${project.projectName}"` : 'Loading project...'}
            </Typography>
            <Typography variant="body1" sx={{ maxWidth: 480, color: '#444', mb: 2 }}>
              Drag & drop PNG/JPEG images or videos here, or click to select from your computer. Other image formats (e.g. WebP) are not supported currently.
            </Typography>

            <Button
              variant="outlined"
              size="large"
              disabled={!project || uploading}
              onClick={(e) => {
                e.stopPropagation();
                openPicker(() => inputRef.current?.click?.());
              }}
              sx={{
                fontWeight: 600,
                textTransform: 'none',
                px: 4,
                py: 1.2,
                borderRadius: 3,
                borderStyle: 'solid',
                backgroundColor: '#f5f5f5',
                borderColor: '#999',
                color: '#222',
                '&:hover': {
                  backgroundColor: '#ececec',
                  borderColor: '#666',
                },
              }}
            >
              {uploading ? 'Uploading...' : 'Select PNG/JPEG/Videos'}
            </Button>

            {uploading && (
              <Box sx={{ mt: 4, width: '60%' }}>
                <LinearProgress />
                <Typography variant="caption" sx={{ display: 'block', mt: 1, color: '#555' }}>
                  Uploading...
                </Typography>
              </Box>
            )}

            <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/jpg,video/*" multiple hidden onChange={handleFilesSelected} />
          </Box>
        </Fade>

        {message && (
          <Alert severity="success" onClose={clearMessage} sx={{ borderRadius: 2 }}>
            {message}
          </Alert>
        )}
        {error && (
          <Alert severity="error" onClose={clearError} sx={{ borderRadius: 2 }}>
            {error}
          </Alert>
        )}
      </Stack>
    </Box>
  );
};
