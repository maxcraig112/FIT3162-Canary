import { getAuthTokenFromCookie } from './cookieUtils';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface CallAPIOptions extends RequestInit {
  method?: HttpMethod;
  json?: unknown; // if provided, will be JSON.stringified and content-type set
  parseJson?: boolean; // default true; if false returns text
  auth?: boolean; // default true; include Bearer token if available
}

export async function CallAPI<T = unknown>(url: string, options: CallAPIOptions = {}): Promise<T> {
  const { method = 'GET', json, parseJson = true, auth = true, headers: initHeaders, body: initBody, ...rest } = options;

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

  const resp = await fetch(url, { method, headers, body, ...rest });
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
