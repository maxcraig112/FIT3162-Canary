import { CallAPI, websocketServiceUrl } from '../apis';
import { getUserIDFromCookie } from '../cookieUtils';

// Shape returned by the Go service for both create & join.
export interface SessionTokenResponse {
  sessionID: string;
  batchID: string;
  projectID: string;
  token?: string; // short-lived JWT for websocket upgrade (omitted for owner-create response)
  expiresIn?: number; // seconds until expiry
  role?: 'owner' | 'member';
}

// Discriminated union so callers can easily branch on success.
export type SessionCallResult = { ok: true; data: SessionTokenResponse } | { ok: false; error: string; status?: number };

export interface Member {
  id: string;
  email: string;
}

export interface ActiveSessionResponse {
  sessionID: string;
  batchID: string;
  projectID: string;
  owner: Member;
  members: Member[];
  ownerConnected: boolean;
  lastUpdated: string;
}

export async function createSession(batchID: string, password?: string, userID: string = getUserIDFromCookie()): Promise<SessionCallResult> {
  if (!batchID) return { ok: false, error: 'batchID is required' };
  if (!userID) return { ok: false, error: 'userID is required (missing cookie?)' };
  const base = websocketServiceUrl();
  if (!base) return { ok: false, error: 'WebSocket service URL not configured' };
  const url = `${base}/sessions/${encodeURIComponent(batchID)}?userID=${encodeURIComponent(userID)}`;
  try {
    const options: {
      method: 'POST';
      json?: { password: string };
    } = { method: 'POST' };
    const trimmedPassword = password?.trim();
    if (trimmedPassword) {
      options.json = { password: trimmedPassword };
    }
    const data = await CallAPI<SessionTokenResponse>(url, options);
    if (!data || !data.sessionID) {
      return { ok: false, error: 'Malformed response from session create endpoint' };
    }
    return { ok: true, data };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to create session';
    return { ok: false, error: msg };
  }
}

/** Join an existing session as a member. */
export async function joinSession(sessionID: string, password?: string, userID: string = getUserIDFromCookie()): Promise<SessionCallResult> {
  if (!sessionID) return { ok: false, error: 'sessionID is required' };
  if (!userID) return { ok: false, error: 'userID is required (missing cookie?)' };
  const base = websocketServiceUrl();
  if (!base) return { ok: false, error: 'WebSocket service URL not configured' };
  const url = `${base}/sessions/${encodeURIComponent(sessionID)}/join?userID=${encodeURIComponent(userID)}`;
  try {
    const payload = password !== undefined ? { password } : undefined;
    const data = await CallAPI<SessionTokenResponse>(url, payload ? { method: 'POST', json: payload } : { method: 'POST' });
    if (!data || !data.sessionID || !data.token) {
      return { ok: false, error: 'Malformed response from session join endpoint' };
    }
    return { ok: true, data };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to join session';
    return { ok: false, error: msg };
  }
}

export async function endSession(sessionID: string, userID: string = getUserIDFromCookie()): Promise<SessionCallResult> {
  if (!sessionID) return { ok: false, error: 'sessionID is required' };
  if (!userID) return { ok: false, error: 'userID is required (missing cookie?)' };
  const base = websocketServiceUrl();
  if (!base) return { ok: false, error: 'WebSocket service URL not configured' };
  const url = `${base}/sessions/${encodeURIComponent(sessionID)}?userID=${encodeURIComponent(userID)}`;
  try {
    await CallAPI<void>(url, { method: 'DELETE', parseJson: false });
    return { ok: true, data: { sessionID, batchID: '', projectID: '', token: '', expiresIn: 0 } };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to stop session';
    return { ok: false, error: msg };
  }
}

export async function fetchActiveSessions(projectID: string): Promise<ActiveSessionResponse[]> {
  const base = websocketServiceUrl();
  if (!base) throw new Error('WebSocket service URL not configured');
  const url = `${base}/sessions/active?projectID=${encodeURIComponent(projectID)}`;
  const data = await CallAPI<{ sessions: ActiveSessionResponse[] }>(url);
  return data?.sessions ?? [];
}

export async function fetchActiveSessionForBatch(batchID: string): Promise<ActiveSessionResponse | null> {
  const base = websocketServiceUrl();
  if (!base) throw new Error('WebSocket service URL not configured');
  const url = `${base}/sessions/active?batchID=${encodeURIComponent(batchID)}`;
  const data = await CallAPI<{ sessions: ActiveSessionResponse[] }>(url);
  const sessions = data?.sessions ?? [];
  return sessions[0] ?? null;
}

export async function kickSessionMember(sessionID: string, memberID: string, userID: string = getUserIDFromCookie()): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!sessionID || !memberID) {
    return { ok: false, error: 'sessionID and memberID are required' };
  }
  if (!userID) {
    return { ok: false, error: 'userID is required (missing cookie?)' };
  }
  const base = websocketServiceUrl();
  if (!base) return { ok: false, error: 'WebSocket service URL not configured' };
  const url = `${base}/sessions/${encodeURIComponent(sessionID)}/members/${encodeURIComponent(memberID)}?userID=${encodeURIComponent(userID)}`;
  try {
    await CallAPI(url, { method: 'DELETE' });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to remove member';
    return { ok: false, error: msg };
  }
}
