import { useCallback, useEffect, useMemo, useState } from 'react';
import { CallAPI, projectServiceUrl } from '../../utils/apis';
import type { Batch } from '../../utils/intefaces/interfaces';
import { createSession, endSession, fetchActiveSessions, joinSession, type ActiveSessionResponse } from '../../utils/intefaces/session';
import { setCookie, clearCookie, getUserIDFromCookie } from '../../utils/cookieUtils';

// If you need stronger typing for the navigate function you can import from react-router-dom.
// We keep it generic here to avoid coupling this logic file to router implementation details.
type NavigateFn = (path: string) => void;

export async function fetchBatches(projectID: string): Promise<Batch[]> {
  const url = `${projectServiceUrl()}/projects/${projectID}/batches`;
  const data = await CallAPI<unknown>(url);
  const arr = Array.isArray(data) ? data : [];
  const normalized = arr.map(normalizeBatch);
  return normalized.filter((it) => !it.isComplete);
}

type ImageMeta = { imageID: string; imageURL: string };

export async function fetchFirstImageURL(batchID: string, tries = 3, delayMs = 500): Promise<string | undefined> {
  const url = `${projectServiceUrl()}/batch/${batchID}/images`;
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      const data = await CallAPI<unknown>(url);
      const arr = Array.isArray(data) ? (data as ImageMeta[]) : [];
      const first = arr[0];
      if (first?.imageURL) return String(first.imageURL);
    } catch {
      // ignore per-attempt error
    }
    if (attempt < tries - 1) {
      await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
    }
  }
  return undefined;
}

export async function renameBatch(batchID: string, newBatchName: string): Promise<void> {
  const url = `${projectServiceUrl()}/batch/${batchID}`;
  await CallAPI<void>(url, {
    method: 'PATCH',
    json: { batchName: newBatchName },
    // Backend returns plain text, not JSON
    parseJson: false,
  });
}

export async function setBatchFinishState(batchID: string, isComplete: boolean): Promise<void> {
  const url = `${projectServiceUrl()}/batch/${batchID}`;
  await CallAPI<void>(url, {
    method: 'PATCH',
    json: { isComplete: isComplete },
    // Backend returns plain text, not JSON
    parseJson: false,
  });
}

export async function deleteBatch(batchID: string): Promise<void> {
  const url = `${projectServiceUrl()}/batch/${batchID}`;
  await CallAPI<void>(url, {
    method: 'DELETE',
    // Backend returns plain text, not JSON
    parseJson: false,
  });
}

// --- Helpers ---

function toNumber(v: unknown, def = 0): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return isNaN(n) ? def : n;
  }
  return def;
}

function toStringMaybe(v: unknown, def = ''): string {
  return v === undefined || v === null ? def : String(v);
}

function normalizeBatch(raw: unknown): Batch {
  // This function extracts and normalizes the fields for a Batch object from raw API data.
  const obj = raw as Record<string, unknown>;
  return {
    batchID: toStringMaybe(obj['batchID']),
    batchName: toStringMaybe(obj['batchName']),
    projectID: toStringMaybe(obj['projectID']),
    numberOfTotalFiles: toNumber(obj['numberOfTotalFiles']),
    lastUpdated: toStringMaybe(obj['lastUpdated'], ''),
    isComplete: obj['isComplete'] === true,
  };
}

