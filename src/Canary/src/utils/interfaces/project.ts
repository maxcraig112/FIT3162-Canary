import { CallAPI, projectServiceUrl } from '../apis';
import type { Project } from './interfaces';

export async function getProject(projectID: string): Promise<Project> {
  const url = `${projectServiceUrl()}/projects/${projectID}`;
  return CallAPI<Project>(url);
}
