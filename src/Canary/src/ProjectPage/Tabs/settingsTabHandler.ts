import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { CallAPI, projectServiceUrl } from '../../utils/apis';

type KeypointLabelDTO = {
  keyPointLabelID?: string;
  keypointLabel?: string;
  projectID?: string;
};

type BoundingBoxLabelDTO = {
  boundingBoxLabelID?: string;
  boundingBoxLabel?: string;
  projectID?: string;
};

type RenameOperation = {
  oldName: string;
  newNameRaw: string;
  labels: string[];
  setLabels: Dispatch<SetStateAction<string[]>>;
  map: Record<string, string>;
  setMap: Dispatch<SetStateAction<Record<string, string>>>;
  setError: Dispatch<SetStateAction<string | null>>;
  duplicateMessage: string;
  failureMessage: string;
  loadFn?: () => Promise<void>;
  renameRequest?: (id: string, newName: string) => Promise<void>;
};

export function useSettingsTab(projectID?: string) {
  const [keypointLabels, setKeypointLabels] = useState<string[]>([]);
  const [bboxLabels, setBboxLabels] = useState<string[]>([]);
  const [keypointInputState, setKeypointInputState] = useState('');
  const [bboxInputState, setBboxInputState] = useState('');
  const [keypointError, setKeypointError] = useState<string | null>(null);
  const [bboxError, setBboxError] = useState<string | null>(null);

  // Maps from label -> id to support delete actions from UI list of strings
  const [kpMap, setKpMap] = useState<Record<string, string>>({});
  const [bbMap, setBbMap] = useState<Record<string, string>>({});

  // Save feedback state
  const canUseApi = !!projectID;

  const performRename = useCallback(
    async ({ oldName, newNameRaw, labels, setLabels, map, setMap, setError, duplicateMessage, failureMessage, loadFn, renameRequest }: RenameOperation) => {
      const newName = newNameRaw.trim();
      if (!oldName || !newName || oldName === newName) {
        return;
      }

      if (labels.includes(newName)) {
        setError(duplicateMessage);
        return;
      }

      setError(null);

      const prevLabels = [...labels];
      const prevMap = { ...map };
      const id = map[oldName];

      setLabels((prev) => prev.map((label) => (label === oldName ? newName : label)));
      setMap((prev) => {
        if (!id) return prev;
        const next = { ...prev };
        delete next[oldName];
        next[newName] = id;
        return next;
      });

      if (!canUseApi || !renameRequest || !id) {
        return;
      }

      try {
        await renameRequest(id, newName);
        await loadFn?.();
        setError(null);
      } catch (err) {
        setLabels(prevLabels);
        setMap(prevMap);
        const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
        if (message.includes('already exists')) {
          setError(duplicateMessage);
        } else {
          setError(failureMessage);
        }
      }
    },
    [canUseApi],
  );

  const loadKeypointLabels = useCallback(async () => {
    if (!projectID) return;
    const url = `${projectServiceUrl()}/projects/${projectID}/keypointlabels`;
    const data = (await CallAPI<KeypointLabelDTO[]>(url)) || [];
    const labels = Array.isArray(data) ? data : [];
    const names: string[] = [];
    const map: Record<string, string> = {};
    for (const d of labels) {
      const name = (d.keypointLabel ?? '').toString();
      const id = (d.keyPointLabelID ?? '').toString();
      if (name) {
        names.push(name);
        if (id) map[name] = id;
      }
    }
    setKeypointLabels(names);
    setKpMap(map);
  }, [projectID]);

  const loadBoundingBoxLabels = useCallback(async () => {
    if (!projectID) return;
    const url = `${projectServiceUrl()}/projects/${projectID}/boundingboxlabels`;
    const data = (await CallAPI<BoundingBoxLabelDTO[]>(url)) || [];
    const labels = Array.isArray(data) ? data : [];
    const names: string[] = [];
    const map: Record<string, string> = {};
    for (const d of labels) {
      const name = (d.boundingBoxLabel ?? '').toString();
      const id = (d.boundingBoxLabelID ?? '').toString();
      if (name) {
        names.push(name);
        if (id) map[name] = id;
      }
    }
    setBboxLabels(names);
    setBbMap(map);
  }, [projectID]);

  const reloadAll = useCallback(async () => {
    await Promise.all([loadKeypointLabels(), loadBoundingBoxLabels()]);
  }, [loadKeypointLabels, loadBoundingBoxLabels]);

  useEffect(() => {
    reloadAll();
  }, [reloadAll]);

  const setKeypointInput = useCallback(
    (value: string) => {
      setKeypointError(null);
      setKeypointInputState(value);
    },
    [setKeypointError],
  );

  const setBboxInput = useCallback(
    (value: string) => {
      setBboxError(null);
      setBboxInputState(value);
    },
    [setBboxError],
  );

  const clearKeypointError = useCallback(() => setKeypointError(null), [setKeypointError]);
  const clearBboxError = useCallback(() => setBboxError(null), [setBboxError]);

  const keypointInput = keypointInputState;
  const bboxInput = bboxInputState;

  const addKeypoint = useCallback(async () => {
    const v = keypointInputState.trim();
    if (!v) return;

    if (keypointLabels.includes(v)) {
      setKeypointError('Keypoint label already exists.');
      return;
    }

    if (!canUseApi) {
      setKeypointLabels((prev) => (prev.includes(v) ? prev : [...prev, v]));
      setKeypointInputState('');
      setKeypointError(null);
      return;
    }

    try {
      const url = `${projectServiceUrl()}/projects/${projectID}/keypointlabels`;
      await CallAPI<string>(url, { method: 'POST', json: { keypointLabel: v }, parseJson: false });
      await loadKeypointLabels();
      setKeypointInputState('');
      setKeypointError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
      if (message.includes('already exists')) {
        setKeypointError('Keypoint label already exists.');
      } else {
        setKeypointError('Failed to add keypoint label.');
      }
    }
  }, [keypointInputState, keypointLabels, canUseApi, projectID, loadKeypointLabels]);

  const addBbox = useCallback(async () => {
    const v = bboxInputState.trim();
    if (!v) return;

    if (bboxLabels.includes(v)) {
      setBboxError('Bounding box label already exists.');
      return;
    }

    if (!canUseApi) {
      setBboxLabels((prev) => (prev.includes(v) ? prev : [...prev, v]));
      setBboxInputState('');
      setBboxError(null);
      return;
    }

    try {
      const url = `${projectServiceUrl()}/projects/${projectID}/boundingboxlabels`;
      await CallAPI<string>(url, { method: 'POST', json: { boundingBoxLabel: v }, parseJson: false });
      await loadBoundingBoxLabels();
      setBboxInputState('');
      setBboxError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
      if (message.includes('already exists')) {
        setBboxError('Bounding box label already exists.');
      } else {
        setBboxError('Failed to add bounding box label.');
      }
    }
  }, [bboxInputState, bboxLabels, canUseApi, projectID, loadBoundingBoxLabels]);

  const deleteKeypoint = useCallback(
    (val: string) => {
      const doLocal = () => setKeypointLabels((prev) => prev.filter((x) => x !== val));
      if (!canUseApi) {
        doLocal();
        return;
      }
      const id = kpMap[val];
      if (!projectID || !id) {
        doLocal();
        return;
      }
      (async () => {
        try {
          const url = `${projectServiceUrl()}/projects/${projectID}/keypointlabel/${id}`;
          await CallAPI<string>(url, { method: 'DELETE', parseJson: false });
          await loadKeypointLabels();
        } catch {
          doLocal();
        }
      })();
    },
    [canUseApi, kpMap, projectID, loadKeypointLabels],
  );

  const deleteBbox = useCallback(
    (val: string) => {
      const doLocal = () => setBboxLabels((prev) => prev.filter((x) => x !== val));
      if (!canUseApi) {
        doLocal();
        return;
      }
      const id = bbMap[val];
      if (!projectID || !id) {
        doLocal();
        return;
      }
      (async () => {
        try {
          const url = `${projectServiceUrl()}/projects/${projectID}/boundingboxlabel/${id}`;
          await CallAPI<string>(url, { method: 'DELETE', parseJson: false });
          await loadBoundingBoxLabels();
        } catch {
          doLocal();
        }
      })();
    },
    [canUseApi, bbMap, projectID, loadBoundingBoxLabels],
  );

  // --- New: rename helpers ---

  const renameKeypointLabel = useCallback(
    async (oldName: string, newNameRaw: string) => {
      await performRename({
        oldName,
        newNameRaw,
        labels: keypointLabels,
        setLabels: setKeypointLabels,
        map: kpMap,
        setMap: setKpMap,
        setError: setKeypointError,
        duplicateMessage: 'Keypoint label already exists.',
        failureMessage: 'Failed to rename keypoint label.',
        loadFn: loadKeypointLabels,
        renameRequest:
          canUseApi && projectID
            ? (id: string, newName: string) =>
                CallAPI<void>(`${projectServiceUrl()}/projects/${projectID}/keypointlabel/${id}`, {
                  method: 'PATCH',
                  json: { keypointLabel: newName },
                  parseJson: false,
                })
            : undefined,
      });
    },
    [canUseApi, projectID, keypointLabels, kpMap, loadKeypointLabels, performRename],
  );

  const renameBboxLabel = useCallback(
    async (oldName: string, newNameRaw: string) => {
      await performRename({
        oldName,
        newNameRaw,
        labels: bboxLabels,
        setLabels: setBboxLabels,
        map: bbMap,
        setMap: setBbMap,
        setError: setBboxError,
        duplicateMessage: 'Bounding box label already exists.',
        failureMessage: 'Failed to rename bounding box label.',
        loadFn: loadBoundingBoxLabels,
        renameRequest:
          canUseApi && projectID
            ? (id: string, newName: string) =>
                CallAPI<void>(`${projectServiceUrl()}/projects/${projectID}/boundingboxlabel/${id}`, {
                  method: 'PATCH',
                  json: { boundingBoxLabel: newName },
                  parseJson: false,
                })
            : undefined,
      });
    },
    [canUseApi, projectID, bboxLabels, bbMap, loadBoundingBoxLabels, performRename],
  );

  return {
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
    // New exports for rename
    renameKeypointLabel,
    renameBboxLabel,
  } as const;
}
