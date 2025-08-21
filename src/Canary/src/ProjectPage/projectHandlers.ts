import { CallAPI } from "../utils/apis";
import { type Project } from "./ProjectPage"; // gross

export async function fetchProjectByID(projectID: string): Promise<Project> {
  const baseUrl = import.meta.env.VITE_PROJECT_SERVICE_URL;
  const url = `${baseUrl}/projects/${projectID}`;
  return CallAPI<Project>(url);
}
