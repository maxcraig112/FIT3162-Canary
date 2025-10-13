import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack, Typography, TextField, Divider } from '@mui/material';
import type { VideoOptionSubmission, VideoOptionTarget } from './uploadTabHandler';

interface VideoOptionsDialogProps {
  open: boolean;
  videos: VideoOptionTarget[];
  onConfirm: (options: VideoOptionSubmission[]) => void;
  onCancel: () => void;
}

interface VideoOptionFormState extends VideoOptionTarget {
  frameInterval: number;
  startTime: number;
  endTime: number;
  maxFrames: string;
}

interface VideoOptionValidationState {
  frameIntervalError?: string;
  startError?: string;
  endError?: string;
  maxFramesError?: string;
  hasError: boolean;
}

const formatDuration = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 'Unknown duration';
  }
  if (seconds < 60) {
    return `${seconds.toFixed(2)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds - minutes * 60;
  return `${minutes}m ${remainder.toFixed(2)}s`;
};

export const VideoOptionsDialog: React.FC<VideoOptionsDialogProps> = ({ open, videos, onConfirm, onCancel }) => {
  const [formState, setFormState] = useState<VideoOptionFormState[]>([]);

  useEffect(() => {
    if (!open) {
      setFormState([]);
      return;
    }
    setFormState(
      videos.map((video) => ({
        ...video,
        frameInterval: 1,
        startTime: 0,
        endTime: Number.isFinite(video.duration) && video.duration > 0 ? Number(video.duration.toFixed(3)) : 0,
        maxFrames: '',
      })),
    );
  }, [open, videos]);

  const validation = useMemo<VideoOptionValidationState[]>(
    () =>
      formState.map((entry) => {
        const result: VideoOptionValidationState = { hasError: false };

        if (!Number.isFinite(entry.frameInterval) || entry.frameInterval < 1) {
          result.frameIntervalError = 'Enter a value ≥ 1';
          result.hasError = true;
        }

        if (!Number.isFinite(entry.startTime) || entry.startTime < 0) {
          result.startError = 'Start time must be ≥ 0';
          result.hasError = true;
        } else if (entry.startTime >= entry.duration) {
          result.startError = 'Start time must be within the video duration';
          result.hasError = true;
        }

        if (!Number.isFinite(entry.endTime) || entry.endTime <= entry.startTime) {
          result.endError = 'End time must be greater than start time';
          result.hasError = true;
        } else if (entry.endTime > entry.duration + 1e-3) {
          result.endError = `End time cannot exceed ${entry.duration.toFixed(2)}s`;
          result.hasError = true;
        }

        if (entry.maxFrames.trim().length > 0) {
          const frames = Number(entry.maxFrames);
          if (!Number.isFinite(frames) || frames <= 0) {
            result.maxFramesError = 'Enter a positive number or leave blank for all frames';
            result.hasError = true;
          }
        }

        return result;
      }),
    [formState],
  );

  const updateEntry = (index: number, patch: Partial<VideoOptionFormState> | ((prev: VideoOptionFormState) => Partial<VideoOptionFormState>)) => {
    setFormState((prev) =>
      prev.map((entry, idx) => {
        if (idx !== index) {
          return entry;
        }
        const resolvedPatch = typeof patch === 'function' ? patch(entry) : patch;
        return { ...entry, ...resolvedPatch };
      }),
    );
  };

  const handleIntervalChange = (index: number, value: string) => {
    const parsed = Number(value);
    updateEntry(index, {
      frameInterval: Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : NaN,
    });
  };

  const handleStartTimeChange = (index: number, value: string) => {
    const parsed = Number(value);
    updateEntry(index, (prev) => {
      const safe = Number.isFinite(parsed) ? Math.max(0, Math.min(parsed, prev.duration)) : 0;
      const adjustedEnd = safe >= prev.endTime ? Math.min(prev.duration, safe === prev.duration ? prev.duration : prev.endTime) : prev.endTime;
      return { startTime: Number(safe.toFixed(3)), endTime: Number(adjustedEnd.toFixed(3)) } as Partial<VideoOptionFormState>;
    });
  };

  const handleEndTimeChange = (index: number, value: string) => {
    const parsed = Number(value);
    updateEntry(index, (prev) => {
      const minEnd = Math.max(prev.startTime + 0.01, prev.startTime);
      const safe = Number.isFinite(parsed) ? Math.max(minEnd, Math.min(parsed, prev.duration)) : prev.duration;
      return { endTime: Number(safe.toFixed(3)) } as Partial<VideoOptionFormState>;
    });
  };

  const handleMaxFramesChange = (index: number, value: string) => {
    const cleaned = value.replace(/[^0-9]/g, '');
    updateEntry(index, { maxFrames: cleaned });
  };

  const confirmDisabled = formState.length === 0 || validation.some((item) => item.hasError);

  const handleConfirm = () => {
    if (confirmDisabled) {
      return;
    }

    const payload: VideoOptionSubmission[] = formState.map((entry) => {
      const frames = entry.maxFrames.trim().length > 0 ? Number(entry.maxFrames) : null;
      return {
        sanitizedName: entry.sanitizedName,
        frameInterval: Math.max(1, Math.floor(entry.frameInterval)),
        startTime: Number(entry.startTime.toFixed(3)),
        endTime: Number(entry.endTime.toFixed(3)),
        maxFrames: frames && Number.isFinite(frames) && frames > 0 ? Math.floor(frames) : null,
      };
    });

    onConfirm(payload);
  };

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="md" fullWidth>
      <DialogTitle sx={{ color: '#000' }}>Configure video processing</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          <Typography variant="body2" color="#000">
            Set how frames should be extracted for each uploaded video. Defaults capture every frame for the full duration.
          </Typography>
          {formState.map((video, index) => {
            const errors = validation[index];
            const showDivider = index < formState.length - 1;
            return (
              <React.Fragment key={`${video.sanitizedName}-${index}`}>
                <Stack spacing={2}>
                  <Stack spacing={0.5}>
                    <Typography variant="subtitle1" fontWeight={600} sx={{ color: '#000' }}>
                      {video.originalName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Duration: {formatDuration(video.duration)}
                    </Typography>
                  </Stack>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                    <TextField
                      label="Frame cadence"
                      type="number"
                      value={Number.isFinite(video.frameInterval) ? video.frameInterval : ''}
                      onChange={(e) => handleIntervalChange(index, e.target.value)}
                      error={Boolean(errors?.frameIntervalError)}
                      helperText={errors?.frameIntervalError ?? 'Extract every Nth frame'}
                      size="small"
                      inputProps={{ min: 1, step: 1 }}
                      InputProps={{
                        sx: {
                          color: '#000',
                          bgcolor: '#fff',
                        },
                      }}
                      InputLabelProps={{
                        sx: {
                          color: '#999',
                          '&.Mui-focused': { color: '#000' },
                        },
                      }}
                      sx={{
                        minWidth: 180,
                        alignSelf: 'center',
                        maxWidth: 480,
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: '#999' },
                        mb: "0.5rem",
                        mt: "0.5rem",
                      }}
                    />
                    <TextField
                      label="Start time (s)"
                      type="number"
                      value={video.startTime}
                      onChange={(e) => handleStartTimeChange(index, e.target.value)}
                      error={Boolean(errors?.startError)}
                      helperText={errors?.startError ?? 'Beginning of extraction'}
                      size="small"
                      inputProps={{ min: 0, max: video.duration, step: 0.1 }}
                      InputProps={{
                        sx: {
                          color: '#000',
                          bgcolor: '#fff',
                        },
                      }}
                      InputLabelProps={{
                        sx: {
                          color: '#999',
                          '&.Mui-focused': { color: '#000' },
                        },
                      }}
                      sx={{
                        minWidth: 160,
                        alignSelf: 'center',
                        maxWidth: 480,
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: '#999' },
                        mb: "0.5rem",
                        mt: "0.5rem",
                      }}
                    />
                    <TextField
                      label="End time (s)"
                      type="number"
                      value={video.endTime}
                      onChange={(e) => handleEndTimeChange(index, e.target.value)}
                      error={Boolean(errors?.endError)}
                      helperText={errors?.endError ?? 'Exclusive end time'}
                      size="small"
                      inputProps={{ min: 0, max: video.duration, step: 0.1 }}
                      InputProps={{
                        sx: {
                          color: '#000',
                          bgcolor: '#fff',
                        },
                      }}
                      InputLabelProps={{
                        sx: {
                          color: '#999',
                          '&.Mui-focused': { color: '#000' },
                        },
                      }}
                      sx={{
                        minWidth: 160,
                        alignSelf: 'center',
                        maxWidth: 480,
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: '#999' },
                        mb: "0.5rem",
                        mt: "0.5rem",
                      }}
                    />
                    <TextField
                      label="Max frames"
                      type="number"
                      value={video.maxFrames}
                      onChange={(e) => handleMaxFramesChange(index, e.target.value)}
                      error={Boolean(errors?.maxFramesError)}
                      helperText={errors?.maxFramesError ?? 'Leave blank for all frames'}
                      size="small"
                      inputProps={{ min: 1, step: 1 }}
                      InputProps={{
                        sx: {
                          color: '#000',
                          bgcolor: '#fff',
                        },
                      }}
                      InputLabelProps={{
                        sx: {
                          color: '#999',
                          '&.Mui-focused': { color: '#000' },
                        },
                      }}
                      sx={{
                        minWidth: 180,
                        alignSelf: 'center',
                        maxWidth: 480,
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: '#999' },
                        mb: "0.5rem",
                        mt: "0.5rem",
                      }}
                    />
                  </Stack>
                </Stack>
                {showDivider && <Divider flexItem />}
              </React.Fragment>
            );
          })}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} color="secondary" variant="outlined">
          Cancel
        </Button>
        <Button onClick={handleConfirm} variant="contained" disabled={confirmDisabled}>
          Save & Upload
        </Button>
      </DialogActions>
    </Dialog>
  );
};
