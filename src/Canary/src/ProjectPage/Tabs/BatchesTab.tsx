import React from 'react';
import { Box, IconButton, Menu, MenuItem, Typography, Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Snackbar } from '@mui/material';
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
  const renameOriginalValueRef = React.useRef<string>('');

  React.useEffect(() => {
    if (!sessionDialogOpen) {
      setSessionPasswordValue('');
    }
  }, [sessionDialogOpen]);
  React.useEffect(() => {
    if (renameOpen) {
      if (!renameOriginalValueRef.current && renameValue) {
        renameOriginalValueRef.current = renameValue;
      }
    } else {
      renameOriginalValueRef.current = '';
    }
  }, [renameOpen, renameValue]);
  const isRenameDisabled =
    renaming ||
    !renameValue.trim() ||
    renameValue.trim().toLowerCase() === renameOriginalValueRef.current.trim().toLowerCase();

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
                <Box
                  sx={{
                    position: 'relative',
                    border: '1px solid',
                    borderColor: isSessionActive ? '#2563eb' : '#e2e8f0',
                    borderRadius: 1,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    boxShadow: 6,
                    transition: 'box-shadow 0.25s ease, transform 0.25s ease',
                    '&:hover': { boxShadow: 12, transform: 'translateY(-2px)' },
                    bgcolor: '#fff',
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
                      <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', fontSize: '0.9rem' }}>
                        Session active
                      </Typography>
                      <Typography variant="caption" sx={{ display: 'block', fontSize: '0.8rem' }}>
                        Click to copy ID
                      </Typography>
                      <Typography variant="caption" sx={{ display: 'block', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                        ID:{activeSessionForBatch.sessionID}
                      </Typography>
                    </Box>
                  )}

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

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      {isSessionActive && activeSessionForBatch?.members?.length ? (
                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: 600,
                            fontSize: '0.8rem',
                            color: '#2563eb',
                            bgcolor: 'rgba(37, 99, 235, 0.1)',
                            px: 1,
                            py: 0.35,
                            borderRadius: 1,
                            border: '1px solid rgba(37, 99, 235, 0.3)',
                          }}
                        >
                          {activeSessionForBatch.members.length} {activeSessionForBatch.members.length === 1 ? 'user' : 'users'} active
                        </Typography>
                      ) : (
                        <Box />
                      )}
                      <Box />
                    </Box>
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
        {isSessionMenuVisible && !sessionActiveForMenuBatch && (
          <MenuItem onClick={startSession} disabled={sessionPending} sx={{'&:hover': {bgcolor: '#dededeff'}}}>
            {sessionPending ? 'Starting session…' : startLabel}
          </MenuItem>
        )}
        {isSessionMenuVisible && sessionActiveForMenuBatch && sessionOwnedByCurrentUser && (
          <MenuItem onClick={stopSession} disabled={sessionPending} sx={{'&:hover': {bgcolor: '#dededeff'}}}>
            {sessionPending ? 'Stopping session…' : 'Stop Session'}
          </MenuItem>
        )}
        {isSessionMenuVisible && sessionActiveForMenuBatch && !sessionOwnedByCurrentUser && (
          <MenuItem onClick={stopSession} disabled={sessionPending} sx={{ color: 'warning.main', '&:hover': {bgcolor: '#dededeff'}}}>
            {sessionPending ? 'Stopping session…' : 'End Session (Session in progress by another user)'}
          </MenuItem>
        )}
        <MenuItem onClick={handleFinish} sx={{'&:hover': {bgcolor: '#dededeff'}}}>Finish</MenuItem>
        <MenuItem onClick={openRename} sx={{'&:hover': {bgcolor: '#dededeff'}}}>Rename</MenuItem>
        <MenuItem 
          onClick={openDelete} 
          sx={{
            color: '#b91c1c',
            '&:hover': {bgcolor: '#fee2e2', color: '#7f1d1d'}
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
              '& .MuiOutlinedInput-notchedOutline': { borderColor: '#999' },
              mb: "0.5rem",
              mt: "0.5rem",
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={closeRename}
            variant="outlined"
            color="secondary"
            sx = {{
              mb: "1rem",
            }}
          >
              Cancel
          </Button>
          <Button
            onClick={submitRename}
            disabled={isRenameDisabled}
            variant="contained"
            sx={{
              mb: "1rem",
              mr: "1rem",
              '&.Mui-disabled': { bgcolor: '#e2e8f0', color: '#94a3b8' },
            }}
          >
            {renaming ? 'Renaming...' : 'Rename'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onClose={closeDelete} fullWidth maxWidth="xs">
        <DialogTitle sx={{color: "#000"}}>Delete Batch</DialogTitle>
        <DialogContent>
          <Typography sx={{color: "#000"}}>Are you sure you want to delete this batch?</Typography>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={closeDelete} 
            variant="outlined"
            color="secondary"
          >
            Cancel
          </Button>
          <Button 
            onClick={confirmDelete} 
            disabled={deleting} 
            color="error" 
            variant="contained"
          >
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
        <DialogTitle sx={{ color: '#000' }}>Start Session</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography sx={{color: '#000'}}>{sessionCreationBatch ? `Start a new session for "${sessionCreationBatch.batchName}".` : 'Start a new session.'}</Typography>
          <Typography variant="body2" color="#2f2f2fff">
            Set an optional password so only people with the password can join. Leave blank to allow anyone with the session ID to join.
          </Typography>
          <TextField 
            label="Session password" 
            type="password" 
            value={sessionPasswordValue} 
            onChange={(e) => setSessionPasswordValue(e.target.value)} 
            disabled={sessionPending} 
            fullWidth 
            autoFocus 
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
              '& .MuiOutlinedInput-notchedOutline': { borderColor: '#999' },
              '&:hover': {
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#000' }
                  },
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelSessionCreation} disabled={sessionPending} variant="outlined" color="secondary">
            Cancel
          </Button>
          <Button
            onClick={() => {
              void handleCreateSessionWithPassword(sessionPasswordValue.trim() || undefined);
            }}
            disabled={sessionPending}
            variant="contained"
            color="primary"
          >
            {sessionPending ? 'Starting…' : 'Start Session'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Session End Warning Dialog */}
      <Dialog open={sessionEndWarningOpen} onClose={closeSessionEndWarning} fullWidth maxWidth="xs">
        <DialogTitle sx={{ color: '#000' }}>End Session Warning</DialogTitle>
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
