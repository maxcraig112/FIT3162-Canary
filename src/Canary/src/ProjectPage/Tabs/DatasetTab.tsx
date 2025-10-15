import React from 'react';
import { Box, IconButton, Menu, MenuItem, Typography, Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField } from '@mui/material';
// Using Box + CSS grid for precise gaps and alignment
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { useDatasetTab } from './datasetTabHandler';
import { useParams } from 'react-router-dom';
import type { Project } from '../../utils/interfaces/interfaces';
import { useAuthGuard } from '../../utils/authUtil';

export const DatasetTab: React.FC<{ project: Project | null }> = () => {
  useAuthGuard();
  const { projectID } = useParams<{ projectID: string }>();
  const {
    batches,
    loading,
    error,
    // menu
    menuAnchorEl,
    menuBatchId,
    openMenu,
    closeMenu,
    handleFinish,
    // rename
    renameOpen,
    renameValue,
    setRenameValue,
    openRename,
    submitRename,
    renaming,
    // delete
    deleteOpen,
    openDelete,
    confirmDelete,
    deleting,
    closeRename,
    closeDelete,
  } = useDatasetTab(projectID);

  const renameOriginalValueRef = React.useRef<string>('');

  // Log batches whenever they change so you can inspect the data
  React.useEffect(() => {
    if (batches) {
      // console.log('[BatchesTab] Batches state:', batches);
    }
  }, [batches]);
  React.useEffect(() => {
    if (renameOpen) {
      if (!renameOriginalValueRef.current && renameValue) {
        renameOriginalValueRef.current = renameValue;
      }
    } else {
      renameOriginalValueRef.current = '';
    }
  }, [renameOpen, renameValue]);
  const isRenameDisabled = renaming || !renameValue.trim() || renameValue.trim().toLowerCase() === renameOriginalValueRef.current.trim().toLowerCase();

  return (
    <Box sx={{ width: '100%' }}>
      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}
      <Box sx={{ px: '5%' }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            columnGap: '4%',
            rowGap: 6,
            alignItems: 'start',
          }}
        >
          {loading && batches.length === 0 && <Typography>Loading batches...</Typography>}
          {batches.map((b) => {
            const formattedUpdated = (() => {
              if (!b.lastUpdated) return '';
              const d = new Date(b.lastUpdated);
              if (isNaN(d.getTime())) return b.lastUpdated;
              return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
            })();
            return (
              <Box key={b.batchID} sx={{ minHeight: '10vh' }}>
                <Box
                  sx={{
                    position: 'relative',
                    border: '1.5px solid #bfbfbfff',
                    borderRadius: 1,
                    overflow: 'hidden',
                    boxShadow: 0,
                    transition: 'box-shadow 0.25s ease, transform 0.25s ease',
                    bgcolor: '#fff',
                    '&:hover': { boxShadow: 2, transform: 'translateY(-2px)' },
                  }}
                >
                  <Box
                    aria-hidden
                    sx={{
                      position: 'relative',
                      width: '100%',
                      pt: '56.25%',
                      bgcolor: '#f1f5f9',
                      backgroundImage: b.previewURL ? `url(${b.previewURL})` : 'linear-gradient(135deg,#e2e8f0 0%,#cbd5f5 100%)',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  />

                  <Box sx={{ px: 2, py: 1.75, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                      <Typography
                        sx={{
                          flexGrow: 1,
                          fontWeight: 700,
                          fontSize: '1.1rem',
                          lineHeight: 1.3,
                          color: '#0f172a',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {b.batchName}
                      </Typography>
                      <IconButton
                        size="small"
                        sx={{ color: '#475569' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          openMenu(e, b.batchID);
                        }}
                      >
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
                    </Box>

                    <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.9rem', color: '#1f2937' }}>
                      {b.numberOfTotalFiles} {b.numberOfTotalFiles === 1 ? 'image' : 'images'}
                    </Typography>

                    {formattedUpdated && (
                      <Typography variant="body2" sx={{ color: '#475569' }}>
                        Updated {formattedUpdated}
                      </Typography>
                    )}
                  </Box>
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl) && Boolean(menuBatchId)}
        onClose={closeMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              bgcolor: '#fff',
              color: '#000',
              border: '1px solid #e0e0e0',
              boxShadow: 8,
            },
          },
        }}
      >
        <MenuItem onClick={handleFinish} sx={{ '&:hover': { bgcolor: '#dededeff' } }}>
          Mark as Incomplete
        </MenuItem>
        <MenuItem onClick={openRename} sx={{ '&:hover': { bgcolor: '#dededeff' } }}>
          Rename
        </MenuItem>
        <MenuItem
          onClick={openDelete}
          sx={{
            color: '#b91c1c',
            '&:hover': { bgcolor: '#fee2e2', color: '#7f1d1d' },
          }}
        >
          Delete
        </MenuItem>
      </Menu>

      {/* Rename Dialog */}
      <Dialog open={renameOpen} onClose={closeRename} fullWidth maxWidth="xs">
        <DialogTitle sx={{ color: '#000' }}>Rename Batch</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="New name"
            type="text"
            fullWidth
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
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
              alignSelf: 'center',
              maxWidth: 480,
              // border styles
              '& .MuiOutlinedInput-root .MuiOutlinedInput-notchedOutline': { borderColor: '#999' },
              '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: '#000',
                borderWidth: '1.5px',
              },
              '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: '#f7bd13',
                borderWidth: '2px',
              },
              // label styles (hover + focus)
              '& .MuiInputLabel-root': { color: '#999' },
              '&:hover .MuiInputLabel-root': { color: '#000' },
              '& .MuiInputLabel-root.Mui-focused': { color: '#000' },
              mb: '0.5rem',
              mt: '0.5rem',
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={closeRename}
            variant="outlined"
            color="secondary"
            sx={{
              mb: '1rem',
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={submitRename}
            disabled={isRenameDisabled}
            variant="contained"
            sx={{
              mb: '1rem',
              mr: '1rem',
              '&.Mui-disabled': { bgcolor: '#e2e8f0', color: '#94a3b8' },
            }}
          >
            {renaming ? 'Renaming...' : 'Rename'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onClose={closeDelete} fullWidth maxWidth="xs">
        <DialogTitle sx={{ color: '#000' }}>Delete Batch</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#000' }}>Are you sure you want to delete this batch?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDelete} variant="outlined" color="secondary">
            Cancel
          </Button>
          <Button onClick={confirmDelete} disabled={deleting} color="error" variant="contained">
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
