package websocket

import (
	"net/http"
	"sync"
	"websocket-service/firestore"

	"github.com/gorilla/websocket"
	"github.com/rs/zerolog/log"
)

type CreateSessionConnectionRequest struct {
	OwnerID   string `json:"ownerID"`
	SessionID string `json:"sessionID"`
}

type JoinSessionConnectionRequest struct {
	MemberID  string `json:"memberID"`
	SessionID string `json:"sessionID"`
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true }, // allow all origins; tighten in prod
}

type WebSocketHub struct {
	mu       sync.RWMutex
	Sessions map[string]*Session
	// This is needed in order to handle certain websocket events
	SessionStore *firestore.SessionStore
	// TerminatingSessions tracks sessions currently tearing down due to owner leaving
	TerminatingSessions map[string]struct{}
}

type Session struct {
	Mu      sync.RWMutex
	Owner   *Client
	Members map[*Client]struct{}
}

type Client struct {
	conn *websocket.Conn
	out  chan any
	id   string
}

func (c *Client) Close() {
	_ = c.conn.Close()
	close(c.out)
}

func NewWebSocketHub(sessionStore *firestore.SessionStore) *WebSocketHub {
	return &WebSocketHub{
		Sessions:            make(map[string]*Session),
		SessionStore:        sessionStore,
		TerminatingSessions: make(map[string]struct{}),
	}
}

// markTerminating marks a session as being closed by the owner disconnecting.
func (h *WebSocketHub) markTerminating(sessionID string) {
	h.mu.Lock()
	h.TerminatingSessions[sessionID] = struct{}{}
	h.mu.Unlock()
}

// isTerminating checks if a session is currently being closed by the owner.
func (h *WebSocketHub) isTerminating(sessionID string) bool {
	h.mu.RLock()
	_, ok := h.TerminatingSessions[sessionID]
	h.mu.RUnlock()
	return ok
}

// CreateSession upgrades the HTTP connection and registers the owner client for a new session.
// The sessionID used is the batchID from the request.
func (h *WebSocketHub) CreateSession(w http.ResponseWriter, r *http.Request, req CreateSessionConnectionRequest) error {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Error().Err(err).Str("sessionID", req.SessionID).Msg("websocket upgrade failed for owner")
		return err
	}
	// Only create if not present; if present and owner exists, reject by closing.
	h.mu.Lock()
	s, ok := h.Sessions[req.SessionID]
	if !ok {
		s = &Session{Members: make(map[*Client]struct{})}
		h.Sessions[req.SessionID] = s
	}
	// Assign owner only if not already set
	if s.Owner != nil {
		h.mu.Unlock()
		_ = conn.Close()
		return http.ErrUseLastResponse
	}
	owner := &Client{conn: conn, out: make(chan any, 16), id: req.OwnerID}
	s.Owner = owner
	h.mu.Unlock()
	h.startWebhookWriter(r.Context(), owner, "owner", req.SessionID)
	return nil
}

// JoinSession upgrades the HTTP connection and registers the member client for the session.
func (h *WebSocketHub) JoinSession(w http.ResponseWriter, r *http.Request, req JoinSessionConnectionRequest) error {
	// Ensure session exists first
	h.mu.RLock()
	s, exists := h.Sessions[req.SessionID]
	h.mu.RUnlock()
	if !exists {
		http.Error(w, "session not found", http.StatusNotFound)
		log.Warn().Str("sessionID", req.SessionID).Msg("join session failed; session not found")
		return http.ErrNoLocation
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Error().Err(err).Str("sessionID", req.SessionID).Msg("websocket upgrade failed for member")
		return err
	}
	member := &Client{conn: conn, out: make(chan any, 16), id: req.MemberID}
	s.Mu.Lock()
	s.Members[member] = struct{}{}
	s.Mu.Unlock()

	// notify all other session clients that a new member has joined
	h.notifyMemberJoined(s, req.MemberID, req.SessionID)

	h.startWebhookWriter(r.Context(), member, "member", req.SessionID)
	return nil
}
