import React, { useState, useEffect, useRef } from 'react';
import * as fabric from 'fabric';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  Paper,
} from '@mui/material';
import {
  MyLocation,
  SelectAll,
  NotInterested,
} from '@mui/icons-material';
import { annotateHandler } from './annotateHandler';
import CanaryImage from '../images/canary.jpg';

const AnnotatePage: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentImage, setCurrentImage] = useState(0);
  const [totalImages, setTotalImages] = useState(0);
  const [selectedTool, setSelectedTool] = useState<string | null>('kp');

  useEffect(() => {
    setCurrentImage(annotateHandler.getCurrentImageNumber());
    setTotalImages(annotateHandler.getTotalImageCount());

    if (!canvasRef.current) return;
    const canvas = new fabric.Canvas(canvasRef.current);

    fabric.Image.fromURL(CanaryImage, (img: fabric.Image) => {
      if (!canvas.width || !canvas.height) return;
      img.scaleToWidth(canvas.width);
      img.scaleToHeight(canvas.height);
      canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
        originX: 'left',
        originY: 'top',
      });
    });

    return () => {
      canvas.dispose();
    };
  }, []);

  const handleToolChange = (
    _event: React.MouseEvent<HTMLElement>,
    newTool: string | null,
  ) => {
    if (newTool !== null) {
      setSelectedTool(newTool);
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
          <Toolbar>
            <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center' }}>
              <Paper elevation={2} sx={{ px: 3, py: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  {currentImage}/{totalImages}
                </Typography>
              </Paper>
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