export function useBatchesTab(projectID?: string) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionPending, setSessionPending] = useState(false);
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [sessionCreationBatchId, setSessionCreationBatchId] = useState<string | null>(null);

  // menu state
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [menuBatchId, setMenuBatchId] = useState<string | null>(null);

  // rename state
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);

  // delete state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // session end warning state
  const [sessionEndWarningOpen, setSessionEndWarningOpen] = useState(false);

  const selectedBatch = useMemo(() => batches.find((b) => b.batchID === menuBatchId) || null, [batches, menuBatchId]);
  const [activeSessionsByBatch, setActiveSessionsByBatch] = useState<Record<string, ActiveSessionResponse>>({});

  const refreshActiveSessions = useCallback(async () => {
    if (!projectID) {
      setActiveSessionsByBatch({});
      return;
    }
    try {
      const sessions = await fetchActiveSessions(projectID);
      const next = sessions.reduce<Record<string, ActiveSessionResponse>>((acc, session) => {
        if (session.batchID) {
          acc[session.batchID] = session;
        }
        return acc;
      }, {});
      setActiveSessionsByBatch(next);
    } catch (e) {
      console.error('Failed to refresh active sessions', e);
    }
  }, [projectID]);

  const load = useCallback(async () => {
    if (!projectID) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBatches(projectID);
      // in parallel fetch first image URLs for blurred previews
      const withPreviews = await Promise.all(
        (data || []).map(async (b) => {
          const preview = await fetchFirstImageURL(b.batchID);
          return { ...b, previewURL: preview } as Batch;
        }),
      );
      setBatches(withPreviews || []);
      // If some batches report files but no preview yet (metadata race), retry once after a short delay
      const needRetry = (withPreviews || []).filter((b) => !b.previewURL && b.numberOfTotalFiles > 0);
      if (needRetry.length) {
        setTimeout(async () => {
          const updates = await Promise.all(needRetry.map(async (b) => ({ id: b.batchID, url: await fetchFirstImageURL(b.batchID, 2, 600) })));
          setBatches((prev) =>
            prev.map((b) => {
              const u = updates.find((x) => x.id === b.batchID);
              return u?.url ? { ...b, previewURL: u.url } : b;
            }),
          );
        }, 1200);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load batches');
    } finally {
      setLoading(false);
    }
  }, [projectID]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!projectID) {
      setActiveSessionsByBatch({});
      return;
    }
    refreshActiveSessions();
    const timer = window.setInterval(() => {
      refreshActiveSessions();
    }, 20000);
    return () => window.clearInterval(timer);
  }, [projectID, refreshActiveSessions]);

  // menu handlers
  const openMenu = useCallback((evt: React.MouseEvent<HTMLElement>, batchID: string) => {
    evt.stopPropagation();
    setMenuAnchorEl(evt.currentTarget);
    setMenuBatchId(batchID);
  }, []);

  const closeMenu = useCallback(() => {
    setMenuAnchorEl(null);
    setMenuBatchId(null);
  }, []);

  const handleFinish = useCallback(async () => {
    closeMenu();
    if (!selectedBatch) return;

    // Check if there's an active session for this batch and end it first
    const activeSession = activeSessionsByBatch[selectedBatch.batchID];
    if (activeSession) {
      try {
        const result = await endSession(activeSession.sessionID);
        if (!result.ok) {
          setError(result.error || 'Failed to stop session before finishing batch');
          return;
        }
        // Clear session cookies and update state
        clearCookie('create_session_cookie');
        clearCookie('session_id_cookie');
        clearCookie('join_session_cookie');
        setActiveSessionsByBatch((prev) => {
          const next = { ...prev };
          delete next[selectedBatch.batchID];
          return next;
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to stop session before finishing batch');
        return;
      }
    }

    // Now finish the batch
    try {
      await setBatchFinishState(selectedBatch.batchID, true);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to finish batch');
    }
  }, [closeMenu, selectedBatch, activeSessionsByBatch, load]);

  // rename flow
  const openRename = useCallback(() => {
    if (!selectedBatch) return;
    setRenameValue(selectedBatch.batchName);
    setRenameOpen(true);
    setMenuAnchorEl(null);
  }, [selectedBatch]);

  const closeRename = useCallback(() => {
    setRenameOpen(false);
  }, []);

  const submitRename = useCallback(async () => {
    if (!menuBatchId) return;
    setRenaming(true);
    try {
      await renameBatch(menuBatchId, renameValue.trim());
      setBatches((prev) => prev.map((b) => (b.batchID === menuBatchId ? { ...b, batchName: renameValue.trim() } : b)));
      setRenameOpen(false);
      setMenuBatchId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to rename batch');
    } finally {
      setRenaming(false);
    }
  }, [menuBatchId, renameValue]);

  // delete flow
  const openDelete = useCallback(() => {
    setDeleteOpen(true);
    setMenuAnchorEl(null);
  }, []);

  const closeDelete = useCallback(() => {
    setDeleteOpen(false);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!menuBatchId) return;
    setDeleting(true);

    try {
      // Check if there's an active session for this batch and end it first
      const activeSession = activeSessionsByBatch[menuBatchId];
      if (activeSession) {
        const result = await endSession(activeSession.sessionID);
        if (!result.ok) {
          setError(result.error || 'Failed to stop session before deleting batch');
          return;
        }
        // Clear session cookies and update state
        clearCookie('create_session_cookie');
        clearCookie('session_id_cookie');
        clearCookie('join_session_cookie');
        setActiveSessionsByBatch((prev) => {
          const next = { ...prev };
          delete next[menuBatchId];
          return next;
        });
      }

      // Now delete the batch
      await deleteBatch(menuBatchId);
      setBatches((prev) => prev.filter((b) => b.batchID !== menuBatchId));
      setDeleteOpen(false);
      setMenuBatchId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete batch');
    } finally {
      setDeleting(false);
    }
  }, [menuBatchId, activeSessionsByBatch]);

  const startSession = useCallback(() => {
    if (!selectedBatch || sessionPending) return;
    setError(null);
    if (activeSessionsByBatch[selectedBatch.batchID]) {
      setError('This batch already has an active session running.');
      return;
    }
    setSessionCreationBatchId(selectedBatch.batchID);
    setSessionDialogOpen(true);
    closeMenu();
  }, [selectedBatch, sessionPending, activeSessionsByBatch, closeMenu]);

  const cancelSessionCreation = useCallback(() => {
    setSessionDialogOpen(false);
    setSessionCreationBatchId(null);
  }, []);

  const handleCreateSessionWithPassword = useCallback(
    async (password?: string) => {
      if (!sessionCreationBatchId) return;
      setSessionPending(true);
      setError(null);
      try {
        const batchForSession = batches.find((b) => b.batchID === sessionCreationBatchId);
        const result = await createSession(sessionCreationBatchId, password);
        if (!result.ok) {
          setError(result.error || 'Failed to start session');
          return;
        }
        const batchID = result.data.batchID || sessionCreationBatchId;
        const projectForSession = result.data.projectID || projectID || batchForSession?.projectID;
        const sessionID = result.data.sessionID;
        const ownerID = getUserIDFromCookie();
        if (ownerID && sessionID && batchID && projectForSession) {
          setActiveSessionsByBatch((prev) => ({
            ...prev,
            [batchID]: {
              sessionID,
              batchID,
              projectID: projectForSession,
              owner: { id: ownerID, email: '' },
              members: [],
              ownerConnected: true,
              lastUpdated: new Date().toISOString(),
            },
          }));
        }
        await refreshActiveSessions();
        cancelSessionCreation();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to start session');
      } finally {
        setSessionPending(false);
      }
    },
    [sessionCreationBatchId, batches, projectID, refreshActiveSessions, cancelSessionCreation],
  );

  const sessionCreationBatch = useMemo(() => {
    if (!sessionCreationBatchId) return null;
    return batches.find((b) => b.batchID === sessionCreationBatchId) || null;
  }, [sessionCreationBatchId, batches]);

  const performStopSession = useCallback(async () => {
    if (!menuBatchId || sessionPending) return;
    const sessionToStop = activeSessionsByBatch[menuBatchId];
    if (!sessionToStop) return;
    closeMenu();
    setSessionPending(true);
    setError(null);
    try {
      const result = await endSession(sessionToStop.sessionID);
      if (!result.ok) {
        setError(result.error || 'Failed to stop session');
        return;
      }
      clearCookie('create_session_cookie');
      clearCookie('session_id_cookie');
      clearCookie('join_session_cookie');
      setActiveSessionsByBatch((prev) => {
        const next = { ...prev };
        delete next[menuBatchId];
        return next;
      });
      await refreshActiveSessions();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to stop session');
    } finally {
      setSessionPending(false);
    }
  }, [menuBatchId, activeSessionsByBatch, sessionPending, closeMenu, refreshActiveSessions]);

  const stopSession = useCallback(async () => {
    if (!menuBatchId || sessionPending) return;
    const sessionToStop = activeSessionsByBatch[menuBatchId];
    if (!sessionToStop) return;

    // Check if current user is the owner
    const currentUserID = getUserIDFromCookie();
    const isOwner = currentUserID && sessionToStop.owner.id === currentUserID;

    if (!isOwner) {
      // Show warning dialog for non-owners
      setSessionEndWarningOpen(true);
      return;
    }

    // Direct stop for owners
    await performStopSession();
  }, [menuBatchId, activeSessionsByBatch, sessionPending, performStopSession]);

  const openSessionEndWarning = useCallback(() => {
    setSessionEndWarningOpen(true);
    setMenuAnchorEl(null);
  }, []);

  const closeSessionEndWarning = useCallback(() => {
    setSessionEndWarningOpen(false);
  }, []);

  const confirmStopSession = useCallback(async () => {
    setSessionEndWarningOpen(false);
    await performStopSession();
  }, [performStopSession]);

  // Batch selection (navigate to annotate) centralised so we can add pre-navigation logic (e.g. analytics, session checks, prefetch) later
  const openBatch = useCallback(
    async (batch: Batch, navigate: NavigateFn) => {
      if (!batch) return;
      const targetProjectID = projectID ?? batch.projectID;
      const navigateURL = `/annotate?batchID=${encodeURIComponent(batch.batchID)}&projectID=${encodeURIComponent(targetProjectID)}`;
      const activeSessionForBatch = activeSessionsByBatch[batch.batchID];
      const currentUserID = getUserIDFromCookie();
      if (currentUserID && activeSessionForBatch && activeSessionForBatch.owner.id === currentUserID) {
        try {
          const joinResult = await joinSession(activeSessionForBatch.sessionID, '');
          if (joinResult.ok) {
            const { token, sessionID } = joinResult.data;
            if (token) setCookie('create_session_cookie', token);
            if (sessionID) setCookie('session_id_cookie', sessionID);
          } else {
            console.warn('[BatchesTab] failed to refresh owner session token', joinResult.error);
          }
        } catch (err) {
          console.warn('[BatchesTab] owner token refresh failed', err);
        }
      }
      navigate(navigateURL);
    },
    [projectID, activeSessionsByBatch],
  );

  return {
    // data
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
    closeRename,
    submitRename,
    renaming,
    // delete
    deleteOpen,
    openDelete,
    closeDelete,
    confirmDelete,
    deleting,
    // sessions
    sessionPending,
    activeSessionsByBatch,
    startSession,
    stopSession,
    refreshActiveSessions,
    sessionDialogOpen,
    sessionCreationBatch,
    cancelSessionCreation,
    handleCreateSessionWithPassword,
    // session end warning
    sessionEndWarningOpen,
    openSessionEndWarning,
    closeSessionEndWarning,
    confirmStopSession,
    // selection
    openBatch,
    // utils
    reload: load,
  };
}
