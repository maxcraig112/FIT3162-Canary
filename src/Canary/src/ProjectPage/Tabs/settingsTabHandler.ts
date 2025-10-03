import { useCallback, useEffect, useState } from 'react';
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

type ProjectSettingsDTO = { session?: { enabled?: boolean; password?: string } };

export function useSettingsTab(projectID?: string, initialSettings?: ProjectSettingsDTO | null) {
  // Session settings state
  const [sessionEnabled, setSessionEnabled] = useState<boolean>(false);
  const [sessionPassword, setSessionPassword] = useState<string>('');
  const [keypointLabels, setKeypointLabels] = useState<string[]>([]);
  const [bboxLabels, setBboxLabels] = useState<string[]>([]);
  const [keypointInput, setKeypointInput] = useState('');
  const [bboxInput, setBboxInput] = useState('');

  // Maps from label -> id to support delete actions from UI list of strings
  const [kpMap, setKpMap] = useState<Record<string, string>>({});
  const [bbMap, setBbMap] = useState<Record<string, string>>({});

  // Save feedback state
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const canUseApi = !!projectID;

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

  // Initialise session state from provided project settings
  useEffect(() => {
    const s = initialSettings?.session;
    if (s) {
      setSessionEnabled(Boolean(s.enabled));
      setSessionPassword(s.password ?? '');
    }
  }, [initialSettings]);

  const addKeypoint = useCallback(() => {
    const v = keypointInput.trim();
    if (!v) return;
    const doLocal = () => {
      setKeypointLabels((prev) => (prev.includes(v) ? prev : [...prev, v]));
      setKeypointInput('');
    };
    if (!canUseApi) {
      doLocal();
      return;
    }
    // Create via API then reload to capture assigned ID
    (async () => {
      try {
        const url = `${projectServiceUrl()}/projects/${projectID}/keypointlabels`;
        await CallAPI<string>(url, { method: 'POST', json: { keypointLabel: v }, parseJson: false });
        await loadKeypointLabels();
        setKeypointInput('');
      } catch {
        // fallback local add so user sees it; next reload will sync
        doLocal();
      }
    })();
  }, [keypointInput, canUseApi, projectID, loadKeypointLabels]);

  const addBbox = useCallback(() => {
    const v = bboxInput.trim();
    if (!v) return;
    const doLocal = () => {
      setBboxLabels((prev) => (prev.includes(v) ? prev : [...prev, v]));
      setBboxInput('');
    };
    if (!canUseApi) {
      doLocal();
      return;
    }
    (async () => {
      try {
        const url = `${projectServiceUrl()}/projects/${projectID}/boundingboxlabels`;
        await CallAPI<string>(url, { method: 'POST', json: { boundingBoxLabel: v }, parseJson: false });
        await loadBoundingBoxLabels();
        setBboxInput('');
      } catch {
        doLocal();
      }
    })();
  }, [bboxInput, canUseApi, projectID, loadBoundingBoxLabels]);

  const saveSessionSettings = useCallback(async (): Promise<void> => {
    if (!projectID) return;
    const url = `${projectServiceUrl()}/projects/${projectID}`;
    await CallAPI(url, {
      method: 'PATCH',
      json: {
        settings: {
          session: {
            enabled: sessionEnabled,
            password: sessionPassword,
          },
        },
      },
    });
    setSaveSuccess('Session settings saved');
  }, [projectID, sessionEnabled, sessionPassword]);

  const clearSaveSuccess = useCallback(() => setSaveSuccess(null), []);

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
      const newName = newNameRaw.trim();
      if (!oldName || !newName || oldName === newName) return;

      // Optimistic local update
      const prevKpLabels = keypointLabels;
      const prevKpMap = kpMap;
      const id = kpMap[oldName];

      // If duplicate exists, abort
      if (prevKpLabels.includes(newName)) return;

      const applyLocal = () => {
        setKeypointLabels((prev) => prev.map((n) => (n === oldName ? newName : n)));
        setKpMap((prev) => {
          const next = { ...prev };
          if (id) {
            delete next[oldName];
            next[newName] = id;
          }
          return next;
        });
      };

      const rollbackLocal = () => {
        setKeypointLabels(prevKpLabels);
        setKpMap(prevKpMap);
      };

      applyLocal();

      if (!canUseApi || !projectID || !id) {
        // No API, keep local
        return;
      }

      try {
        const url = `${projectServiceUrl()}/projects/${projectID}/keypointlabel/${id}`;
        await CallAPI<string>(url, {
          method: 'PATCH',
          json: { keypointLabel: newName },
          parseJson: false,
        });
        await loadKeypointLabels(); // ensure sync with server state/ids
      } catch {
        rollbackLocal();
      }
    },
    [canUseApi, projectID, keypointLabels, kpMap, loadKeypointLabels],
  );

  const renameBboxLabel = useCallback(
    async (oldName: string, newNameRaw: string) => {
      const newName = newNameRaw.trim();
      if (!oldName || !newName || oldName === newName) return;

      const prevBbLabels = bboxLabels;
      const prevBbMap = bbMap;
      const id = bbMap[oldName];

      if (prevBbLabels.includes(newName)) return;

      const applyLocal = () => {
        setBboxLabels((prev) => prev.map((n) => (n === oldName ? newName : n)));
        setBbMap((prev) => {
          const next = { ...prev };
          if (id) {
            delete next[oldName];
            next[newName] = id;
          }
          return next;
        });
      };

      const rollbackLocal = () => {
        setBboxLabels(prevBbLabels);
        setBbMap(prevBbMap);
      };

      applyLocal();

      if (!canUseApi || !projectID || !id) {
        return;
      }

      try {
        const url = `${projectServiceUrl()}/projects/${projectID}/boundingboxlabel/${id}`;
        await CallAPI<string>(url, {
          method: 'PATCH',
          json: { boundingBoxLabel: newName },
          parseJson: false,
        });
        await loadBoundingBoxLabels();
      } catch {
        rollbackLocal();
      }
    },
    [canUseApi, projectID, bboxLabels, bbMap, loadBoundingBoxLabels],
  );

  return {
    // sessions
    sessionEnabled,
    sessionPassword,
    setSessionEnabled,
    setSessionPassword,
    keypointLabels,
    bboxLabels,
    keypointInput,
    bboxInput,
    setKeypointInput,
    setBboxInput,
    saveSessionSettings,
    saveSuccess,
    clearSaveSuccess,
    addKeypoint,
    addBbox,
    deleteKeypoint,
    deleteBbox,
    // New exports for rename
    renameKeypointLabel,
    renameBboxLabel,
  } as const;
}
