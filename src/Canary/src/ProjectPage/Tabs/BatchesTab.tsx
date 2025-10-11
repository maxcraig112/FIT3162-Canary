import React from 'react';
import { Box, Paper, IconButton, Menu, MenuItem, Typography, Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Snackbar } from '@mui/material';
// Using Box + CSS grid for precise gaps and alignment
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { useBatchesTab } from './batchesTabHandler';
import { useParams, useNavigate } from 'react-router-dom';
import type { Project } from '../../utils/interfaces/interfaces';
import { useAuthGuard } from '../../utils/authUtil';
import { getUserIDFromCookie } from '../../utils/cookieUtils';

export const BatchesTab: React.FC<{ project: Project | null }> = () => {
  useAuthGuard();
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
    openBatch,
    sessionPending,
    activeSessionsByBatch,
    startSession,
    stopSession,
    sessionDialogOpen,
    sessionCreationBatch,
    cancelSessionCreation,
    handleCreateSessionWithPassword,
    // session end warning
    sessionEndWarningOpen,
    closeSessionEndWarning,
    confirmStopSession,
  } = useBatchesTab(projectID);

  const currentUserID = getUserIDFromCookie();

  // Log batches whenever they change so you can inspect the data
  React.useEffect(() => {
    if (batches) {
      // console.log('[BatchesTab] Batches state:', batches);
    }
  }, [batches]);

  const sessionActiveForMenuBatch = React.useMemo(() => {
    if (!menuBatchId) return false;
    return Boolean(activeSessionsByBatch[menuBatchId]);
  }, [activeSessionsByBatch, menuBatchId]);
  const sessionOwnedByCurrentUser = React.useMemo(() => {
    if (!menuBatchId || !currentUserID) return false;
    const session = activeSessionsByBatch[menuBatchId];
    if (!session) return false;
    return session.owner.id === currentUserID;
  }, [activeSessionsByBatch, menuBatchId, currentUserID]);
  const isSessionMenuVisible = Boolean(menuBatchId);
  const startLabel = 'Start Session';

  const [copyToast, setCopyToast] = React.useState<{ open: boolean; message: string }>({ open: false, message: '' });
  const [sessionPasswordValue, setSessionPasswordValue] = React.useState('');

  React.useEffect(() => {
    if (!sessionDialogOpen) {
      setSessionPasswordValue('');
    }
  }, [sessionDialogOpen]);

  const handleCopySessionID = React.useCallback(async (event: React.MouseEvent, sessionID?: string) => {
    event.stopPropagation();
    if (!sessionID) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(sessionID);
      } else {
        const el = document.createElement('textarea');
        el.value = sessionID;
        el.style.position = 'fixed';
        el.style.opacity = '0';
        document.body.appendChild(el);
        el.focus();
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setCopyToast({ open: true, message: `Session ID copied: ${sessionID}` });
    } catch (err) {
      console.warn('Failed to copy session ID', err);
      setCopyToast({ open: true, message: 'Unable to copy session ID' });
    }
  }, []);

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
            const activeSessionForBatch = activeSessionsByBatch[b.batchID];
            const isSessionActive = Boolean(activeSessionForBatch);
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
                    border: isSessionActive ? '2px solid #2563eb' : '2px solid transparent',
                    '&:hover': {
                      boxShadow: 16,
                      transform: 'translateY(-3px)',
                    },
                    overflow: 'hidden', // clip blurred bg to card
                  }}
                  onClick={() => openBatch(b, navigate)}
                >
                  {isSessionActive && activeSessionForBatch?.sessionID && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 12,
                        left: 12,
                        zIndex: 4,
                        px: 1.5,
                        py: 0.75,
                        borderRadius: 1,
                        bgcolor: 'rgba(37, 99, 235, 0.92)',
                        color: '#fff',
                        textAlign: 'left',
                        boxShadow: '0 2px 6px rgba(37, 99, 235, 0.35)',
                        cursor: 'pointer',
                      }}
                      role="button"
                      tabIndex={0}
                      onClick={(e) => handleCopySessionID(e, activeSessionForBatch.sessionID)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          handleCopySessionID(e as unknown as React.MouseEvent, activeSessionForBatch.sessionID);
                        }
                      }}
                    >
                      <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
                        Session active (click to copy)
                      </Typography>
                      <Typography variant="caption" sx={{ display: 'block', fontFamily: 'monospace' }}>
                        ID: {activeSessionForBatch.sessionID}
                      </Typography>
                    </Box>
                  )}
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
                  {b.previewURL && <Box aria-hidden sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(255,255,255,0)', zIndex: 2, pointerEvents: 'none' }} />}
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
                        zIndex: 5,
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
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2 }}>
                      {/* Session user count (bottom left) or empty space */}
                      <Box>
                        {isSessionActive && activeSessionForBatch && activeSessionForBatch.members && activeSessionForBatch.members.length > 0 && (
                          <Typography
                            variant="caption"
                            sx={{
                              fontWeight: 600,
                              fontSize: '0.85rem',
                              color: '#2563eb',
                              bgcolor: 'rgba(37, 99, 235, 0.1)',
                              px: 1,
                              py: 0.5,
                              borderRadius: 1,
                              border: '1px solid rgba(37, 99, 235, 0.3)',
                            }}
                          >
                            {activeSessionForBatch.members.length} {activeSessionForBatch.members.length === 1 ? 'user' : 'users'} active
                          </Typography>
                        )}
                      </Box>

                      {/* Image count (bottom right) */}
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.95rem', color: '#222' }}>
                        {b.numberOfTotalFiles} {b.numberOfTotalFiles === 1 ? 'image' : 'images'}
                      </Typography>
                    </Box>
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
        {isSessionMenuVisible && !sessionActiveForMenuBatch && (
          <MenuItem onClick={startSession} disabled={sessionPending}>
            {sessionPending ? 'Starting session…' : startLabel}
          </MenuItem>
        )}
        {isSessionMenuVisible && sessionActiveForMenuBatch && sessionOwnedByCurrentUser && (
          <MenuItem onClick={stopSession} disabled={sessionPending}>
            {sessionPending ? 'Stopping session…' : 'Stop Session'}
          </MenuItem>
        )}
        {isSessionMenuVisible && sessionActiveForMenuBatch && !sessionOwnedByCurrentUser && (
          <MenuItem onClick={stopSession} disabled={sessionPending} sx={{ color: 'warning.main' }}>
            {sessionPending ? 'Stopping session…' : 'End Session (Session in progress by another user)'}
          </MenuItem>
        )}
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

      {/* Session Password Dialog */}
      <Dialog
        open={sessionDialogOpen}
        onClose={() => {
          if (!sessionPending) cancelSessionCreation();
        }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Start Session</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography>{sessionCreationBatch ? `Start a new session for "${sessionCreationBatch.batchName}".` : 'Start a new session.'}</Typography>
          <Typography variant="body2" color="text.secondary">
            Set an optional password so only people with the password can join. Leave blank to allow anyone with the session ID to join.
          </Typography>
          <TextField label="Session password" type="password" value={sessionPasswordValue} onChange={(e) => setSessionPasswordValue(e.target.value)} disabled={sessionPending} fullWidth autoFocus />
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelSessionCreation} disabled={sessionPending}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              void handleCreateSessionWithPassword(sessionPasswordValue.trim() || undefined);
            }}
            disabled={sessionPending}
            variant="contained"
          >
            {sessionPending ? 'Starting…' : 'Start Session'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Session End Warning Dialog */}
      <Dialog open={sessionEndWarningOpen} onClose={closeSessionEndWarning} fullWidth maxWidth="xs">
        <DialogTitle>End Session Warning</DialogTitle>
        <DialogContent>
          <Typography>This session is currently in progress by another user. Are you sure you want to end it? This will disconnect all participants.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeSessionEndWarning}>Cancel</Button>
          <Button onClick={confirmStopSession} disabled={sessionPending} color="warning" variant="contained">
            {sessionPending ? 'Ending...' : 'End Session'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={copyToast.open}
        autoHideDuration={3000}
        onClose={() => setCopyToast((prev) => ({ ...prev, open: false }))}
        message={copyToast.message}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
};
