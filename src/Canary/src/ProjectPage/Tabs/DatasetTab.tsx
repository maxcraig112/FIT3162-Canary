import React from 'react';
import { Box, Paper, IconButton, Menu, MenuItem, Typography, Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField } from '@mui/material';
// Using Box + CSS grid for precise gaps and alignment
import MoreVertIcon from '@mui/icons-material/MoreVert';
import type { Project } from '../ProjectPage';
import { useDatasetTab } from './datasetTabHandler';
import { useParams, useNavigate } from 'react-router-dom';

export const DatasetTab: React.FC<{ project: Project | null }> = () => {
  const { projectID } = useParams<{ projectID: string }>();
  const navigate = useNavigate();
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

  // Log batches whenever they change so you can inspect the data
  React.useEffect(() => {
    if (batches) {
      console.log('[DatasetTab] Batches state:', batches);
    }
  }, [batches]);

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
                <Paper
                  sx={{
                    p: 4,
                    textAlign: 'center',
                    position: 'relative',
                    minHeight: 220,
                    height: '100%',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    pt: 2,
                    pb: 7, // space for bottom count
                    bgcolor: b.previewURL ? 'transparent' : '#ffffff',
                    color: '#000',
                    boxShadow: 8,
                    transition: 'box-shadow 0.25s ease, transform 0.25s ease',
                    '&:hover': {
                      boxShadow: 16,
                      transform: 'translateY(-3px)',
                    },
                    overflow: 'hidden', // clip blurred bg to card
                  }}
                  onClick={() => navigate(`/annotate?batchID=${encodeURIComponent(b.batchID)}&projectID=${encodeURIComponent(projectID ?? b.projectID)}`)}
                >
                  {/* blurred background preview */}
                  {b.previewURL && (
                    <Box
                      aria-hidden
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        backgroundImage: `url(${b.previewURL})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        filter: 'blur(3px)',
                        transform: 'scale(1.06)', // avoid edge transparency from blur
                        zIndex: 1,
                        opacity: 0.5,
                        pointerEvents: 'none',
                      }}
                    />
                  )}
                  {/* dim overlay to improve text contrast */}
                  {b.previewURL && (
                    <Box aria-hidden sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(255,255,255,0)', zIndex: 2, pointerEvents: 'none' }} />
                  )}
                  <Box
                    sx={{
                      flexGrow: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '100%',
                      px: 1,
                      position: 'relative',
                      zIndex: 3,
                    }}
                  >
                    <IconButton
                      sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        fontSize: 32,
                        color: (theme) => theme.palette.grey[600],
                        zIndex: 2,
                      }}
                      size="large"
                      onClick={(e) => openMenu(e, b.batchID)}
                    >
                      <MoreVertIcon sx={{ fontSize: 32 }} />
                    </IconButton>
                    <Typography
                      sx={{
                        fontWeight: 800,
                        fontSize: '1.75rem',
                        letterSpacing: 0.4,
                        lineHeight: 1.1,
                        px: 1,
                        maxWidth: '100%',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      title={b.batchName}
                    >
                      {b.batchName}
                    </Typography>
                    {formattedUpdated && (
                      <Typography
                        sx={{
                          mt: 1,
                          color: '#555',
                          fontSize: '0.95rem',
                          fontWeight: 500,
                          letterSpacing: 0.2,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '100%',
                        }}
                        title={`Updated ${formattedUpdated}`}
                      >
                        Updated {formattedUpdated}
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ position: 'absolute', bottom: 16, left: 0, right: 0, zIndex: 3 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.95rem', color: '#222' }}>
                      {b.numberOfTotalFiles} {b.numberOfTotalFiles === 1 ? 'image' : 'images'}
                    </Typography>
                  </Box>
                </Paper>
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
        <MenuItem onClick={handleFinish}>Finish</MenuItem>
        <MenuItem onClick={openRename}>Rename</MenuItem>
        <MenuItem onClick={openDelete}>Delete</MenuItem>
      </Menu>

      {/* Rename Dialog */}
      <Dialog open={renameOpen} onClose={closeRename} fullWidth maxWidth="xs">
        <DialogTitle>Rename Batch</DialogTitle>
        <DialogContent>
          <TextField autoFocus margin="dense" label="New name" type="text" fullWidth value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeRename}>Cancel</Button>
          <Button onClick={submitRename} disabled={renaming || !renameValue.trim()} variant="contained">
            {renaming ? 'Renaming...' : 'Rename'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onClose={closeDelete} fullWidth maxWidth="xs">
        <DialogTitle>Delete Batch</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this batch?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDelete}>Cancel</Button>
          <Button onClick={confirmDelete} disabled={deleting} color="error" variant="contained">
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
