import { CallAPI, projectServiceUrl } from '../utils/apis';
import type { Project } from '../utils/interfaces/interfaces';

export async function fetchProjectByID(projectID: string): Promise<Project> {
  const url = `${projectServiceUrl()}/projects/${projectID}`;
  return CallAPI<Project>(url);
}
