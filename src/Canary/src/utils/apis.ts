import { getAuthTokenFromCookie } from './cookieUtils';
import { getCookie } from './cookieUtils';

export function authServiceUrl() {
  return import.meta.env.VITE_AUTH_SERVICE_URL as string;
}

export function projectServiceUrl() {
  return import.meta.env.VITE_PROJECT_SERVICE_URL as string;
}

export function websocketServiceUrl() {
  return import.meta.env.VITE_WEBSOCKET_SERVICE_URL as string;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export interface CallAPIOptions extends RequestInit {
  method?: HttpMethod;
  json?: unknown; // if provided, will be JSON.stringified and content-type set
  parseJson?: boolean; // default true; if false returns text
  auth?: boolean; // default true; include Bearer token if available
  // If true, do not read or parse the response body at all.
  // Useful for endpoints that return no content (e.g., DELETE 204)
  ignoreResponse?: boolean;
}

export async function CallAPI<T = unknown>(url: string, options: CallAPIOptions = {}): Promise<T> {
  const { method = 'GET', json, parseJson = true, auth = true, ignoreResponse = false, headers: initHeaders, body: initBody, ...rest } = options;

  const headers = new Headers({ Accept: 'application/json' });
  if (initHeaders) {
    const h = new Headers(initHeaders as HeadersInit);
    h.forEach((v, k) => headers.set(k, v));
  }

  let body = initBody;
  if (json !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(json);
  }

  if (auth) {
    const token = getAuthTokenFromCookie();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  // Attach session ID header for collaborative session-aware requests if cookie present.
  const sessionID = getCookie('session_id_cookie');
  if (sessionID) {
    headers.set('X-Session-Id', sessionID);
  }

  const resp = await fetch(url, { method, headers, body, ...rest });
  if (ignoreResponse) {
    if (!resp.ok) {
      // Don't attempt to read the body when ignoring
      throw new Error(`${resp.status} ${resp.statusText}`);
    }
    return undefined as unknown as T;
  }

  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(text || `${resp.status} ${resp.statusText}`);
  }
  if (!parseJson) return text as unknown as T;
  try {
    return text ? (JSON.parse(text) as T) : (undefined as unknown as T);
  } catch {
    throw new Error('Invalid JSON response');
  }
}
