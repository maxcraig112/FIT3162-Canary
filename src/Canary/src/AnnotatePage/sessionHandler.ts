import { websocketServiceUrl } from '../utils/apis';
import { getCookie, clearCookie, getAuthTokenFromCookie } from '../utils/cookieUtils';

declare global {
	interface Window {
		__canarySessionSocket?: WebSocket;
		__canarySessionRole?: 'owner' | 'member';
		__canarySessionInitPromise?: Promise<SessionInitResult>;
	}
}

// Cookies used:
//  - create_session_cookie : owner token (short-lived) for creating a session websocket
//  - join_session_cookie   : member token (short-lived) for joining a session websocket
//  - session_id_cookie     : (optional) stores the sessionID after creation for reuse/display

export interface SessionInitResult {
	sessionID?: string;
	socket?: WebSocket;
	role?: 'owner' | 'member';
	error?: string;
}

// Establish a websocket connection for session collaboration.
// If create token is present -> create session websocket.
// Else if join token is present -> join session websocket.
// Returns the active websocket and discovered sessionID.
export async function initialiseSessionWebSocket(existingSessionID?: string): Promise<SessionInitResult> {
	// If an init is already in-flight, await it
	if (window.__canarySessionInitPromise) {
		return window.__canarySessionInitPromise;
	}
	// Prevent duplicate initialisation attempts (reuse existing OPEN or CONNECTING socket)
	if (window.__canarySessionSocket && (window.__canarySessionSocket.readyState === WebSocket.OPEN || window.__canarySessionSocket.readyState === WebSocket.CONNECTING)) {
		return {
			sessionID: getCookie('session_id_cookie') || existingSessionID,
			socket: window.__canarySessionSocket,
			role: window.__canarySessionRole,
		};
	}
	const base = websocketServiceUrl();
	if (!base) return { error: 'WebSocket service URL not configured' };

	// Detect tokens
	const createToken = getCookie('create_session_cookie');
	const joinToken = getCookie('join_session_cookie');
	// If neither token present, nothing to do.
	if (!createToken && !joinToken) return {};

	// Determine role and token
	let role: 'owner' | 'member';
	let token: string;
		const sessionID = existingSessionID || getCookie('session_id_cookie') || '';

	if (createToken) {
		role = 'owner';
		token = createToken;
		// For owner, we may not yet know sessionID; expect backend encoded inside token OR provided externally.
		// If not supplied, we rely on separate logic (not implemented here) to decode token if needed.
	} else {
		role = 'member';
		token = joinToken!;
	}

	// Build websocket URL. We need sessionID for join path; for creation we also need it.
	// If sessionID is still empty here, we cannot proceed.
	if (!sessionID) {
		// Without a sessionID we cannot form the upgrade URL.
		return { error: 'Missing session ID for websocket initialisation (set session_id_cookie first)' };
	}

	// Convert base HTTP(S) -> WS(S)
	const wsBase = base.replace(/^http/, 'ws');
	const path = role === 'owner' ? `/sessions/${encodeURIComponent(sessionID)}/ws/create` : `/sessions/${encodeURIComponent(sessionID)}/ws/join`;
	// Browser WebSocket API cannot set arbitrary headers; include auth bearer via query param.
	const authToken = getAuthTokenFromCookie();
	const qs = new URLSearchParams({ token });
	if (authToken) qs.set('auth', authToken); // server should treat this as Bearer token fallback if Authorization header absent
	const wsUrl = `${wsBase}${path}?${qs.toString()}`;

	const initPromise = new Promise<SessionInitResult>((resolve) => {
		try {
			const socket = new WebSocket(wsUrl);
			window.__canarySessionSocket = socket; // mark early to block races
			window.__canarySessionRole = role;
			socket.onopen = () => {
				// Clear one-time tokens after successful upgrade
				if (role === 'owner') clearCookie('create_session_cookie');
				if (role === 'member') clearCookie('join_session_cookie');
				// Persist sessionID for page reload continuity
				if (sessionID) document.cookie = `session_id_cookie=${sessionID}; path=/`;
				resolve({ sessionID, socket, role });
			};
			socket.onclose = () => {
				// Clean up singleton so a future attempt can reconnect
				if (window.__canarySessionSocket === socket) {
					delete window.__canarySessionSocket;
					delete window.__canarySessionRole;
				}
			};
			socket.onerror = () => {
				resolve({ error: 'WebSocket error establishing session', sessionID });
			};
		} catch (e) {
			resolve({ error: e instanceof Error ? e.message : 'Failed to open websocket' });
		}
	});
	window.__canarySessionInitPromise = initPromise;
	const result = await initPromise;
	// Clear init promise after completion so reconnection attempts can proceed if needed
	delete window.__canarySessionInitPromise;
	return result;
}

// Send currently viewed image ID to server to start/update Firestore watches.
export function sendActiveImageID(imageID: string) {
	if (!imageID) return;
	const ws = window.__canarySessionSocket;
	if (!ws || ws.readyState !== WebSocket.OPEN) return;
	try {
		const msg = { type: 'setImageID', payload: { imageID } };
		ws.send(JSON.stringify(msg));
	} catch {
		// swallow
	}
}

// Helper to get the session ID from cookie (for display)
export function getActiveSessionID(): string | undefined {
	return getCookie('session_id_cookie') || undefined;
}

