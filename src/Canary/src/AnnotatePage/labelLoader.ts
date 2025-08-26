import { getAuthTokenFromCookie } from '../utils/cookieUtils';
import { setBoundingBoxLabelMaps, setKeypointLabelMaps } from './labelRegistry';

type KeypointLabelDTO = {
  keyPointLabelID?: string;
  keypointLabel?: string;
};

type BoundingBoxLabelDTO = {
  boundingBoxLabelID?: string;
  boundingBoxLabel?: string;
};

export async function loadProjectLabels(projectID?: string) {
  if (!projectID) return;
  const baseUrl = import.meta.env.VITE_PROJECT_SERVICE_URL as string;
  const token = getAuthTokenFromCookie();

  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const [kpRes, bbRes] = await Promise.all([fetch(`${baseUrl}/projects/${projectID}/keypointlabels`, { headers }), fetch(`${baseUrl}/projects/${projectID}/boundingboxlabels`, { headers })]);

  if (kpRes.ok) {
    try {
      const data = (await kpRes.json()) as KeypointLabelDTO[];
      const map: Record<string, string> = {};
      for (const d of data || []) {
        const id = (d.keyPointLabelID ?? '').toString();
        const name = (d.keypointLabel ?? '').toString();
        if (id && name) map[id] = name;
      }
      setKeypointLabelMaps(map);
    } catch {
      // ignore parse errors
    }
  }

  if (bbRes.ok) {
    try {
      const data = (await bbRes.json()) as BoundingBoxLabelDTO[];
      const map: Record<string, string> = {};
      for (const d of data || []) {
        const id = (d.boundingBoxLabelID ?? '').toString();
        const name = (d.boundingBoxLabel ?? '').toString();
        if (id && name) map[id] = name;
      }
      setBoundingBoxLabelMaps(map);
    } catch {
      // ignore parse errors
    }
  }
}
