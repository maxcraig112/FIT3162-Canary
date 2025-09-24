import React, { useState, useEffect, useRef } from 'react';
import { Box, AppBar, Toolbar, Typography, ToggleButtonGroup, ToggleButton, Paper, IconButton, Button, FormControl, InputLabel, Select, MenuItem, TextField } from '@mui/material';
import { MyLocation, SelectAll, NotInterested, KeyboardArrowLeft, KeyboardArrowRight } from '@mui/icons-material';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import { annotateHandler, getCanvas, handleUndoRedo } from './annotateHandler';
import { ZoomHandler } from './zoomHandler';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useSearchParams } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { getBoundingBoxLabelNames, getKeypointLabelNames } from './labelRegistry';
import { getCentreOfCanvas } from './helper';
import { useAuthGuard } from '../utils/authUtil';
// import { useSharedImageHandler } from './imagehandlercontext';
import { useImageHandler } from './imageStateHandler';

const AnnotatePage: React.FC = () => {
  // Helper for undo/redo actions
  // Type guards

  useAuthGuard();

  const navigate = useNavigate();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageHandler = useImageHandler();
  // Ensure annotateHandler uses the same imageHandler instance
  useEffect(() => {
    annotateHandler.setImageHandler(imageHandler);
  });

  // inputImage is the value in the text box, separate from currentImageNumber
  const [inputImage, setInputImage] = useState(imageHandler.currentImageNumber.toString());
  const [selectedTool, setSelectedTool] = useState<string | null>('kp');
  const [searchParams] = useSearchParams();
  const batchID = searchParams.get('batchID') || '';
  const projectID = searchParams.get('projectID') || '';
  if (!batchID) {
    throw new Error('No batchID specified in URL');
  }
  if (!projectID) {
    throw new Error('No projectID specified in URL');
  }

  const [labelPrompt, setLabelPrompt] = useState<{
    open: boolean;
    kind: 'kp' | 'bb' | null;
    x: number;
    y: number;
    mode?: 'create' | 'edit';
  }>({ open: false, kind: null, x: 0, y: 0, mode: 'create' });
  const [labelValue, setLabelValue] = useState('');
  const [kpOptions, setKpOptions] = useState<string[]>([]);
  const [bbOptions, setBbOptions] = useState<string[]>([]);

  const boxRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const zoomHandlerRef = useRef<ZoomHandler | null>(null);

  useEffect(() => {
    const boxEl = boxRef.current as HTMLDivElement | null;
    const canvasEl = canvasRef.current as HTMLCanvasElement | null;
    if (boxEl && canvasEl) {
      const { offsetWidth, offsetHeight } = boxEl;
      canvasEl.width = offsetWidth;
      canvasEl.height = offsetHeight;
    }
  }, []);

  // Initialize canvas via handler
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    annotateHandler.createCanvas(el);
    // Setup zoom handler
    zoomHandlerRef.current = new ZoomHandler({ canvas: getCanvas()! });
    zoomHandlerRef.current.attachWheelListener((newZoom) => setZoom(newZoom));
    setZoom(zoomHandlerRef.current.getZoom());
    return () => {
      annotateHandler.disposeCanvas();
      zoomHandlerRef.current = null;
    };
  }, []);

  // Render when batchID or currentImage changes
  useEffect(() => {
    async function render() {
      if (!batchID || !projectID) return;
      if (!getCanvas()) {
        console.error('Canvas not initialized yet');
        return;
      }

      try {
        const { current } = await annotateHandler.  renderToCanvas(batchID, projectID);
        imageHandler.setCurrentImageNumber(current);
        setInputImage(current.toString());
      } catch (e) {
        console.error(e);
      }
    }

    render();
    // Re-render when current image number changes
  }, [imageHandler.currentImageNumber]);

  // Keep handler tool selection in sync with UI
  useEffect(() => {
    const t = selectedTool;
    if (t === 'kp' || t === 'bb') annotateHandler.setTool(t);
    else annotateHandler.setTool('none');
  }, [selectedTool]);

  // Load labels when projectID changes
  // useEffect(() => {
  //   (async () => {
  //     setKpOptions(getKeypointLabelNames());
  //     setBbOptions(getBoundingBoxLabelNames());
  //   })();
  // }, [searchParams, projectID]);

  // Subscribe to label requests from handler
  useEffect(() => {
    const unsub = annotateHandler.subscribeLabelRequests((req) => {
      // if we already have a value, keep it; otherwise default to first option of relevant list
      const opts = req.kind === 'kp' ? getKeypointLabelNames() : getBoundingBoxLabelNames();
      setKpOptions(getKeypointLabelNames());
      setBbOptions(getBoundingBoxLabelNames());
      const initial = req.currentLabel && opts.includes(req.currentLabel) ? req.currentLabel : opts[0] || '';
      setLabelValue(initial);
      setLabelPrompt({
        open: true,
        kind: req.kind === 'kp' ? 'kp' : 'bb',
        x: req.x,
        y: req.y,
        mode: req.mode ?? 'create',
      });
    });
    return () => {
      unsub();
    };
  }, []);

  // Undo/Redo keydown handler
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndoRedo('undo');
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleUndoRedo('redo');
      }
      if ((e.key === 'Backspace' || e.key === 'Delete') && labelPrompt.mode === 'edit') {
        e.preventDefault();
        annotateHandler.deleteSelected();
        setLabelPrompt({ open: false, kind: null, x: 0, y: 0, mode: 'create' });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [labelPrompt.open, labelPrompt.mode, searchParams]);

  const handleToolChange = (_event: React.MouseEvent<HTMLElement>, newTool: string | null) => {
    if (newTool !== null) setSelectedTool(newTool);
  };

  const handlePrev = () => {
    imageHandler.prevImage();
  };

  const handleNext = () => {
    imageHandler.nextImage();
  };

  // Zoom button handlers
  const handleZoomIn = () => {
    if (zoomHandlerRef.current) {
      const canvas = getCanvas();
      if (canvas) {
        const center = getCentreOfCanvas(canvas);
        zoomHandlerRef.current.zoomIn(center);
        setZoom(zoomHandlerRef.current.getZoom());
      }
    }
  };
  const handleZoomOut = () => {
    if (zoomHandlerRef.current) {
      const canvas = getCanvas();
      if (canvas) {
        const center = getCentreOfCanvas(canvas);
        zoomHandlerRef.current.zoomOut(center);
        setZoom(zoomHandlerRef.current.getZoom());
      }
    }
  };
  const handleZoomReset = () => {
    if (zoomHandlerRef.current) {
      zoomHandlerRef.current.resetZoom();
      setZoom(zoomHandlerRef.current.getZoom());
    }
  };

  return (
    <Box sx={{ display: 'flex', height: '100vh', bgcolor: '#f5f5f5' }}>
      {/* Left Sidebar */}
      <Paper elevation={2} sx={{ width: '200px', p: 2 }}>
        <Typography variant="h6">Tools</Typography>
        {/* Placeholder for left sidebar content */}
      </Paper>

      {/* Main Content */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Top Toolbar */}
        <AppBar position="static" color="default" elevation={1}>
          <Toolbar sx={{ position: 'relative', minHeight: 64 }}>
            {/* Back Button Top Left */}
            <IconButton
              aria-label="back"
              edge="start"
              sx={{ position: 'absolute', left: 8, top: 8 }}
              onClick={() => {
                if (projectID) {
                  navigate(`/projects/${projectID}`);
                } else {
                  navigate(-1);
                }
              }}
            >
              <ExitToAppIcon />
            </IconButton>
            <Box
              sx={{
                flexGrow: 1,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <IconButton aria-label="previous image" onClick={handlePrev}>
                <KeyboardArrowLeft />
              </IconButton>
              <Paper
                elevation={2}
                sx={{
                  px: 2,
                  py: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <TextField
                  size="small"
                  type="number"
                  value={inputImage}
                  inputProps={{ style: { textAlign: 'center', width: 60 } }}
                  sx={{ width: 60 }}
                  onChange={(e) => {
                    setInputImage(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      imageHandler.setInputImage(inputImage);
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  onBlur={() => {
                    imageHandler.setInputImage(inputImage);
                  }}
                />
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  /{imageHandler.getTotalImageCount()}
                </Typography>
              </Paper>
              <IconButton aria-label="next image" onClick={handleNext}>
                <KeyboardArrowRight />
              </IconButton>
            </Box>
            {/* Zoom Controls Top Right */}
            <Box sx={{ position: 'absolute', right: 16, top: 8, display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconButton aria-label="zoom out" size="small" onClick={handleZoomOut}>
                <RemoveIcon />
              </IconButton>
              <Typography variant="body2" sx={{ minWidth: 40, textAlign: 'center' }}>
                {Math.round(zoom * 100)}%
              </Typography>
              <IconButton aria-label="zoom in" size="small" onClick={handleZoomIn}>
                <AddIcon />
              </IconButton>
              <IconButton aria-label="reset zoom" size="small" onClick={handleZoomReset}>
                <RefreshIcon />
              </IconButton>
            </Box>
          </Toolbar>
        </AppBar>

        {/* Canvas */}
        <Box
          sx={{
            flexGrow: 1,
            position: 'relative',
            p: 2,
            height: '100%',
            maxHeight: 'calc(100vh - 64px)', // subtract toolbar height if needed
            maxWidth: '100vw',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          ref={boxRef}
        >
          {/* Width/height are set programmatically in useEffect to match container; rely on style for initial sizing */}
          <canvas
            ref={canvasRef}
            style={{
              width: '100%',
              height: '100%',
              display: 'block',
              maxWidth: '100%',
              maxHeight: '100%',
            }}
          />
          {labelPrompt.open && (
            <Paper
              elevation={3}
              sx={{
                position: 'absolute',
                left: labelPrompt.x + 12,
                top: labelPrompt.y + 12,
                p: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <InputLabel id="label-select">{labelPrompt.kind === 'kp' ? 'Keypoint label' : 'Box label'}</InputLabel>
                <Select
                  labelId="label-select"
                  label={labelPrompt.kind === 'kp' ? 'Keypoint label' : 'Box label'}
                  autoFocus
                  value={labelValue}
                  onChange={(e) => setLabelValue(e.target.value as string)}
                >
                  {(labelPrompt.kind === 'kp' ? kpOptions : bbOptions).map((opt) => (
                    <MenuItem key={opt} value={opt}>
                      {opt}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                variant="contained"
                size="small"
                onClick={() => {
                  if (labelValue) {
                    annotateHandler.confirmLabel(labelValue, projectID);
                  } else {
                    annotateHandler.cancelLabel();
                  }
                  setLabelPrompt({
                    open: false,
                    kind: null,
                    x: 0,
                    y: 0,
                    mode: 'create',
                  });
                }}
              >
                OK
              </Button>
              <Button
                variant="text"
                size="small"
                onClick={() => {
                  annotateHandler.cancelLabel();
                  setLabelPrompt({
                    open: false,
                    kind: null,
                    x: 0,
                    y: 0,
                    mode: 'create',
                  });
                }}
              >
                Cancel
              </Button>
            </Paper>
          )}
        </Box>
      </Box>

      {/* Right Sidebar */}
      <Paper
        elevation={2}
        sx={{
          width: 120,
          minWidth: 120,
          maxWidth: 120,
          flexShrink: 0,
          p: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
        }}
      >
        <ToggleButtonGroup orientation="vertical" value={selectedTool} exclusive onChange={handleToolChange} aria-label="tool selection" sx={{ alignItems: 'center', gap: 2 }}>
          <ToggleButton value="kp" aria-label="keypoint" sx={{ width: 100, height: 100, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <MyLocation fontSize="large" />
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                KP
              </Typography>
            </Box>
          </ToggleButton>
          <ToggleButton value="bb" aria-label="bounding-box" sx={{ width: 100, height: 100, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <SelectAll fontSize="large" />
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                BB
              </Typography>
            </Box>
          </ToggleButton>
          <ToggleButton value="kp-null" aria-label="null-keypoint" sx={{ width: 100, height: 100, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <NotInterested fontSize="large" />
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                KP
              </Typography>
            </Box>
          </ToggleButton>
          <ToggleButton value="bb-null" aria-label="null-bounding-box" sx={{ width: 100, height: 100, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <NotInterested fontSize="large" />
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                BB
              </Typography>
            </Box>
          </ToggleButton>
        </ToggleButtonGroup>
      </Paper>
    </Box>
  );
};

export default AnnotatePage;
