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
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar,
} from '@mui/material';
import { MyLocation, SelectAll, NotInterested, KeyboardArrowLeft, KeyboardArrowRight } from '@mui/icons-material';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import { annotateHandler, getCanvas, handleUndoRedo } from './annotateHandler';
import { ZoomHandler } from './zoomHandler';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useSearchParams } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { getBoundingBoxLabelNames, getKeypointLabelNames, getKeypointLabelName } from './labelRegistry';
import { getCentreOfCanvas } from './helper';
import { useAuthGuard } from '../utils/authUtil';
// import { useSharedImageHandler } from './imagehandlercontext';
import { useImageHandler } from './imageStateHandler';
import { initialiseSessionWebSocket, getActiveSessionID, sendActiveImageID, closeSessionWebSocket, setNavigateAway } from './sessionHandler';
import { fetchActiveSessionForBatch, kickSessionMember, type Member } from '../utils/intefaces/session';
import { sidebarHandler, type SidebarAnnotationItem } from './sidebarHandler';
import Fade from '@mui/material/Fade';

const AnnotatePage: React.FC = () => {
  // Helper for undo/redo actions
  // Type guards

  useAuthGuard();

  const navigate = useNavigate();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageHandler = useImageHandler();
  const latestImageHandlerRef = useRef(imageHandler);
  useEffect(() => {
    latestImageHandlerRef.current = imageHandler;
  }, [imageHandler]);
  // Ensure annotateHandler uses the same imageHandler instance
  useEffect(() => {
    annotateHandler.setImageHandler(imageHandler);
  });

  // inputImage is the value in the text box, separate from currentImageNumber
  const [inputImage, setInputImage] = useState(imageHandler.currentImageNumber.toString());
  const [selectedTool, setSelectedTool] = useState<string | null>('kp');
  const [searchParams] = useSearchParams();
  const batchID = searchParams.get('batchID') || '';
  const projectID = searchParams.get('projectID') || '';
  if (!batchID) {
    throw new Error('No batchID specified in URL');
  }
  if (!projectID) {
    throw new Error('No projectID specified in URL');
  }

  const [labelPrompt, setLabelPrompt] = useState<{
    open: boolean;
    kind: 'kp' | 'bb' | null;
    x: number;
    y: number;
    mode?: 'create' | 'edit';
  }>({ open: false, kind: null, x: 0, y: 0, mode: 'create' });
  const [sessionID, setSessionID] = useState<string | undefined>(getActiveSessionID());
  const [sessionRole, setSessionRole] = useState<'owner' | 'member' | undefined>();
  const [labelValue, setLabelValue] = useState('');
  const [kpOptions, setKpOptions] = useState<string[]>([]);
  const [bbOptions, setBbOptions] = useState<string[]>([]);
  const [hasPrev, setHasPrev] = useState(false);
  const [memberNotices, setMemberNotices] = useState<{ id: string; memberID: string; type: 'member_joined' | 'member_left' | 'owner_joined' | 'owner_left' }[]>([]);
  const [sessionLifecycle, setSessionLifecycle] = useState<{ type: 'session_closed' | 'member_kicked'; sessionID?: string; time?: string; role?: 'owner' | 'member' } | null>(null);
  const [sessionMembers, setSessionMembers] = useState<Member[]>([]);
  const [sessionOwner, setSessionOwner] = useState<string | undefined>();
  const [manageMembersOpen, setManageMembersOpen] = useState(false);
  const [viewMembersOpen, setViewMembersOpen] = useState(false);
  const [kickingMemberID, setKickingMemberID] = useState<string | null>(null);
  const [memberManagementError, setMemberManagementError] = useState<string | null>(null);
  const [sidebarItems, setSidebarItems] = useState<SidebarAnnotationItem[]>([]);
  const [copyToast, setCopyToast] = useState<{ open: boolean; message: string }>({ open: false, message: '' });

  const lastRenderKeyRef = useRef<string | null>(null);

  const boxRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const zoomHandlerRef = useRef<ZoomHandler | null>(null);

  const computeAvailableKeypointLabels = React.useCallback((currentLabel?: string, boundingBoxID?: string) => {
    const handler = latestImageHandlerRef.current;
    const allNames = getKeypointLabelNames();
    if (!handler) {
      return allNames;
    }

    const used = new Set<string>();
    try {
      const keypoints = handler.getKeypoints();
      keypoints.forEach((kp) => {
        if (boundingBoxID && kp.boundingBoxID !== boundingBoxID) {
          return;
        }
        const labelName = getKeypointLabelName(kp.labelID);
        if (labelName) {
          used.add(labelName);
        }
      });
    } catch (err) {
      console.warn('[Annotate] failed to collect keypoint labels in use', err);
    }

    if (currentLabel) {
      used.delete(currentLabel);
    }

    return allNames.filter((name) => !used.has(name));
  }, []);

  useEffect(() => {
    const boxEl = boxRef.current as HTMLDivElement | null;
    const canvasEl = canvasRef.current as HTMLCanvasElement | null;
    if (boxEl && canvasEl) {
      const { offsetWidth, offsetHeight } = boxEl;
      canvasEl.width = offsetWidth;
      canvasEl.height = offsetHeight;
    }
  }, []);

  // Initialize canvas via handler
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    annotateHandler.createCanvas(el);
    // Setup zoom handler
    zoomHandlerRef.current = new ZoomHandler({ canvas: getCanvas()! });
    zoomHandlerRef.current.attachWheelListener((newZoom) => setZoom(newZoom));
    setZoom(zoomHandlerRef.current.getZoom());
    // Attempt session websocket init (if cookies present)
    initialiseSessionWebSocket(getActiveSessionID()).then((res) => {
      if (res.sessionID) setSessionID(res.sessionID);
      if (res.role) setSessionRole(res.role);
    });
    return () => {
      annotateHandler.disposeCanvas();
      zoomHandlerRef.current = null;
    };
  }, []);

  // Notify websocket of current image ID whenever it changes and session active
  useEffect(() => {
    if (imageHandler.currentImageID) {
      sendActiveImageID(imageHandler.currentImageID);
    }
  }, [imageHandler.currentImageID]);

  // Render when batch or current image changes (composite key) and always sync displayed number
  useEffect(() => {
    const key = `${batchID}|${imageHandler.currentImageNumber}`;
    if (lastRenderKeyRef.current === key) {
      // Ensure field reflects current number even if render was skipped
      setInputImage(imageHandler.currentImageNumber.toString());
      return;
    }
    lastRenderKeyRef.current = key;
    (async () => {
      if (!batchID || !projectID) return;
      const canvas = getCanvas();
      if (!canvas || !canvas.getElement()) {
        console.error('Canvas not initialized yet');
        return;
      }
      try {
        const { current } = await annotateHandler.renderToCanvas(batchID, projectID);
        if (current !== imageHandler.currentImageNumber) {
          imageHandler.setCurrentImageNumber(current);
        }
        setInputImage((prev) => (prev !== current.toString() ? current.toString() : prev));
      } catch (e) {
        console.error('Error rendering to canvas:', e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageHandler.currentImageNumber]);

  // // Keep input field always synced if number changes from elsewhere (e.g. external control)
  useEffect(() => {
    setInputImage(imageHandler.currentImageNumber.toString());
  }, [imageHandler.currentImageNumber]);

  // Keep handler tool selection in sync with UI
  useEffect(() => {
    const t = selectedTool;
    if (t === 'kp' || t === 'bb') annotateHandler.setTool(t);
    else annotateHandler.setTool('none');
  }, [selectedTool]);

  // Subscribe to label requests from handler
  useEffect(() => {
    const unsub = annotateHandler.subscribeLabelRequests((req) => {
      const opts = req.kind === 'kp' ? computeAvailableKeypointLabels(req.currentLabel, req.boundingBoxID) : getBoundingBoxLabelNames();

      if (req.kind === 'kp') {
        setKpOptions(opts);
      } else {
        setBbOptions(opts);
      }

      if (!req.preserveLabel) {
        const initial = req.currentLabel && opts.includes(req.currentLabel) ? req.currentLabel : opts[0] || '';
        setLabelValue(initial);
      }
      setLabelPrompt((prev) => ({
        open: true,
        kind: req.kind === 'kp' ? 'kp' : 'bb',
        x: req.x,
        y: req.y,
        mode: req.mode ?? prev.mode ?? 'create',
      }));
    });
    return () => {
      unsub();
    };
  }, [computeAvailableKeypointLabels]);

  // Subscribe to sidebar updates
  useEffect(() => {
    const unsubscribe = sidebarHandler.subscribe(setSidebarItems);
    return unsubscribe;
  }, []);

  // Undo/Redo keydown handler
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Close label prompt on Escape
      if (e.key === 'Escape' && labelPrompt.open) {
        e.preventDefault();
        annotateHandler.cancelLabel();
        setLabelPrompt({ open: false, kind: null, x: 0, y: 0, mode: 'create' });
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndoRedo('undo');
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleUndoRedo('redo');
      }
      if ((e.key === 'Backspace' || e.key === 'Delete') && labelPrompt.mode === 'edit') {
        e.preventDefault();
        annotateHandler.deleteSelected();
        setLabelPrompt({ open: false, kind: null, x: 0, y: 0, mode: 'create' });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [labelPrompt.open, labelPrompt.mode, searchParams]);

  useEffect(() => {
    if (!imageHandler.currentImageID) return;
    async function checkPrev() {
      const result = await annotateHandler.hasPrevAnnotations(imageHandler.currentImageID);
      setHasPrev(result);
    }
    checkPrev();
  }, [imageHandler.currentImageID]);

  const handleToolChange = (_event: React.MouseEvent<HTMLElement>, newTool: string | null) => {
    if (newTool !== null) setSelectedTool(newTool);
  };

  const handlePrev = () => {
    imageHandler.prevImage();
  };

  const handleNext = () => {
    imageHandler.nextImage();
  };

  // Zoom button handlers
  const handleZoomIn = () => {
    if (zoomHandlerRef.current) {
      const canvas = getCanvas();
      if (canvas) {
        const center = getCentreOfCanvas(canvas);
        zoomHandlerRef.current.zoomIn(center);
        setZoom(zoomHandlerRef.current.getZoom());
      }
    }
  };
  const handleZoomOut = () => {
    if (zoomHandlerRef.current) {
      const canvas = getCanvas();
      if (canvas) {
        const center = getCentreOfCanvas(canvas);
        zoomHandlerRef.current.zoomOut(center);
        setZoom(zoomHandlerRef.current.getZoom());
      }
    }
  };
  const handleZoomReset = () => {
    if (zoomHandlerRef.current) {
      zoomHandlerRef.current.resetZoom();
      setZoom(zoomHandlerRef.current.getZoom());
    }
  };

  // Decide where to navigate to depending on the sessionRole
  const NavigateAway = React.useCallback(() => {
    if (sessionRole === 'member') {
      navigate('/');
    } else if (projectID) {
      navigate(`/projects/${projectID}?view=batches`);
    } else {
      navigate(-1);
    }
  }, [sessionRole, projectID, navigate]);

  useEffect(() => {
    setNavigateAway(NavigateAway);
  }, [NavigateAway]);

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ type: 'session_closed' | 'member_kicked'; sessionID?: string; time?: string }>;
      if (!ce.detail?.type) return;
      setSessionLifecycle({
        type: ce.detail.type,
        sessionID: ce.detail.sessionID,
        time: ce.detail.time,
        role: sessionRole,
      });
      setSessionID(undefined);
      setSessionRole(undefined);
    };
    window.addEventListener('canary-session-lifecycle', handler as EventListener);
    return () => window.removeEventListener('canary-session-lifecycle', handler as EventListener);
  }, [sessionRole]);

  const refreshSessionMembers = React.useCallback(async () => {
    if (!sessionID) {
      setSessionMembers([]);
      setSessionOwner(undefined);
      return;
    }
    try {
      const session = await fetchActiveSessionForBatch(batchID);
      if (session && session.sessionID === sessionID) {
        setSessionMembers(session.members || []);
        setSessionOwner(session.owner?.email || '');
      } else {
        setSessionMembers([]);
        setSessionOwner(undefined);
      }
    } catch (err) {
      console.warn('[Annotate] failed to refresh session members', err);
      setSessionMembers([]);
      setSessionOwner(undefined);
    }
  }, [sessionID, batchID]);

  const closeManageMembers = React.useCallback(() => {
    setManageMembersOpen(false);
    setMemberManagementError(null);
    setKickingMemberID(null);
  }, []);

  const closeViewMembers = React.useCallback(() => {
    setViewMembersOpen(false);
  }, []);

  const openManageMembers = React.useCallback(() => {
    setMemberManagementError(null);
    setKickingMemberID(null);
    refreshSessionMembers();
    setManageMembersOpen(true);
  }, [refreshSessionMembers]);

  const openViewMembers = React.useCallback(() => {
    refreshSessionMembers();
    setViewMembersOpen(true);
  }, [refreshSessionMembers]);

  useEffect(() => {
    if (sessionRole !== 'owner' || !sessionID) {
      setSessionMembers([]);
      setSessionOwner(undefined);
      return;
    }
    refreshSessionMembers();
  }, [sessionRole, sessionID, refreshSessionMembers]);

  const handleKickMember = React.useCallback(
    async (memberID: string) => {
      if (!sessionID) return;
      setMemberManagementError(null);
      setKickingMemberID(memberID);
      try {
        const result = await kickSessionMember(sessionID, memberID);
        if (!result.ok) {
          setMemberManagementError(result.error || 'Failed to remove member');
        }
      } catch (err) {
        setMemberManagementError(err instanceof Error ? err.message : 'Failed to remove member');
      } finally {
        await refreshSessionMembers();
        setKickingMemberID(null);
      }
    },
    [sessionID, refreshSessionMembers],
  );

  const sessionLifecycleMessage = React.useMemo(() => {
    if (!sessionLifecycle) return '';
    if (sessionLifecycle.type === 'member_kicked') {
      return 'You have been removed from this session by the host.';
    }
    if (sessionLifecycle.role === 'owner') {
      return 'The session has been stopped.';
    }
    return 'The host has ended this session.';
  }, [sessionLifecycle]);

  const handleSessionLifecycleClose = React.useCallback(() => {
    setSessionLifecycle(null);
    setSessionMembers([]);
    setSessionOwner(undefined);
    closeManageMembers();
    closeViewMembers();
    NavigateAway();
  }, [NavigateAway, closeManageMembers, closeViewMembers]);

  const handleCopySessionID = React.useCallback(async (event: React.MouseEvent, sessionIDToCopy?: string) => {
    event.stopPropagation();
    if (!sessionIDToCopy) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(sessionIDToCopy);
      } else {
        const el = document.createElement('textarea');
        el.value = sessionIDToCopy;
        el.style.position = 'fixed';
        el.style.opacity = '0';
        document.body.appendChild(el);
        el.focus();
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setCopyToast({ open: true, message: `Session ID copied: ${sessionIDToCopy}` });
    } catch (err) {
      console.warn('Failed to copy session ID', err);
      setCopyToast({ open: true, message: 'Unable to copy session ID' });
    }
  }, []);

  // Listen for member join/left events dispatched by sessionHandler and show ephemeral notices
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ type: 'member_joined' | 'member_left' | 'owner_joined' | 'owner_left'; memberID: string; memberEmail?: string }>; // time optional
      if (!ce.detail?.memberID) return;
      const displayName = ce.detail.memberEmail || ce.detail.memberID;
      const id = `${ce.detail.type}-${ce.detail.memberID}-${Date.now()}`;
      setMemberNotices((prev) => [...prev, { id, memberID: displayName, type: ce.detail.type }]);
      if (ce.detail.type !== 'owner_joined' && ce.detail.type !== 'owner_left' && sessionRole === 'owner') {
        refreshSessionMembers();
      }
      // Refresh for view members dialog too
      if (ce.detail.type !== 'owner_joined' && ce.detail.type !== 'owner_left' && viewMembersOpen) {
        refreshSessionMembers();
      }
      // Auto-remove after 3s
      setTimeout(() => {
        setMemberNotices((prev) => prev.filter((n) => n.id !== id));
      }, 3000);
    };
    window.addEventListener('canary-session-member-event', handler as EventListener);
    return () => window.removeEventListener('canary-session-member-event', handler as EventListener);
  }, [refreshSessionMembers, sessionRole, viewMembersOpen]);

  return (
    <Box sx={{ display: 'flex', height: '100vh', bgcolor: '#f5f5f5' }}>
      {/* Left Sidebar - Annotations List */}
      <Paper
        elevation={2}
        sx={{
          width: 280,
          minWidth: 280,
          maxWidth: 320,
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
          Annotations
        </Typography>
        <Box
          sx={{
            flexGrow: 1,
            overflow: 'auto',
            maxHeight: 'calc(100vh - 120px)',
          }}
        >
          {sidebarItems.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', textAlign: 'center', mt: 4 }}>
              No annotations on this image
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {sidebarItems.map((item) => (
                <Paper
                  key={item.id}
                  elevation={1}
                  sx={{
                    p: 1.5,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    borderLeft: `4px solid ${item.type === 'keypoint' ? '#f97316' : '#2563eb'}`,
                    ml: item.type === 'keypoint' ? 2 : 0,
                    bgcolor: item.type === 'keypoint' ? 'rgba(249, 115, 22, 0.06)' : undefined,
                    '&:hover': {
                      elevation: 2,
                      bgcolor: 'action.hover',
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: item.type === 'keypoint' ? '#f97316' : '#2563eb',
                        flexShrink: 0,
                      }}
                    />
                    <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
                      {item.type === 'keypoint' ? 'KP' : 'BB'}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500, flexGrow: 1 }}>
                      {item.label}
                    </Typography>
                  </Box>
                  {item.type === 'keypoint' ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                        Position: ({item.position.x}, {item.position.y})
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                        Bounding Box: {item.boundingBoxLabel ?? 'Unassigned'}
                      </Typography>
                    </Box>
                  ) : (
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                      Center: ({item.center.x}, {item.center.y}) | Size: {item.bounds.maxX - item.bounds.minX}×{item.bounds.maxY - item.bounds.minY}
                    </Typography>
                  )}
                </Paper>
              ))}
            </Box>
          )}
        </Box>
      </Paper>

      {/* Main Content */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Top Toolbar */}
        <AppBar position="static" color="default" elevation={1}>
          <Toolbar sx={{ position: 'relative', minHeight: 64 }}>
            {/* Back Button Top Left */}
            <IconButton
              aria-label="back"
              edge="start"
              sx={{ position: 'absolute', left: 8, top: 8 }}
              onClick={() => {
                closeSessionWebSocket(1000, 'navigate away');
              }}
            >
              <ExitToAppIcon />
            </IconButton>
            <Box
              sx={{
                flexGrow: 1,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 1,
              }}
            >
              {sessionID && (
                <Paper
                  elevation={2}
                  sx={{
                    px: 2,
                    py: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    cursor: 'pointer',
                    '&:hover': {
                      bgcolor: 'action.hover',
                    },
                  }}
                  onClick={(e) => handleCopySessionID(e, sessionID)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleCopySessionID(e as unknown as React.MouseEvent, sessionID);
                    }
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }} title="Click to copy session ID">
                    Session: {sessionID}
                    {sessionRole ? ` (${sessionRole})` : ''}
                  </Typography>
                </Paper>
              )}
              {sessionRole === 'owner' && sessionID && (
                <Button variant="outlined" size="small" onClick={openManageMembers} sx={{ textTransform: 'none', fontWeight: 600 }}>
                  Manage members
                </Button>
              )}
              {sessionRole === 'member' && sessionID && (
                <Button variant="outlined" size="small" onClick={openViewMembers} sx={{ textTransform: 'none', fontWeight: 600 }}>
                  View members
                </Button>
              )}
              <IconButton aria-label="previous image" onClick={handlePrev}>
                <KeyboardArrowLeft />
              </IconButton>
              <Paper
                elevation={2}
                sx={{
                  px: 2,
                  py: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <TextField
                  size="small"
                  type="number"
                  value={inputImage}
                  inputProps={{ style: { textAlign: 'center', width: 60 } }}
                  sx={{
                    width: 40,
                    '& input[type=number]': {
                      MozAppearance: 'textfield',
                    },
                    '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button': {
                      WebkitAppearance: 'none',
                      margin: 0,
                    },
                  }}
                  onChange={(e) => {
                    setInputImage(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      imageHandler.setInputImage(inputImage);
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  onBlur={() => {
                    imageHandler.setInputImage(inputImage);
                  }}
                />
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  / {imageHandler.getTotalImageCount()}
                </Typography>
              </Paper>
              <IconButton aria-label="next image" onClick={handleNext}>
                <KeyboardArrowRight />
              </IconButton>
            </Box>
            {/* Zoom Controls Top Right */}
            <Box sx={{ position: 'absolute', right: 16, top: 8, display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconButton aria-label="zoom out" size="small" onClick={handleZoomOut}>
                <RemoveIcon />
              </IconButton>
              <Typography variant="body2" sx={{ minWidth: 40, textAlign: 'center' }}>
                {Math.round(zoom * 100)}%
              </Typography>
              <IconButton aria-label="zoom in" size="small" onClick={handleZoomIn}>
                <AddIcon />
              </IconButton>
              <IconButton aria-label="reset zoom" size="small" onClick={handleZoomReset}>
                <RefreshIcon />
              </IconButton>
            </Box>
          </Toolbar>
        </AppBar>

        {/* Canvas */}
        <Box
          sx={{
            flexGrow: 1,
            position: 'relative',
            p: 2,
            height: '100%',
            maxHeight: 'calc(100vh - 64px)', // subtract toolbar height if needed
            maxWidth: '100vw',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          ref={boxRef}
        >
          {/* Ephemeral member join/leave notifications */}
          <Box sx={{ position: 'absolute', top: 8, left: 8, display: 'flex', flexDirection: 'column', gap: 1, zIndex: 10 }}>
            {memberNotices.map((n) => (
              <Fade in key={n.id} timeout={{ enter: 200, exit: 300 }}>
                <Paper
                  elevation={4}
                  sx={{
                    px: 1.5,
                    py: 0.5,
                    bgcolor: n.type === 'member_joined' ? '#2e7d32' : n.type === 'member_left' ? '#c62828' : n.type === 'owner_joined' ? '#1d4ed8' : '#c62828',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 1,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                  }}
                >
                  {n.type === 'member_joined' ? 'Member joined: ' : n.type === 'member_left' ? 'Member left: ' : n.type === 'owner_joined' ? 'Owner joined: ' : 'Owner left: '}
                  {n.memberID}
                </Paper>
              </Fade>
            ))}
          </Box>
          {/* Width/height are set programmatically in useEffect to match container; rely on style for initial sizing */}
          <canvas
            ref={canvasRef}
            style={{
              width: '100%',
              height: '100%',
              display: 'block',
              maxWidth: '100%',
              maxHeight: '100%',
            }}
          />
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
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <InputLabel id="label-select">{labelPrompt.kind === 'kp' ? 'Keypoint label' : 'Box label'}</InputLabel>
                <Select
                  labelId="label-select"
                  label={labelPrompt.kind === 'kp' ? 'Keypoint label' : 'Box label'}
                  autoFocus
                  value={labelValue}
                  onChange={(e) => setLabelValue(e.target.value as string)}
                >
                  {(labelPrompt.kind === 'kp' ? kpOptions : bbOptions).map((opt) => (
                    <MenuItem key={opt} value={opt}>
                      {opt}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                variant="contained"
                size="small"
                onClick={() => {
                  if (labelValue) {
                    annotateHandler.confirmLabel(labelValue, projectID);
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

      {/* Right Sidebar (Tools moved here, centered) */}
      <Paper
        elevation={2}
        sx={{
          width: 140,
          minWidth: 140,
          maxWidth: 160,
          flexShrink: 0,
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          height: '100%',
        }}
      >
        <Typography variant="h6" sx={{ mb: 1, mt: 0 }}>
          Tools
        </Typography>
        {/* Centered tool controls container */}
        <Box sx={{ flexGrow: 1, width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 3 }}>
          <ToggleButtonGroup
            orientation="vertical"
            value={selectedTool}
            exclusive
            onChange={handleToolChange}
            aria-label="tool selection"
            sx={{
              alignItems: 'center',
              gap: 2,
              '& .MuiToggleButtonGroup-grouped': {
                margin: 0,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
              },
              '& .MuiToggleButtonGroup-grouped:not(:first-of-type)': {
                marginTop: 0,
                borderTopLeftRadius: 2,
                borderTopRightRadius: 2,
              },
            }}
          >
            <ToggleButton
              value="kp"
              aria-label="keypoint"
              sx={{
                width: 100,
                height: 100,
                flexDirection: 'column',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'visible',
                py: 1,
              }}
            >
              <MyLocation fontSize="large" />
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                KP
              </Typography>
            </ToggleButton>
            <ToggleButton
              value="bb"
              aria-label="bounding-box"
              sx={{
                width: 100,
                height: 100,
                flexDirection: 'column',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'visible',
                py: 1,
              }}
            >
              <SelectAll fontSize="large" />
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                BB
              </Typography>
            </ToggleButton>
          </ToggleButtonGroup>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Button
              variant="outlined"
              sx={{ width: 100, height: 100, flexDirection: 'column' }}
              onClick={() => annotateHandler.copyPrevAnnotations(imageHandler.currentImageID, batchID, projectID)}
              disabled={!hasPrev}
            >
              <NotInterested fontSize="large" />
              <Typography variant="body2">CPY</Typography>
            </Button>
          </Box>
        </Box>
      </Paper>
      <Dialog open={manageMembersOpen} onClose={closeManageMembers} fullWidth maxWidth="sm">
        <DialogTitle>Session members</DialogTitle>
        <DialogContent dividers>
          {memberManagementError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {memberManagementError}
            </Alert>
          )}
          {(sessionMembers || []).length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No members are currently connected.
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {(sessionMembers || []).map((member) => (
                <Paper key={member.id} variant="outlined" sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      {member.email}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Member
                    </Typography>
                  </Box>
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    onClick={() => handleKickMember(member.id)}
                    disabled={kickingMemberID === member.id}
                    sx={{ textTransform: 'none', fontWeight: 600 }}
                  >
                    {kickingMemberID === member.id ? 'Removing…' : 'Remove'}
                  </Button>
                </Paper>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeManageMembers}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={viewMembersOpen} onClose={closeViewMembers} fullWidth maxWidth="sm">
        <DialogTitle>Session participants</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {sessionOwner && (
              <Paper variant="outlined" sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, bgcolor: 'primary.50' }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {sessionOwner}
                  </Typography>
                  <Typography variant="caption" color="primary.main" sx={{ fontWeight: 600 }}>
                    Owner
                  </Typography>
                </Box>
              </Paper>
            )}
            {(sessionMembers || []).length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No other members are currently connected.
              </Typography>
            ) : (
              (sessionMembers || []).map((member) => (
                <Paper key={member.id} variant="outlined" sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      {member.email}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Member
                    </Typography>
                  </Box>
                </Paper>
              ))
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeViewMembers}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(sessionLifecycle)} onClose={handleSessionLifecycleClose} fullWidth maxWidth="xs">
        <DialogTitle>{sessionLifecycle?.type === 'member_kicked' ? 'Removed from session' : 'Session ended'}</DialogTitle>
        <DialogContent>
          <Typography sx={{ mt: 1 }}>{sessionLifecycleMessage}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleSessionLifecycleClose} variant="contained" autoFocus>
            {sessionLifecycle?.role === 'owner' ? 'Back to project' : 'Return home'}
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

export default AnnotatePage;
