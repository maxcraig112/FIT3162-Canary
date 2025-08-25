import { useCallback, useState } from 'react';

export function useSettingsTab() {
  const [keypointLabels, setKeypointLabels] = useState<string[]>([]);
  const [bboxLabels, setBboxLabels] = useState<string[]>([]);
  const [keypointInput, setKeypointInput] = useState('');
  const [bboxInput, setBboxInput] = useState('');

  const addKeypoint = useCallback(() => {
    const v = keypointInput.trim();
    if (!v) return;
    setKeypointLabels((prev) => (prev.includes(v) ? prev : [...prev, v]));
    setKeypointInput('');
  }, [keypointInput]);

  const addBbox = useCallback(() => {
    const v = bboxInput.trim();
    if (!v) return;
    setBboxLabels((prev) => (prev.includes(v) ? prev : [...prev, v]));
    setBboxInput('');
  }, [bboxInput]);

  const deleteKeypoint = useCallback((val: string) => {
    setKeypointLabels((prev) => prev.filter((x) => x !== val));
  }, []);

  const deleteBbox = useCallback((val: string) => {
    setBboxLabels((prev) => prev.filter((x) => x !== val));
  }, []);

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
  } as const;
}
