import { CallAPI, websocketServiceUrl } from '../apis';
import { getUserIDFromCookie } from '../cookieUtils';

// Shape returned by the Go service for both create & join.
export interface SessionTokenResponse {
	sessionID: string;
	token: string;        // short-lived JWT for websocket upgrade
	expiresIn: number;    // seconds until expiry
}

// Discriminated union so callers can easily branch on success.
export type SessionCallResult =
	| { ok: true; data: SessionTokenResponse }
	| { ok: false; error: string; status?: number };

export async function createSession(
	batchID: string,
	userID: string = getUserIDFromCookie(),
): Promise<SessionCallResult> {
	if (!batchID) return { ok: false, error: 'batchID is required' };
	if (!userID) return { ok: false, error: 'userID is required (missing cookie?)' };
	const base = websocketServiceUrl();
	if (!base) return { ok: false, error: 'WebSocket service URL not configured' };
	const url = `${base}/sessions/${encodeURIComponent(batchID)}?userID=${encodeURIComponent(userID)}`;
	try {
		const data = await CallAPI<SessionTokenResponse>(url, { method: 'POST' });
		if (!data || !data.sessionID || !data.token) {
			return { ok: false, error: 'Malformed response from session create endpoint' };
		}
		return { ok: true, data };
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : 'Failed to create session';
			return { ok: false, error: msg };
	}
}

/** Join an existing session as a member. */
export async function joinSession(
	sessionID: string,
	password: string,
	userID: string = getUserIDFromCookie(),
): Promise<SessionCallResult> {
	if (!sessionID) return { ok: false, error: 'sessionID is required' };
	if (!userID) return { ok: false, error: 'userID is required (missing cookie?)' };
	const base = websocketServiceUrl();
	if (!base) return { ok: false, error: 'WebSocket service URL not configured' };
	const url = `${base}/sessions/${encodeURIComponent(sessionID)}/join?userID=${encodeURIComponent(userID)}`;
	try {
		const data = await CallAPI<SessionTokenResponse>(url, { method: 'POST', json: { password } });
		if (!data || !data.sessionID || !data.token) {
			return { ok: false, error: 'Malformed response from session join endpoint' };
		}
		return { ok: true, data };
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : 'Failed to join session';
			return { ok: false, error: msg };
	}
}
