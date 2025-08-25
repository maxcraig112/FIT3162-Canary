import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useSettingsTab } from './settingsTabHandler';
import type { Project } from '../ProjectPage';

type ListPanelProps = {
  title: string;
  inputValue: string;
  onInputChange: (v: string) => void;
  onAdd: () => void;
  items: string[];
  onDelete: (v: string) => void;
  placeholder?: string;
};

const ListPanel: React.FC<ListPanelProps> = React.memo(({ title, inputValue, onInputChange, onAdd, items, onDelete, placeholder }) => (
  <Paper
    sx={{
      bgcolor: '#fff',
      color: '#000',
      border: '1px solid #e0e0e0',
      boxShadow: 8,
      p: 2,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
    }}
  >
    <Typography variant="h6" sx={{ mb: 1, textAlign: 'center' }}>
      {title}
    </Typography>
    <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
      <TextField fullWidth size="small" placeholder={placeholder || 'New label'} value={inputValue} onChange={(e) => onInputChange(e.target.value)} InputProps={{ style: { color: '#000' } }} />
      <Button variant="contained" onClick={onAdd} disabled={!inputValue.trim()}>
        Add
      </Button>
    </Box>
    <List dense sx={{ flex: 1, overflowY: 'auto', pr: 1 }}>
      {items.map((it) => (
        <ListItem key={it} sx={{ pr: 1 }}>
          <ListItemText primary={it} primaryTypographyProps={{ color: '#000' }} />
          <Box sx={{ ml: 'auto' }}>
            <IconButton edge="end" aria-label={`delete ${it}`} onClick={() => onDelete(it)}>
              <DeleteOutlineIcon />
            </IconButton>
          </Box>
        </ListItem>
      ))}
      {items.length === 0 && <Typography sx={{ color: '#666', textAlign: 'center', mt: 2 }}>No labels yet</Typography>}
    </List>
  </Paper>
));

export function SettingsTab({ project }: { project: Project | null }) {
  const { keypointLabels, bboxLabels, keypointInput, bboxInput, setKeypointInput, setBboxInput, addKeypoint, addBbox, deleteKeypoint, deleteBbox } = useSettingsTab();

  return (
    <Box
      sx={{
        width: '100%',
        display: 'flex',
        justifyContent: 'space-between',
        gap: 4,
      }}
    >
      {/* Column 1 split into two boxes (no Paper) */}
      <Box
        sx={{
          flex: 1,
          display: 'grid',
          gridTemplateRows: '1fr 1fr',
          gap: 2,
          minHeight: '70vh',
        }}
      >
        <Box
          sx={{
            bgcolor: '#fff',
            color: '#000',
            p: 2,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <Typography variant="h4" sx={{ textAlign: 'center' }}>
            Sessions
          </Typography>
          <br />
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Typography variant="body3" sx={{ textAlign: 'center' }}>
              Sessions allow you to cross-collaborate with multiple users on the same project, allowing them to upload, annotate and export images.
              <br />
              <br />
              To enable sessions, tick the checkbox below, and enter a unique session code. This will be used by users to join your project.
              <br />
              <br />
              <b>DO NOT SHARE THIS CODE WITH ANYONE YOU DO NOT TRUST.</b>
            </Typography>
          </Box>
        </Box>
        <Box
          sx={{
            bgcolor: '#fff',
            color: '#000',
            p: 2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
          }}
        >
          {/* Enable Sessions button on its own row, centered */}
          <Box
            sx={{
              width: '100%',
              display: 'flex',
              justifyContent: 'center',
              mb: 2,
            }}
          >
            <FormControlLabel control={<Checkbox defaultChecked />} label="Enable Sessions" />
          </Box>
          {/* Input fields centered in a row below */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              flexWrap: 'wrap',
              width: '100%',
              mb: 2,
            }}
          >
            <TextField label="Session Name" variant="outlined" color="primary" focused sx={{ minWidth: '48%' }} InputProps={{ style: { color: '#000' } }} />
            <TextField label="Password" variant="outlined" color="primary" focused sx={{ minWidth: '48%' }} InputProps={{ style: { color: '#000' } }} />
          </Box>
          <Button variant="contained" sx={{ width: '100%' }}>
            Save
          </Button>
        </Box>
      </Box>

      {/* Column 2 */}
      <Box
        sx={{
          flex: 1,
          display: 'grid',
          gridTemplateRows: '1fr 1fr',
          gap: 2,
          minHeight: '70vh',
        }}
      >
        {/* Top half: description */}
        <Box>
          <Typography variant="h4" sx={{ color: '#000', textAlign: 'center' }}>
            Configure KeyPoints
          </Typography>
          <br />
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Typography variant="body3" sx={{ color: '#000', textAlign: 'center' }}>
              KeyPoints are used to identify specific points of interest within an image. Labels configured below are shared across all images within this project.
              <br />
              <br />
              Warning, deleting a tag that is currently in use will remove it from all annotations.
            </Typography>
          </Box>
        </Box>
        {/* Bottom half: labels list starts at half screen */}
        <ListPanel
          title="KeyPoint Labels"
          inputValue={keypointInput}
          onInputChange={setKeypointInput}
          onAdd={addKeypoint}
          items={keypointLabels}
          onDelete={deleteKeypoint}
          placeholder="Add new keypoint label"
        />
      </Box>

      {/* Column 3 */}
      <Box
        sx={{
          flex: 1,
          display: 'grid',
          gridTemplateRows: '1fr 1fr',
          gap: 2,
          minHeight: '70vh',
        }}
      >
        {/* Top half: description */}
        <Box>
          <Typography variant="h4" sx={{ color: '#000', textAlign: 'center' }}>
            Configure BoundingBox
          </Typography>
          <br />
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Typography variant="body3" sx={{ color: '#000', textAlign: 'center' }}>
              BoundingBoxes are used to identify specific areas of interest within an image, defined by a rectangle area. In the annotate page, they are defined as two points (the top right and bottom
              left of the desired area).
              <br />
              <br />
              Warning, deleting a tag that is currently in use will remove it from all annotations.
            </Typography>
          </Box>
        </Box>
        {/* Bottom half: labels list starts at half screen */}
        <ListPanel title="Bounding Box Labels" inputValue={bboxInput} onInputChange={setBboxInput} onAdd={addBbox} items={bboxLabels} onDelete={deleteBbox} placeholder="Add new bounding box label" />
      </Box>
    </Box>
  );
}
