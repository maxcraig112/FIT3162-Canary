// Rename a project
export async function renameProject(projectID: string, newProjectName: string): Promise<string> {
  const token = getAuthTokenFromCookie();
  const baseUrl = import.meta.env.VITE_PROJECT_SERVICE_URL;
  const url = `${baseUrl}/projects/${projectID}`;
  const body = JSON.stringify({ newProjectName });
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
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
    return data.message || 'Project renamed successfully';
  } catch {
    return responseText || 'Project renamed successfully';
  }
}

// Delete a project
export async function deleteProject(projectID: string): Promise<string> {
  const token = getAuthTokenFromCookie();
  const baseUrl = import.meta.env.VITE_PROJECT_SERVICE_URL;
  const url = `${baseUrl}/projects/${projectID}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to delete project: ${res.status} ${res.statusText} - ${errorText}`);
  }
  const responseText = await res.text();
  try {
    const data = JSON.parse(responseText);
    return data.message || 'Project deleted successfully';
  } catch {
    return responseText || 'Project deleted successfully';
  }
}

import type { Project } from './ProjectsPage';
import { CallAPI } from '../utils/apis';
import { getUserIDFromCookie, getAuthTokenFromCookie } from '../utils/cookieUtils';

// Fetch all projects
export async function fetchProjects(): Promise<Project[]> {
  const token = getAuthTokenFromCookie();
  const baseUrl = import.meta.env.VITE_PROJECT_SERVICE_URL;
  const url = `${baseUrl}/projects/*`;
  return CallAPI<Project[]>(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function filterProjects(projects: Project[], search: string): Project[] {
  return projects.filter((p) => p.projectName.toLowerCase().includes(search.toLowerCase()));
}

export function handleSearch(projects: Project[], search: string): Project[] {
  return filterProjects(projects, search);
}

export function handleSort(projects: Project[], key: keyof Project, direction: 'asc' | 'desc'): Project[] {
  const sorted = [...projects].sort((a, b) => {
    const aValue = a[key] as unknown as string | number;
    const bValue = b[key] as unknown as string | number;

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      const aLower = aValue.toLowerCase();
      const bLower = bValue.toLowerCase();
      if (aLower < bLower) return direction === 'asc' ? -1 : 1;
      if (aLower > bLower) return direction === 'asc' ? 1 : -1;
      return 0;
    }

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return direction === 'asc' ? aValue - bValue : bValue - aValue;
    }

    return 0;
  });
  return sorted;
}

export function handleSortChange(value: string, setSortKey: (k: keyof Project) => void, setSortDirection: (d: 'asc' | 'desc') => void) {
  const [key, direction] = value.split('-');
  setSortKey(key as keyof Project);
  setSortDirection(direction as 'asc' | 'desc');
}

// Create a new project
export async function handleNewProject(projectName: string): Promise<string> {
  const baseUrl = import.meta.env.VITE_PROJECT_SERVICE_URL;
  const url = `${baseUrl}/projects`;
  const requestBody = { userID: getUserIDFromCookie(), projectName };
  const respText = await CallAPI<string>(url, {
    method: 'POST',
    json: requestBody,
    parseJson: false,
  });
  return respText || 'Project created successfully';
}

// Update project number of files (quantity)
export async function updateProjectQuantity(projectID: string, quantity: number): Promise<string> {
  const baseUrl = import.meta.env.VITE_PROJECT_SERVICE_URL;
  const url = `${baseUrl}/projects/${projectID}`;
  const respText = await CallAPI<string>(url, {
    method: 'PATCH',
    json: { quantity },
    parseJson: false,
  });
  return respText || 'Project updated';
}

export function handleProjectPage(projectID: string, navigate: (path: string) => void) {
  navigate(`/projects/${projectID}`);
}
