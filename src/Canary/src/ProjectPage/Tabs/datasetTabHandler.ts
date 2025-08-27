import { useCallback, useEffect, useMemo, useState } from 'react';
import { CallAPI } from '../../utils/apis';

export interface Batch {
  batchID: string;
  batchName: string;
  projectID: string;
  numberOfTotalFiles: number;
}

function projectServiceUrl() {
  return import.meta.env.VITE_PROJECT_SERVICE_URL as string;
}

export async function fetchBatches(projectID: string): Promise<Batch[]> {
  const url = `${projectServiceUrl()}/projects/${projectID}/batches`;
  const data = await CallAPI<unknown>(url);
  const arr = Array.isArray(data) ? data : [];
  return arr.map(normalizeBatch);
}

export async function renameBatch(batchID: string, newBatchName: string): Promise<void> {
  const url = `${projectServiceUrl()}/batch/${batchID}`;
  await CallAPI<void>(url, {
    method: 'PUT',
    json: { newBatchName },
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
  };
}

export function useDatasetTab(projectID?: string) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const selectedBatch = useMemo(() => batches.find((b) => b.batchID === menuBatchId) || null, [batches, menuBatchId]);

  const load = useCallback(async () => {
    if (!projectID) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBatches(projectID);
      setBatches(data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load batches');
    } finally {
      setLoading(false);
    }
  }, [projectID]);

  useEffect(() => {
    load();
  }, [load]);

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

  // Finish action (no-op for now)
  const handleFinish = useCallback(() => {
    closeMenu();
  }, [closeMenu]);

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
      await deleteBatch(menuBatchId);
      setBatches((prev) => prev.filter((b) => b.batchID !== menuBatchId));
      setDeleteOpen(false);
      setMenuBatchId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete batch');
    } finally {
      setDeleting(false);
    }
  }, [menuBatchId]);

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
    // utils
    reload: load,
  };
}
