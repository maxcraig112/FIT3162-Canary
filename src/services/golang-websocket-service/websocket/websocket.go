package websocket

import (
	"context"
	"net/http"
	"sync"
	"time"

	fs "pkg/gcp/firestore"
	wsfs "websocket-service/firestore"

	"cloud.google.com/go/firestore"
	"github.com/gorilla/websocket"
	"github.com/rs/zerolog/log"
)

type CreateSessionConnectionRequest struct {
	OwnerID    string `json:"ownerID"`
	OwnerEmail string `json:"ownerEmail"`
	SessionID  string `json:"sessionID"`
	BatchID    string `json:"batchID"`
}

type JoinSessionConnectionRequest struct {
	MemberID    string `json:"memberID"`
	MemberEmail string `json:"memberEmail"`
	SessionID   string `json:"sessionID"`
	BatchID     string `json:"batchID,omitempty"`
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true }, // allow all origins; tighten in prod
}

type WebSocketHub struct {
	mu       sync.RWMutex
	Sessions map[string]*Session
	// This is needed in order to handle certain websocket events
	SessionStore     *wsfs.SessionStore
	KeyPointStore    *wsfs.KeypointStore
	BoundingBoxStore *wsfs.BoundingBoxStore
	// TerminatingSessions tracks sessions currently tearing down due to owner leaving
	TerminatingSessions map[string]struct{}
}

type Session struct {
	Mu      sync.RWMutex
	Owner   *Client
	Members map[*Client]struct{}
	BatchID string
}

type Client struct {
	conn *websocket.Conn
	out  chan any
	id   string

	// This is data specifically related to annotations
	imageID string
	// watches stores stop functions for label watchers keyed by sessionID
	keypointWatch    func()
	boundingBoxWatch func()
}

func (c *Client) Close() {
	// Close the websocket connection
	_ = c.conn.Close()
	// Safely close the out channel
	select {
	case <-c.out:
		// already closed
	default:
		close(c.out)
	}
}

func NewWebSocketHub(sessionStore *wsfs.SessionStore) *WebSocketHub {
	return &WebSocketHub{
		Sessions:            make(map[string]*Session),
		SessionStore:        sessionStore,
		KeyPointStore:       wsfs.NewKeypointStore(sessionStore.GenericClient()),
		BoundingBoxStore:    wsfs.NewBoundingBoxStore(sessionStore.GenericClient()),
		TerminatingSessions: make(map[string]struct{}),
	}
}

// EnsureSession initialises an in-memory session entry, creating it if needed.
func (h *WebSocketHub) EnsureSession(sessionID, batchID string) *Session {
	h.mu.Lock()
	defer h.mu.Unlock()
	s, ok := h.Sessions[sessionID]
	if !ok {
		s = &Session{Members: make(map[*Client]struct{}), BatchID: batchID}
		h.Sessions[sessionID] = s
	} else if batchID != "" && s.BatchID == "" {
		s.BatchID = batchID
	}
	return s
}

// IsOwnerConnected reports whether the session currently has an active owner websocket.
func (h *WebSocketHub) IsOwnerConnected(sessionID string) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	s, ok := h.Sessions[sessionID]
	if !ok || s.Owner == nil {
		return false
	}
	return s.Owner.conn != nil
}

// StopSession notifies all clients, disconnects sockets and clears session state.
func (h *WebSocketHub) StopSession(sessionID string) {
	h.mu.Lock()
	s, ok := h.Sessions[sessionID]
	if !ok {
		h.mu.Unlock()
		return
	}
	h.TerminatingSessions[sessionID] = struct{}{}
	owner := s.Owner
	members := make([]*Client, 0, len(s.Members))
	s.Mu.RLock()
	for member := range s.Members {
		members = append(members, member)
	}
	s.Mu.RUnlock()
	delete(h.Sessions, sessionID)
	h.mu.Unlock()

	notif := StandardNotification{
		Type:      "session_closed",
		SessionID: sessionID,
		Time:      time.Now().UTC().Format(time.RFC3339),
	}
	if owner != nil {
		_ = h.safeEnqueue(owner, notif)
	}
	for _, member := range members {
		_ = h.safeEnqueue(member, notif)
	}

	if owner != nil {
		owner.Close()
	}
	for _, member := range members {
		member.Close()
	}

	if err := h.SessionStore.DeleteSession(context.Background(), sessionID); err != nil && err != fs.ErrNotFound {
		log.Error().Err(err).Str("sessionID", sessionID).Msg("failed to delete session during stop")
	}
	h.mu.Lock()
	delete(h.TerminatingSessions, sessionID)
	h.mu.Unlock()
}

