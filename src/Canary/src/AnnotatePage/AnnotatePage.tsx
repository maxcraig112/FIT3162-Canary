import React, { useState, useEffect, useRef } from 'react';
import { Box, AppBar, Toolbar, Typography, ToggleButtonGroup, ToggleButton, Paper, IconButton, Button, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { MyLocation, SelectAll, NotInterested, KeyboardArrowLeft, KeyboardArrowRight } from '@mui/icons-material';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import { annotateHandler, getCanvas } from './annotateHandler';
import { ZoomHandler } from './zoomHandler';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useSearchParams } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { getBoundingBoxLabelNames, getKeypointLabelNames } from './labelRegistry';
import { loadProjectLabels } from './labelLoader';
import { useAuthGuard } from '../utils/authUtil';

const AnnotatePage: React.FC = () => {
  useAuthGuard();

  const navigate = useNavigate();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentImage, setCurrentImage] = useState(0);
  const [totalImages, setTotalImages] = useState(0);
  const [selectedTool, setSelectedTool] = useState<string | null>('kp');
  const [searchParams] = useSearchParams();
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
    zoomHandlerRef.current = new ZoomHandler({ canvas: getCanvas() });
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
      const batchID = searchParams.get('batchID') || '';
      if (!batchID) return;
      try {
        const projectID = searchParams.get('projectID') || undefined;
        const { current, total } = await annotateHandler.renderToCanvas(batchID, projectID);
        setCurrentImage(current);
        setTotalImages(total);
      } catch (e) {
        console.error(e);
      }
    }
    render();
  }, [searchParams, currentImage]);

  // Keep handler tool selection in sync with UI
  useEffect(() => {
    const t = selectedTool;
    if (t === 'kp' || t === 'bb') annotateHandler.setTool(t);
    else annotateHandler.setTool(null);
  }, [selectedTool]);

  // Load labels when projectID changes
  useEffect(() => {
    const projectID = searchParams.get('projectID') || undefined;
    (async () => {
      await loadProjectLabels(projectID || undefined);
      setKpOptions(getKeypointLabelNames());
      setBbOptions(getBoundingBoxLabelNames());
    })();
  }, [searchParams]);

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

  // Global Backspace/Delete handling when modal is open
  useEffect(() => {
    if (!labelPrompt.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Backspace' && e.key !== 'Delete') return;
      // Only delete existing annotation labels during edit mode
      if (labelPrompt.mode === 'edit') {
        e.preventDefault();
        annotateHandler.deleteSelected();
        setLabelPrompt({ open: false, kind: null, x: 0, y: 0, mode: 'create' });
      }
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [labelPrompt.open, labelPrompt.mode, searchParams]);

  const handleToolChange = (_event: React.MouseEvent<HTMLElement>, newTool: string | null) => {
    if (newTool !== null) setSelectedTool(newTool);
  };

  const handlePrev = () => {
    annotateHandler.prevImage(setCurrentImage);
  };

  const handleNext = () => {
    annotateHandler.nextImage(setCurrentImage);
  };

  // Zoom button handlers
  const handleZoomIn = () => {
    if (zoomHandlerRef.current) {
      zoomHandlerRef.current.zoomIn();
      setZoom(zoomHandlerRef.current.getZoom());
    }
  };
  const handleZoomOut = () => {
    if (zoomHandlerRef.current) {
      zoomHandlerRef.current.zoomOut();
      setZoom(zoomHandlerRef.current.getZoom());
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
                const projectID = searchParams.get('projectID');
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
              <Paper elevation={2} sx={{ px: 3, py: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  {currentImage}/{totalImages}
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
                    const projectID = searchParams.get('projectID') || undefined;
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
