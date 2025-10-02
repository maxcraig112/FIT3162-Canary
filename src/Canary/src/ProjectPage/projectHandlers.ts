import { CallAPI, projectServiceUrl } from '../utils/apis';
import type { Project } from '../utils/intefaces/interfaces';

export async function fetchProjectByID(projectID: string): Promise<Project> {
  const url = `${projectServiceUrl()}/projects/${projectID}`;
  return CallAPI<Project>(url);
}
