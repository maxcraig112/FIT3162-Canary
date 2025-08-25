import React, { useState, useEffect, useRef } from 'react';
import { Box, AppBar, Toolbar, Typography, ToggleButtonGroup, ToggleButton, Paper, IconButton, TextField, Button } from '@mui/material';
import { MyLocation, SelectAll, NotInterested, KeyboardArrowLeft, KeyboardArrowRight } from '@mui/icons-material';
import { annotateHandler } from './annotateHandler';
import { useSearchParams } from 'react-router-dom';
import { useAuthGuard } from '../utils/authUtil';

const AnnotatePage: React.FC = () => {
  useAuthGuard();

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
  const textInputRef = useRef<HTMLInputElement | null>(null);

  const boxRef = useRef(null);

  useEffect(() => {
    if (boxRef.current && canvasRef.current) {
      const { offsetWidth, offsetHeight } = boxRef.current;
      canvasRef.current.width = offsetWidth;
      canvasRef.current.height = offsetHeight;
    }
  }, []);

  // Initialize canvas via handler
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    annotateHandler.createCanvas(el);
    return () => annotateHandler.disposeCanvas();
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

  // Subscribe to label requests from handler
  useEffect(() => {
    const unsub = annotateHandler.subscribeLabelRequests((req) => {
      setLabelValue(req.currentLabel ?? '');
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

  // Global Backspace/Delete handling when modal is open but input isn't focused
  useEffect(() => {
    if (!labelPrompt.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Backspace' && e.key !== 'Delete') return;
      const active = document.activeElement as Element | null;
      if (active && textInputRef.current && active === textInputRef.current) {
        // Let the input handle text deletion
        return;
      }
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
          <Toolbar>
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
          </Toolbar>
        </AppBar>

        {/* Canvas */}
        <Box sx={{ flexGrow: 1, position: 'relative', p: 2 }} ref={boxRef}>
          <canvas ref={canvasRef} width={boxRef.current?.offsetWidth} height={boxRef.current?.offsetHeight} style={{ width: '100%', height: '100%' }} />
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
              <TextField
                size="small"
                autoFocus
                placeholder={labelPrompt.kind === 'kp' ? 'Keypoint label' : 'Box label'}
                value={labelValue}
                inputRef={textInputRef}
                sx={{ width: 220, minWidth: 220, flexShrink: 0 }}
                onChange={(e) => setLabelValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (labelValue.trim()) {
                      const projectID = searchParams.get('projectID') || undefined;
                      annotateHandler.confirmLabel(labelValue.trim(), projectID);
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
                  } else if (e.key === 'Escape') {
                    annotateHandler.cancelLabel();
                    setLabelPrompt({
                      open: false,
                      kind: null,
                      x: 0,
                      y: 0,
                      mode: 'create',
                    });
                  }
                }}
              />
              <Button
                variant="contained"
                size="small"
                onClick={() => {
                  if (labelValue.trim()) {
                    const projectID = searchParams.get('projectID') || undefined;
                    annotateHandler.confirmLabel(labelValue.trim(), projectID);
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
          width: '80px',
          p: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <ToggleButtonGroup orientation="vertical" value={selectedTool} exclusive onChange={handleToolChange} aria-label="tool selection">
          <ToggleButton value="kp" aria-label="keypoint">
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <MyLocation />
              <Typography variant="caption">KP</Typography>
            </Box>
          </ToggleButton>
          <ToggleButton value="bb" aria-label="bounding-box">
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <SelectAll />
              <Typography variant="caption">BB</Typography>
            </Box>
          </ToggleButton>
          <ToggleButton value="kp-null" aria-label="null-keypoint">
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <NotInterested />
              <Typography variant="caption">KP</Typography>
            </Box>
          </ToggleButton>
          <ToggleButton value="bb-null" aria-label="null-bounding-box">
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <NotInterested />
              <Typography variant="caption">BB</Typography>
            </Box>
          </ToggleButton>
        </ToggleButtonGroup>
      </Paper>
    </Box>
  );
};

export default AnnotatePage;