// KickMember disconnects a specific member from the session if connected.
func (h *WebSocketHub) KickMember(sessionID, memberID string) bool {
	h.mu.RLock()
	s, ok := h.Sessions[sessionID]
	h.mu.RUnlock()
	if !ok {
		return false
	}
	s.Mu.Lock()
	var target *Client
	for member := range s.Members {
		if member.id == memberID {
			target = member
			break
		}
	}
	if target != nil {
		delete(s.Members, target)
	}
	s.Mu.Unlock()
	if target == nil {
		return false
	}
	_ = h.safeEnqueue(target, StandardNotification{
		Type:      "member_kicked",
		SessionID: sessionID,
		Time:      time.Now().UTC().Format(time.RFC3339),
	})
	target.Close()
	return true
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
	// update the connection to a websocket
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Error().Err(err).Str("sessionID", req.SessionID).Msg("websocket upgrade failed for owner")
		return err
	}
	s := h.EnsureSession(req.SessionID, req.BatchID)

	h.mu.Lock()
	if s.Owner != nil {
		if s.Owner.id != req.OwnerID {
			h.mu.Unlock()
			_ = conn.Close()
			return http.ErrUseLastResponse
		}
		oldOwner := s.Owner
		newOwner := &Client{conn: conn, out: make(chan any, 16), id: req.OwnerID}
		s.Owner = newOwner
		s.BatchID = req.BatchID
		h.mu.Unlock()
		oldOwner.Close()
		if err := h.startWebhookWriter(newOwner, "owner", req.SessionID); err != nil {
			log.Error().Err(err).Str("sessionID", req.SessionID).Msg("Failed to start webhook writer for new owner")
		}
		if err := h.startWebhookReader(newOwner, req.SessionID); err != nil {
			log.Error().Err(err).Str("sessionID", req.SessionID).Msg("Failed to start webhook reader for new owner")
		}
		h.sendOwnerStatusNotification(OwnerStatusNotification{
			Type:       "owner_joined",
			SessionID:  req.SessionID,
			OwnerID:    req.OwnerID,
			OwnerEmail: req.OwnerEmail,
			Time:       time.Now().UTC(),
		})
		return nil
	}
	owner := &Client{conn: conn, out: make(chan any, 16), id: req.OwnerID}
	s.Owner = owner
	s.BatchID = req.BatchID
	h.mu.Unlock()
	// This handles websocket communication for the owner
	if err := h.startWebhookWriter(owner, "owner", req.SessionID); err != nil {
		return err
	}
	if err := h.startWebhookReader(owner, req.SessionID); err != nil {
		return err
	}
	h.sendOwnerStatusNotification(OwnerStatusNotification{
		Type:       "owner_joined",
		SessionID:  req.SessionID,
		OwnerID:    req.OwnerID,
		OwnerEmail: req.OwnerEmail,
		Time:       time.Now().UTC(),
	})
	return nil
}

// JoinSession upgrades the HTTP connection and registers the member client for the session.
func (h *WebSocketHub) JoinSession(w http.ResponseWriter, r *http.Request, req JoinSessionConnectionRequest) error {
	s := h.EnsureSession(req.SessionID, req.BatchID)

	// upgrade the connection to a websocket
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Error().Err(err).Str("sessionID", req.SessionID).Msg("websocket upgrade failed for member")
		return err
	}

	// add the member to the session
	member := &Client{conn: conn, out: make(chan any, 16), id: req.MemberID}
	s.Mu.Lock()
	s.Members[member] = struct{}{}
	s.Mu.Unlock()

	// notify all other session clients that a new member has joined
	h.sendMemberStatusNotification(MemberStatusNotification{
		Type:        "member_joined",
		SessionID:   req.SessionID,
		MemberID:    req.MemberID,
		MemberEmail: req.MemberEmail,
		Time:        time.Now().UTC(),
	})

	if err := h.startWebhookWriter(member, "member", req.SessionID); err != nil {
		return err
	}
	if err := h.startWebhookReader(member, req.SessionID); err != nil {
		return err
	}
	return nil
}

// startLabelsWatch starts a realtime Firestore watch for the labels of a given batchID.
func (h *WebSocketHub) startLabelsWatch(c *Client, sessionID string) {
	// stop any existing watch first
	keypointStop, err := h.KeyPointStore.WatchByImagesID(context.Background(), c.imageID, func(docs []*firestore.DocumentSnapshot) {
		// Send only to this client
		notif := StandardNotification{
			Type:      "key_points_snapshot",
			SessionID: sessionID,
			Time:      time.Now().UTC().Format(time.RFC3339),
		}
		_ = h.safeEnqueue(c, notif)
	})

	if err != nil {
		log.Error().Err(err).Str("sessionID", sessionID).Str("batchID", c.imageID).Msg("failed to start keypoint watch")
		return
	}

	boundingBoxStop, err := h.BoundingBoxStore.WatchByImagesID(context.Background(), c.imageID, func(docs []*firestore.DocumentSnapshot) {
		// Send only to this client
		notif := StandardNotification{
			Type:      "bounding_boxes_snapshot",
			SessionID: sessionID,
			Time:      time.Now().UTC().Format(time.RFC3339),
		}
		_ = h.safeEnqueue(c, notif)
	})

	if err != nil {
		log.Error().Err(err).Str("sessionID", sessionID).Str("batchID", c.imageID).Msg("failed to start bounding box watch")
		return
	}

	c.keypointWatch = keypointStop
	c.boundingBoxWatch = boundingBoxStop
}

// stopLabelsWatch stops an active labels watch for a session, if any.
func (h *WebSocketHub) stopLabelsWatch(c *Client) {
	h.mu.Lock()
	if c.keypointWatch != nil {
		c.keypointWatch()
		c.keypointWatch = nil
	}
	if c.boundingBoxWatch != nil {
		c.boundingBoxWatch()
		c.boundingBoxWatch = nil
	}
	h.mu.Unlock()
}
