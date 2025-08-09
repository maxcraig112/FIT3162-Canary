package api

import (
	"net/http"

	"pkg/handler"

	"websocket-service/firestore"
	"websocket-service/websocket"

	"github.com/gorilla/mux"
	"github.com/rs/zerolog/log"
)

type SessionHandler struct {
	*handler.Handler
	Hub          *websocket.WebSocketHub
	ProjectStore *firestore.ProjectStore
	BatchStore   *firestore.BatchStore
	SessionStore *firestore.SessionStore
}

func newSessionHandler(h *handler.Handler, hub *websocket.WebSocketHub) *SessionHandler {
	return &SessionHandler{
		Handler:      h,
		Hub:          hub,
		ProjectStore: firestore.NewProjectStore(h.Clients.Firestore),
		BatchStore:   firestore.NewBatchStore(h.Clients.Firestore),
		SessionStore: firestore.NewSessionStore(h.Clients.Firestore),
	}
}

func RegisterSessionRoutes(r *mux.Router, h *handler.Handler) {
	hub := websocket.NewWebSocketHub()
	sh := newSessionHandler(h, hub)

	r.HandleFunc("/sessions/{batchID}", sh.CreateSessionHandler)
	r.HandleFunc("/sessions/{sessionID}/join", sh.JoinSessionHandler)
}

func (sh *SessionHandler) CreateSessionHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	batchID := vars["batchID"]
	// Expect userID as a query parameter instead of request body
	userIDParam := r.URL.Query().Get("userID")
	if userIDParam == "" {
		http.Error(w, "Missing userID query parameter", http.StatusBadRequest)
		log.Error().Msg("Missing userID query parameter for create session")
		return
	}
	req := firestore.CreateSessionRequest{
		UserID:  userIDParam,
		BatchID: batchID,
	}

	projectID, err := sh.BatchStore.GetProjectIDFromBatchID(r.Context(), batchID)
	if err != nil {
		http.Error(w, "Failed to get project ID", http.StatusInternalServerError)
		log.Error().Err(err).Msgf("Failed to get project ID from batch ID %s", batchID)
		return
	}

	userID, err := sh.ProjectStore.GetUserIDFromProjectID(r.Context(), projectID)
	if err != nil {
		http.Error(w, "Failed to get user ID", http.StatusInternalServerError)
		log.Error().Err(err).Msgf("Failed to get user ID from project ID %s", projectID)
		return
	}

	if userID != req.UserID {
		http.Error(w, "User is not authorized to create session from batch", http.StatusForbidden)
		log.Warn().Msgf("User %s is not authorized to create session from batch %s", userID, batchID)
		return
	}

	// Create the new session in firestore
	sessionID, err := sh.SessionStore.CreateNewSession(r.Context(), req)
	if err != nil {
		http.Error(w, "Failed to create session", http.StatusInternalServerError)
		log.Error().Err(err).Msg("Failed to create session in Firestore")
		return
	}

	websocketReq := websocket.CreateSessionConnectionRequest{
		OwnerID:   req.UserID,
		SessionID: sessionID,
	}

	// Upgrade to WebSocket and assign this connection as owner
	if err := sh.Hub.CreateSession(w, r, websocketReq); err != nil {
		return // upgrade failed; logged in hub
	}
	log.Info().Str("sessionID", sessionID).Msg("session created and owner connected")
}

// JoinSessionHandler upgrades to WS and adds the member to the session
func (sh *SessionHandler) JoinSessionHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	sessionID := vars["sessionID"]
	// Expect userID as a query parameter instead of request body
	userIDParam := r.URL.Query().Get("userID")
	if userIDParam == "" {
		http.Error(w, "Missing userID query parameter", http.StatusBadRequest)
		log.Error().Msg("Missing userID query parameter for join session")
		return
	}
	req := firestore.JoinSessionRequest{
		UserID:    userIDParam,
		SessionID: sessionID,
	}

	err := sh.SessionStore.AddMemberToSession(r.Context(), req)
	if err != nil {
		http.Error(w, "Failed to add member to session", http.StatusInternalServerError)
		log.Error().Str("userID", req.UserID).Str("sessionID", sessionID).Err(err).Msg("Failed to add member to session in Firestore")
		return
	}

	websocketReq := websocket.JoinSessionConnectionRequest{
		MemberID:  req.UserID,
		SessionID: sessionID,
	}

	if err := sh.Hub.JoinSession(w, r, websocketReq); err != nil {
		http.Error(w, "Failed to join session", http.StatusInternalServerError)
		log.Error().Str("memberID", req.UserID).Str("sessionID", sessionID).Err(err).Msg("Failed to join session")
		return
	}
}
