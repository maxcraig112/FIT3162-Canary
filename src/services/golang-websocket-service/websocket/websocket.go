package websocket

import (
	"context"
	"net/http"
	"sync"
	"time"
	wsfs "websocket-service/firestore"

	"cloud.google.com/go/firestore"
	"github.com/gorilla/websocket"
	"github.com/rs/zerolog/log"
)

type CreateSessionConnectionRequest struct {
	OwnerID   string `json:"ownerID"`
	SessionID string `json:"sessionID"`
	BatchID   string `json:"batchID"`
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
	// Only create if not present; if present and owner exists, reject by closing.
	h.mu.Lock()
	s, ok := h.Sessions[req.SessionID]
	if !ok {
		s = &Session{Members: make(map[*Client]struct{})}
		h.Sessions[req.SessionID] = s
	}

	// If an owner already exists we may be in a dev hot-reload or reconnect scenario.
	// If the same user is reconnecting, replace the old connection gracefully; otherwise reject.
	if s.Owner != nil {
		if s.Owner.id != req.OwnerID {
			h.mu.Unlock()
			_ = conn.Close()
			return http.ErrUseLastResponse
		}
		// Same owner userID: swap connections (close old after swap to avoid race)
		oldOwner := s.Owner
		newOwner := &Client{conn: conn, out: make(chan any, 16), id: req.OwnerID}
		s.Owner = newOwner
		s.BatchID = req.BatchID // keep batchID consistent
		h.mu.Unlock()
		oldOwner.Close()
		h.startWebhookWriter(newOwner, "owner", req.SessionID)
		h.startWebhookReader(newOwner, req.SessionID)
		return nil
	}

	owner := &Client{conn: conn, out: make(chan any, 16), id: req.OwnerID}
	s.Owner = owner
	// we should keep track of the batchID potentially for validation that an image watch request is valid
	s.BatchID = req.BatchID
	h.mu.Unlock()
	// This handles websocket communication for the owner
	h.startWebhookWriter(owner, "owner", req.SessionID)
	h.startWebhookReader(owner, req.SessionID)
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

	// updgrade the connection to a websocket
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
		Type:      "member_joined",
		SessionID: req.SessionID,
		MemberID:  req.MemberID,
		Time:      time.Now().UTC(),
	})

	h.startWebhookWriter(member, "member", req.SessionID)
	h.startWebhookReader(member, req.SessionID)
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
