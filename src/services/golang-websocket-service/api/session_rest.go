package api

import (
	"encoding/json"
	"net/http"
	"time"

	"pkg/handler"

	"websocket-service/firestore"
	wsjwt "websocket-service/jwt"
	"websocket-service/websocket"

	"github.com/gorilla/mux"
	"github.com/rs/zerolog/log"
)

// SessionHandler aggregates dependencies for session REST + WebSocket flows.
type SessionHandler struct {
	*handler.Handler
	Hub          *websocket.WebSocketHub
	ProjectStore *firestore.ProjectStore
	BatchStore   *firestore.BatchStore
	SessionStore *firestore.SessionStore
}

func newSessionHandler(h *handler.Handler, hub *websocket.WebSocketHub, sessionStore *firestore.SessionStore) *SessionHandler {
	return &SessionHandler{
		Handler:      h,
		Hub:          hub,
		ProjectStore: firestore.NewProjectStore(h.Clients.Firestore),
		BatchStore:   firestore.NewBatchStore(h.Clients.Firestore),
		SessionStore: sessionStore,
	}
}

// RegisterSessionRoutes wires both REST endpoints (token issuance) and websocket upgrade endpoints.
func RegisterSessionRoutes(r *mux.Router, h *handler.Handler) {
	sessionStore := firestore.NewSessionStore(h.Clients.Firestore)
	hub := websocket.NewWebSocketHub(sessionStore)
	sh := newSessionHandler(h, hub, sessionStore)

	// REST: request tokens
	r.HandleFunc("/sessions/{batchID}", sh.CreateSessionHandler).Methods("POST")
	r.HandleFunc("/sessions/{sessionID}/join", sh.JoinSessionHandler).Methods("POST")
	// WebSocket: upgrade using tokens (handlers implemented in session_websocket.go)
	r.HandleFunc("/sessions/{sessionID}/ws/create", sh.CreateSessionWebSocketHandler).Methods("GET")
	r.HandleFunc("/sessions/{sessionID}/ws/join", sh.JoinSessionWebSocketHandler).Methods("GET")
}

// CreateSessionHandler validates ownership and returns a short-lived token; websocket is established later.
func (sh *SessionHandler) CreateSessionHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	batchID := vars["batchID"]
	userIDParam := r.URL.Query().Get("userID")
	if userIDParam == "" {
		http.Error(w, "Missing userID query parameter", http.StatusBadRequest)
		log.Error().Msg("Missing userID query parameter for create session")
		return
	}
	req := firestore.CreateSessionRequest{UserID: userIDParam, BatchID: batchID}

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

	if exists := sh.SessionStore.DoesSessionWithBatchExist(r.Context(), batchID); exists {
		http.Error(w, "Session already exists for this batch", http.StatusConflict)
		log.Warn().Msgf("Session already exists for batch %s", batchID)
		return
	}

	sessionID, err := sh.SessionStore.CreateNewSession(r.Context(), req)
	if err != nil {
		http.Error(w, "Failed to create session", http.StatusInternalServerError)
		log.Error().Err(err).Msg("Failed to create session in Firestore")
		return
	}

	ttl := 60 * time.Second
	token, err := wsjwt.GenerateShortLivedSessionToken(req.UserID, sessionID, batchID, ttl)
	if err != nil {
		http.Error(w, "Failed to generate token", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"sessionID": sessionID,
		"token":     token,
		"expiresIn": int(ttl.Seconds()),
	})
}

// JoinSessionHandler returns a short-lived token for joining; websocket upgrade is separate.
func (sh *SessionHandler) JoinSessionHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	sessionID := vars["sessionID"]
	userIDParam := r.URL.Query().Get("userID")
	if userIDParam == "" {
		http.Error(w, "Missing userID query parameter", http.StatusBadRequest)
		log.Error().Msg("Missing userID query parameter for join session")
		return
	}
	req := firestore.JoinSessionRequest{UserID: userIDParam, SessionID: sessionID}

	if isInSession, err := sh.SessionStore.IsUserInSession(r.Context(), req); err != nil {
		http.Error(w, "Failed to check user in session", http.StatusInternalServerError)
		log.Error().Str("userID", req.UserID).Str("sessionID", sessionID).Err(err).Msg("Failed to check user in session in Firestore")
		return
	} else if isInSession {
		http.Error(w, "User is already in session", http.StatusConflict)
		log.Warn().Str("userID", req.UserID).Str("sessionID", sessionID).Msg("User is already in session")
		return
	}

	if err := sh.SessionStore.AddMemberToSession(r.Context(), req); err != nil {
		http.Error(w, "Failed to add member to session", http.StatusInternalServerError)
		log.Error().Str("userID", req.UserID).Str("sessionID", sessionID).Err(err).Msg("Failed to add member to session in Firestore")
		return
	}
	ttl := 60 * time.Second
	token, err := wsjwt.GenerateShortLivedSessionToken(req.UserID, sessionID, "", ttl)
	if err != nil {
		http.Error(w, "Failed to generate token", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"sessionID": sessionID,
		"token":     token,
		"expiresIn": int(ttl.Seconds()),
	})
}
