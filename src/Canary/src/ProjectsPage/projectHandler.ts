
import type { Project } from "./ProjectsPage";
import { getUserIDFromCookie, getAuthTokenFromCookie } from "../utils/cookieUtils";

export async function fetchProjects(): Promise<Project[]> {
  const userID = getUserIDFromCookie();
  const token = getAuthTokenFromCookie();
  const baseUrl = import.meta.env.VITE_PROJECT_SERVICE_URL;
  if (!baseUrl) throw new Error("VITE_PROJECT_SERVICE_URL is not defined");
  if (!userID) throw new Error("User ID cookie not found");
  if (!token) throw new Error("Auth token cookie not found");
  // API: GET /projects/{userID}
  const url = `${baseUrl}/projects/${userID}`;

  console.log(url);
  console.log(userID);;
  console.log(token);
  const res = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });
  if (!res.ok) throw new Error("Failed to fetch projects");
  return res.json();
}

export function filterProjects(projects: Project[], search: string): Project[] {
  return projects.filter((p) =>
    p.projectName.toLowerCase().includes(search.toLowerCase())
  );
}

export function handleSearch(projects: Project[], search: string): Project[] {
  // Example: filter projects by name (case-insensitive)
  return projects.filter((p) =>
    p.projectName.toLowerCase().includes(search.toLowerCase())
  );
}

export function handleSort(projects: Project[], sortKey: keyof Project = "projectName", direction: "asc" | "desc" = "asc"): Project[] {
  // TODO: Implement sorting logic
  console.log("handleSort called", { projects, sortKey, direction });
  return projects;
}

export function handleNewProject(onNewProject: () => void) {
  // TODO: Implement new project logic
  console.log("handleNewProject called");
  onNewProject();
}
