import { projectServiceUrl } from '../utils/apis';
import { setBoundingBoxLabelMaps, setKeypointLabelMaps } from './labelRegistry';

type KeypointLabelDTO = {
  keyPointLabelID: string;
  keypointLabel: string;
};

type BoundingBoxLabelDTO = {
  boundingBoxLabelID: string;
  boundingBoxLabel: string;
};

export async function loadProjectLabels(projectID?: string) {
  if (!projectID) return;
  const { CallAPI } = await import('../utils/apis');

  try {
    const [kpData, bbData] = await Promise.all([
      CallAPI<KeypointLabelDTO[]>(`${projectServiceUrl()}/projects/${projectID}/keypointlabels`),
      CallAPI<BoundingBoxLabelDTO[]>(`${projectServiceUrl()}/projects/${projectID}/boundingboxlabels`),
    ]);
    if (kpData && Array.isArray(kpData)) {
      const map: Record<string, string> = {};
      for (const d of kpData) {
        const id = d.keyPointLabelID.toString();
        const name = d.keypointLabel.toString();
        if (id && name) map[id] = name;
      }
      console.log('Loaded keypoint labels:', map);
      setKeypointLabelMaps(map);
    }
    if (bbData && Array.isArray(bbData)) {
      const map: Record<string, string> = {};
      for (const d of bbData) {
        const id = d.boundingBoxLabelID.toString();
        const name = d.boundingBoxLabel.toString();
        if (id && name) map[id] = name;
      }
      console.log('Loaded bounding box labels:', map);
      setBoundingBoxLabelMaps(map);
    }
  } catch {
    console.log('Failed to load project labels');
  }
}
