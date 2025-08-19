import { getAuthTokenFromCookie } from "../utils/cookieUtils";

export async function fetchProjectByID(projectID: string): Promise<any> {
  const baseUrl = import.meta.env.VITE_PROJECT_SERVICE_URL;
  const url = `${baseUrl}/projects/${projectID}`;
  const token = getAuthTokenFromCookie();

  const resp = await fetch(url, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      Accept: "application/json",
    },
  });

  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(text || `Failed to fetch project ${projectID}`);
  }

  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON in project response");
  }

  return data;
}