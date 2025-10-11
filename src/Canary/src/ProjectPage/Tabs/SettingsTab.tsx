import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import InputBase from '@mui/material/InputBase';
import { useSettingsTab } from './settingsTabHandler';
import type { Project } from '../../utils/interfaces/interfaces';
import { useAuthGuard } from '../../utils/authUtil';

type ListPanelProps = {
  inputValue: string;
  onInputChange: (v: string) => void;
  onAdd: () => void;
  items: string[];
  onDelete: (v: string) => void;
  onRename?: (oldName: string, newName: string) => void;
  placeholder?: string;
  error?: string | null;
  onClearError?: () => void;
};

const ListPanel: React.FC<ListPanelProps> = React.memo(({ inputValue, onInputChange, onAdd, items, onDelete, onRename, placeholder, error, onClearError }) => {
  // Inline rename state
  const [editingItem, setEditingItem] = React.useState<string | null>(null);
  const [editValue, setEditValue] = React.useState<string>('');
  // Options menu state
  const [menuAnchor, setMenuAnchor] = React.useState<null | HTMLElement>(null);
  const [menuFor, setMenuFor] = React.useState<string | null>(null);

  const startEditing = (name: string) => {
    setEditingItem(name);
    setEditValue(name);
    onClearError?.();
  };

  const cancelEditing = () => {
    setEditingItem(null);
    setEditValue('');
  };

  const commitEditing = () => {
    const oldName = editingItem;
    const newName = editValue.trim();
    if (!oldName) return;
    if (newName && newName !== oldName) {
      onRename?.(oldName, newName);
    }
    cancelEditing();
  };

  // Menu handlers
  const openMenu = (e: React.MouseEvent<HTMLElement>, name: string) => {
    setMenuAnchor(e.currentTarget);
    setMenuFor(name);
  };
  const closeMenu = () => {
    setMenuAnchor(null);
    setMenuFor(null);
  };
  const handleMenuRename = () => {
    const target = menuFor;
    closeMenu();
    if (target) startEditing(target);
  };
  const handleMenuDelete = () => {
    const target = menuFor;
    closeMenu();
    if (target) {
      onClearError?.();
      onDelete(target);
    }
  };

  const handleAddClick = () => {
    onClearError?.();
    onAdd();
  };

  const fieldLabel = placeholder || 'Label';
  const outlinedSx = { '& .MuiOutlinedInput-notchedOutline': { borderColor: '#999' } };
  const addInputSx = {
    color: '#000',
    bgcolor: '#fff',
    borderRadius: 2,
    '& input': { fontSize: '0.875rem' },
  };
  const labelSx = {
    fontSize: '0.875rem',
    color: '#4f4f4fff',
    '&.Mui-focused': { color: '#000' },
  };
  const renameInputSx = {
    color: '#000',
    bgcolor: '#fff',
    borderRadius: 2,
    '& input': {
      fontSize: (t: { typography: { body2: { fontSize: any; }; }; }) => t.typography.body2.fontSize,
      lineHeight: (t: { typography: { body2: { lineHeight: any; }; }; }) => t.typography.body2.lineHeight,
      py: 0.5,
    },
  };

  return (
    <Paper
      sx={{
        bgcolor: '#fff',
        color: '#000',
        border: '1px solid #e0e0e0',
        boxShadow: 0, // Remove shadow
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <TextField
          fullWidth
          size="small"
          label={fieldLabel}
          placeholder={placeholder}
          value={inputValue}
          onChange={(e) => {
            onClearError?.();
            onInputChange(e.target.value);
          }}
          InputProps={{ sx: addInputSx }}
          InputLabelProps={{ sx: labelSx }}
          sx={outlinedSx}
          error={Boolean(error)}
        />
        <Button variant="contained" onClick={handleAddClick} disabled={!inputValue.trim()} sx={{ color: '#000' }}>
          Add
        </Button>
      </Box>
      {error && (
        <Typography variant="caption" color="error" sx={{ mb: 1 }}>
          {error}
        </Typography>
      )}
      <List dense sx={{ flex: 1, overflowY: 'auto', pr: 1 }}>
        {items.map((it) => (
          <ListItem key={it} sx={{ pr: 1, py: 0 /* keep row compact */ }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                alignItems: 'center',
                columnGap: 1,
                width: '100%',
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                {editingItem === it ? (
                  <TextField
                    fullWidth
                    size="small"
                    autoFocus
                    label={fieldLabel}
                    value={editValue}
                    onChange={(e) => {
                      onClearError?.();
                      setEditValue(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        commitEditing();
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        cancelEditing();
                      }
                    }}
                    onBlur={commitEditing}
                    InputProps={{ sx: renameInputSx }}
                    InputLabelProps={{ sx: labelSx }}
                    sx={outlinedSx}
                  />
                ) : (
                  <Typography variant="body2" color="#000" noWrap sx={{ m: 0, lineHeight: (t) => t.typography.body2.lineHeight }}>
                    {it}
                  </Typography>
                )}
              </Box>
              <Box sx={{ width: 40, display: 'flex', justifyContent: 'flex-end' }}>
                <IconButton edge="end" aria-label={`options ${it}`} onClick={(e) => openMenu(e, it)} sx={{ color: '#000', visibility: editingItem === it ? 'hidden' : 'visible' }}>
                  <MoreVertIcon />
                </IconButton>
              </Box>
            </Box>
          </ListItem>
        ))}
        {items.length === 0 && <Typography sx={{ color: '#666', textAlign: 'center', mt: 2 }}>No labels yet</Typography>}
      </List>

      {/* Single shared menu for all rows */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={closeMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{
          sx: {
            bgcolor: '#fff',
            '& .MuiMenuItem-root': {
              fontSize: 13,
              py: 0.5,
            },
          },
        }}
      >
        <MenuItem onClick={handleMenuRename} sx={{ color: '#000' }}>
          Rename
        </MenuItem>
        <MenuItem onClick={handleMenuDelete} sx={{ color: '#d32f2f' }}>
          Delete
        </MenuItem>
      </Menu>
    </Paper>
  );
});

type SettingsTabProps = {
  project: Project | null;
};

export function SettingsTab({ project: _project }: SettingsTabProps) {
  useAuthGuard();
  const projectID = _project?.projectID;
  const {
    keypointLabels,
    bboxLabels,
    keypointInput,
    bboxInput,
    setKeypointInput,
    setBboxInput,
    addKeypoint,
    addBbox,
    deleteKeypoint,
    deleteBbox,
    keypointError,
    bboxError,
    clearKeypointError,
    clearBboxError,
    renameKeypointLabel,
    renameBboxLabel,
  } = useSettingsTab(projectID);

  return (
    <Box
      sx={{
        width: '100%',
        display: 'flex',
        justifyContent: 'space-between',
        gap: 4,
        minHeight: 'fit-content', // Let content determine height
      }}
    >
      <Box
        sx={{
          flex: 1,
          display: 'grid',
          gridTemplateRows: '1fr 1fr',
          gap: 2,
          minHeight: '60vh', // Reduced from 70vh for better laptop compatibility
        }}
      >
        {/* Top half: description */}
        <Box>
          <Typography variant="h5" sx={{ color: '#000', textAlign: 'center' }}>
            Configure Keypoints
          </Typography>
          <br />
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Typography variant="body2" sx={{ color: '#000', textAlign: 'center' }}>
              Keypoints are used to identify specific points of interest within an image. Labels configured below are shared across all images within this project.
              <br />
              <br />
              WARNING: deleting a tag that is currently in use will remove it from all annotations.
            </Typography>
          </Box>
        </Box>
        {/* Bottom half: labels list starts at half screen */}
        <ListPanel
          inputValue={keypointInput}
          onInputChange={setKeypointInput}
          onAdd={addKeypoint}
          items={keypointLabels}
          onDelete={deleteKeypoint}
          onRename={(oldName, newName) => renameKeypointLabel(oldName, newName)}
          placeholder="Add new label"
          error={keypointError}
          onClearError={clearKeypointError}
        />
      </Box>

      {/* Bounding box configuration */}
      <Box
        sx={{
          flex: 1,
          display: 'grid',
          gridTemplateRows: '1fr 1fr',
          gap: 2,
          minHeight: '60vh', // Reduced from 70vh for better laptop compatibility
        }}
      >
        {/* Top half: description */}
        <Box>
          <Typography variant="h5" sx={{ color: '#000', textAlign: 'center' }}>
            Configure Bounding Box
          </Typography>
          <br />
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Typography variant="body2" sx={{ color: '#000', textAlign: 'center' }}>
              Bounding Boxes are used to identify specific areas of interest within an image, defined by a rectangle area. In the annotate page, they are defined as two points (the top right and
              bottom left of the desired area).
              <br />
              <br />
              WARNING: deleting a tag that is currently in use will remove it from all annotations.
            </Typography>
          </Box>
        </Box>
        {/* Bottom half: labels list starts at half screen */}
        <ListPanel
          inputValue={bboxInput}
          onInputChange={setBboxInput}
          onAdd={addBbox}
          items={bboxLabels}
          onDelete={deleteBbox}
          onRename={(oldName, newName) => renameBboxLabel(oldName, newName)}
          placeholder="Add new label"
          error={bboxError}
          onClearError={clearBboxError}
        />
      </Box>
    </Box>
  );
}
