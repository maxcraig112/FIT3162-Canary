// Rename a project
export async function renameProject(projectID: string, newProjectName: string): Promise<string> {
  const token = getAuthTokenFromCookie();
  const baseUrl = import.meta.env.VITE_PROJECT_SERVICE_URL;
  const url = `${baseUrl}/projects/${projectID}`;
  const body = JSON.stringify({ newProjectName });
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body,
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to rename project: ${res.status} ${res.statusText} - ${errorText}`);
  }
  const responseText = await res.text();
  try {
    const data = JSON.parse(responseText);
    return data.message || "Project renamed successfully";
  } catch {
    return responseText || "Project renamed successfully";
  }
}

// Delete a project
export async function deleteProject(projectID: string): Promise<string> {
  const token = getAuthTokenFromCookie();
  const baseUrl = import.meta.env.VITE_PROJECT_SERVICE_URL;
  const url = `${baseUrl}/projects/${projectID}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to delete project: ${res.status} ${res.statusText} - ${errorText}`);
  }
  const responseText = await res.text();
  try {
    const data = JSON.parse(responseText);
    return data.message || "Project deleted successfully";
  } catch {
    return responseText || "Project deleted successfully";
  }
}

import type { Project } from "./ProjectsPage";
import { getUserIDFromCookie, getAuthTokenFromCookie } from "../utils/cookieUtils";

export async function fetchProjects(): Promise<Project[]> {
  const userID = getUserIDFromCookie();
  const token = getAuthTokenFromCookie();
  const baseUrl = import.meta.env.VITE_PROJECT_SERVICE_URL;
  const url = `${baseUrl}/projects/${userID}`;
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
  return [...projects].sort((a, b) => {
    const aValue = a[sortKey];
    const bValue = b[sortKey];
    
    // Handle string comparison
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      const aLower = aValue.toLowerCase();
      const bLower = bValue.toLowerCase();
      if (aLower < bLower) return direction === "asc" ? -1 : 1;
      if (aLower > bLower) return direction === "asc" ? 1 : -1;
      return 0;
    }
    
    // Handle number comparison
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return direction === "asc" ? aValue - bValue : bValue - aValue;
    }
    
    // Handle other types by converting to string
    const aStr = String(aValue);
    const bStr = String(bValue);
    if (aStr < bStr) return direction === "asc" ? -1 : 1;
    if (aStr > bStr) return direction === "asc" ? 1 : -1;
    return 0;
  });
}

export function handleSortChange(
  value: string,
  setSortKey: (key: keyof Project) => void,
  setSortDirection: (direction: "asc" | "desc") => void
): void {
  const [key, direction] = value.split("-");
  setSortKey(key as keyof Project);
  setSortDirection(direction as "asc" | "desc");
}

export async function handleNewProject(projectName: string): Promise<string> {
  const userID = getUserIDFromCookie();
  const token = getAuthTokenFromCookie();
  const baseUrl = import.meta.env.VITE_PROJECT_SERVICE_URL;
  const url = `${baseUrl}/projects`;
  
  // Request body matches API reference exactly
  const requestBody = {
    userID: userID,
    projectName: projectName,
  };
  
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to create project: ${res.status} ${res.statusText} - ${errorText}`);
  }
  
  // Get the raw response first to debug
  const responseText = await res.text();
  console.log("Raw API Response:", responseText);
  
  // Try to parse as JSON first
  try {
    const data = JSON.parse(responseText);
    return data.message || data.projectID || "Project created successfully";
  } catch {
    // If JSON parsing fails, return the raw text
    console.log("Response is not JSON, returning as text:", responseText);
    return responseText || "Project created successfully";
  }
}

export function handleProjectsPage(projectID: string, navigate: (path: string) => void) {
  // Remove JWT token from cookies if needed
  navigate(`/projects?projectID=${projectID}`);
}