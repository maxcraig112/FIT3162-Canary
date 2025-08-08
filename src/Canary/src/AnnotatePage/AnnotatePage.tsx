import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  Paper,
  IconButton,
} from '@mui/material';
import {
  MyLocation,
  SelectAll,
  NotInterested,
  KeyboardArrowLeft,
  KeyboardArrowRight,
} from '@mui/icons-material';
import { annotateHandler } from './annotateHandler';
import { useSearchParams } from 'react-router-dom';

const AnnotatePage: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentImage, setCurrentImage] = useState(0);
  const [totalImages, setTotalImages] = useState(0);
  const [selectedTool, setSelectedTool] = useState<string | null>('kp');
  const [searchParams] = useSearchParams();

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
        const { current, total } = await annotateHandler.renderToCanvas(batchID);
        setCurrentImage(current);
        setTotalImages(total);
      } catch (e) {
        console.error(e);
      }
    }
    render();
  }, [searchParams, currentImage]);

  const handleToolChange = (
    _event: React.MouseEvent<HTMLElement>,
    newTool: string | null,
  ) => {
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
            <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1 }}>
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
        <Box sx={{ flexGrow: 1, position: 'relative', p: 2 }}>
          <canvas ref={canvasRef} width={800} height={600} />
        </Box>
      </Box>

      {/* Right Sidebar */}
      <Paper elevation={2} sx={{ width: '80px', p: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <ToggleButtonGroup
          orientation="vertical"
          value={selectedTool}
          exclusive
          onChange={handleToolChange}
          aria-label="tool selection"
        >
          <ToggleButton value="kp" aria-label="keypoint">
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <MyLocation />
              <Typography variant="caption">KP</Typography>
            </Box>
          </ToggleButton>
          <ToggleButton value="bb" aria-label="bounding-box">
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <SelectAll />
              <Typography variant="caption">BB</Typography>
            </Box>
          </ToggleButton>
          <ToggleButton value="kp-null" aria-label="null-keypoint">
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <NotInterested />
              <Typography variant="caption">KP</Typography>
            </Box>
          </ToggleButton>
          <ToggleButton value="bb-null" aria-label="null-bounding-box">
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
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
