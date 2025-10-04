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
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import InputBase from '@mui/material/InputBase';
import { useSettingsTab } from './settingsTabHandler';
import type { Project } from '../../utils/intefaces/interfaces';

type ListPanelProps = {
  inputValue: string;
  onInputChange: (v: string) => void;
  onAdd: () => void;
  items: string[];
  onDelete: (v: string) => void;
  onRename?: (oldName: string, newName: string) => void;
  placeholder?: string;
};

const ListPanel: React.FC<ListPanelProps> = React.memo(({ inputValue, onInputChange, onAdd, items, onDelete, onRename, placeholder }) => {
  // Inline rename state
  const [editingItem, setEditingItem] = React.useState<string | null>(null);
  const [editValue, setEditValue] = React.useState<string>('');
  // Options menu state
  const [menuAnchor, setMenuAnchor] = React.useState<null | HTMLElement>(null);
  const [menuFor, setMenuFor] = React.useState<string | null>(null);

  const startEditing = (name: string) => {
    setEditingItem(name);
    setEditValue(name);
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
    if (target) onDelete(target);
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
          placeholder={placeholder || 'Add new label'}
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          InputProps={{
            style: { color: '#000', fontSize: '0.875rem' }, // Smaller text
          }}
          InputLabelProps={{
            style: { fontSize: '0.875rem' }, // Smaller label text
          }}
        />
        <Button variant="contained" onClick={onAdd} disabled={!inputValue.trim()}>
          Add
        </Button>
      </Box>
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
                  <InputBase
                    fullWidth
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
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
                    inputProps={{ style: { padding: 0 } }}
                    sx={{
                      m: 0,
                      color: '#000',
                      fontSize: (t) => t.typography.body2.fontSize,
                      lineHeight: (t) => t.typography.body2.lineHeight,
                    }}
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

export function SettingsTab({ project: _project }: { project: Project | null }) {
  const projectID = _project?.projectID;
  const {
    sessionEnabled,
    sessionPassword,
    setSessionEnabled,
    setSessionPassword,
    saveSessionSettings,
    saveSuccess,
    clearSaveSuccess,
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
    renameKeypointLabel,
    renameBboxLabel,
  } = useSettingsTab(projectID, (_project as unknown as { settings?: { session?: { enabled?: boolean; password?: string } } } | null)?.settings ?? null);

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
      {/* Column 1 split into two boxes (no Paper) */}
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
            Sessions
          </Typography>
          <br />
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Typography variant="body2" sx={{ color: '#000', textAlign: 'center' }}>
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
        {/* Bottom half: session form */}
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
          component="form"
          autoComplete="off"
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
            <FormControlLabel control={<Checkbox checked={sessionEnabled} onChange={(e) => setSessionEnabled(e.target.checked)} />} label="Enable Sessions" />
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
            <TextField
              label="Password"
              variant="outlined"
              color="primary"
              focused
              autoComplete="off"
              sx={{ minWidth: '48%' }}
              value={sessionPassword}
              onChange={(e) => setSessionPassword(e.target.value)}
              InputProps={{ style: { color: '#000' } }}
              inputProps={{ name: 'canary-session-password', autoComplete: 'off' }}
            />
          </Box>
          <Button
            variant="contained"
            sx={{ width: '100%' }}
            onClick={async () => {
              try {
                await saveSessionSettings();
                // Auto clear after 2.5s
                setTimeout(() => clearSaveSuccess(), 2500);
              } catch (e) {
                console.error('Failed to save settings', e);
                alert(e instanceof Error ? e.message : 'Failed to save settings');
              }
            }}
          >
            Save
          </Button>
          {saveSuccess && (
            <Typography variant="body2" sx={{ mt: 1, color: 'green' }}>
              {saveSuccess}
            </Typography>
          )}
        </Box>
      </Box>

      {/* Column 2 */}
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
        />
      </Box>

      {/* Column 3 */}
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
        />
      </Box>
    </Box>
  );
}
