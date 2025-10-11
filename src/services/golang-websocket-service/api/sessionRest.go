package api

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"time"

	fs "pkg/gcp/firestore"
	"pkg/handler"
	"pkg/jwt"
	"pkg/password"
	"websocket-service/firestore"
	wsjwt "websocket-service/jwt"
	"websocket-service/websocket"

	"github.com/gorilla/mux"
	"github.com/rs/zerolog/log"
)

// SessionHandler aggregates dependencies for session REST + WebSocket flows.
type SessionHandler struct {
	*handler.Handler
	Hub    *websocket.WebSocketHub
	Stores SessionStores
}

func newSessionHandler(h *handler.Handler, hub *websocket.WebSocketHub, stores SessionStores) *SessionHandler {
	return &SessionHandler{
		Handler: h,
		Hub:     hub,
		Stores:  stores,
	}
}

// RegisterSessionRoutes wires both REST endpoints (token issuance) and websocket upgrade endpoints.
func RegisterSessionRoutes(r *mux.Router, h *handler.Handler) {
	stores := InitialiseSessionStores(h)
	hub := websocket.NewWebSocketHub(stores.SessionStore)
	sh := newSessionHandler(h, hub, stores)

	// REST: request tokens
	r.HandleFunc("/sessions/{batchID}", sh.CreateSessionHandler).Methods("POST")
	r.HandleFunc("/sessions/{sessionID}/join", sh.JoinSessionHandler).Methods("POST")
	r.HandleFunc("/sessions/{sessionID}", sh.StopSessionHandler).Methods("DELETE")
	r.HandleFunc("/sessions/{sessionID}/members/{memberID}", sh.KickMemberHandler).Methods("DELETE")
	r.HandleFunc("/sessions/active", sh.ActiveSessionsHandler).Methods("GET")
	// WebSocket: upgrade using tokens (handlers implemented in session_websocket.go)
	r.HandleFunc("/sessions/{sessionID}/ws/create", sh.CreateSessionWebSocketHandler).Methods("GET")
	r.HandleFunc("/sessions/{sessionID}/ws/join", sh.JoinSessionWebSocketHandler).Methods("GET")
}

// Helper function to extract email from JWT token
func getEmailFromRequest(r *http.Request) string {
	tokenString, err := jwt.GetAuthTokenString(r)
	if err != nil {
		return ""
	}

	claims, err := jwt.GetJWTClaims(tokenString)
	if err != nil {
		return ""
	}

	if email, ok := claims["email"].(string); ok {
		return email
	}

	return ""
}

// Helper function to get user email by userID using UserStore
func (sh *SessionHandler) getUserEmailByID(ctx context.Context, userID string) string {
	// First try to get email from JWT
	// Note: This would require passing the request, but for now we'll use UserStore directly

	user, err := sh.Stores.UserStore.GetUserByID(ctx, userID)
	if err != nil {
		log.Warn().Err(err).Str("userID", userID).Msg("Failed to get user email from UserStore")
		return ""
	}

	return user.Email
}

// Helper function to get user email from JWT token or UserStore as fallback
func (sh *SessionHandler) getUserEmailFromRequestOrStore(r *http.Request, userID string) string {
	// First try to get email from JWT token
	email := getEmailFromRequest(r)
	if email != "" {
		return email
	}

	// Fallback to UserStore lookup
	return sh.getUserEmailByID(r.Context(), userID)
}

type ActiveSessionResponse struct {
	SessionID      string             `json:"sessionID"`
	BatchID        string             `json:"batchID"`
	ProjectID      string             `json:"projectID"`
	Owner          firestore.Member   `json:"owner"`
	Members        []firestore.Member `json:"members"`
	OwnerConnected bool               `json:"ownerConnected"`
	LastUpdated    time.Time          `json:"lastUpdated"`
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

	var body firestore.SessionPasswordRequest
	if r.Body != nil {
		dec := json.NewDecoder(r.Body)
		if err := dec.Decode(&body); err != nil {
			if errors.Is(err, io.EOF) {
				body = firestore.SessionPasswordRequest{}
			} else {
				http.Error(w, "Invalid request", http.StatusBadRequest)
				log.Warn().Err(err).Msg("Failed to decode create session body")
				return
			}
		}
	}

	req := firestore.CreateSessionRequest{
		UserID:    userIDParam,
		UserEmail: sh.getUserEmailFromRequestOrStore(r, userIDParam),
		BatchID:   batchID,
	}

	projectID, err := sh.Stores.BatchStore.GetProjectIDFromBatchID(r.Context(), batchID)
	if err != nil {
		http.Error(w, "Failed to get project ID", http.StatusInternalServerError)
		log.Error().Err(err).Msgf("Failed to get project ID from batch ID %s", batchID)
		return
	}
	project, err := sh.Stores.ProjectStore.GetProject(r.Context(), projectID)
	if err != nil {
		http.Error(w, "Failed to get project", http.StatusInternalServerError)
		log.Error().Err(err).Msgf("Failed to get project ID from batch ID %s", batchID)
		return
	}
	userID := project.UserID

	if userID != req.UserID {
		http.Error(w, "User is not authorized to create session from batch", http.StatusForbidden)
		log.Warn().Msgf("User %s is not authorized to create session from batch %s", userID, batchID)
		return
	}

	req.ProjectID = projectID
	if body.Password != "" {
		hashedPassword, hashErr := password.HashPassword(body.Password)
		if hashErr != nil {
			http.Error(w, "Failed to hash session password", http.StatusInternalServerError)
			log.Error().Err(hashErr).Msg("Failed to hash session password")
			return
		}
		req.Password = string(hashedPassword)
	}

	if exists := sh.Stores.SessionStore.DoesSessionWithBatchExist(r.Context(), batchID); exists {
		http.Error(w, "Session already exists for this batch", http.StatusConflict)
		log.Warn().Msgf("Session already exists for batch %s", batchID)
		return
	}

	sessionID, err := sh.Stores.SessionStore.CreateNewSession(r.Context(), req)
	if err != nil {
		http.Error(w, "Failed to create session", http.StatusInternalServerError)
		log.Error().Err(err).Msg("Failed to create session in Firestore")
		return
	}
	sh.Hub.EnsureSession(sessionID, batchID)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"sessionID": sessionID,
		"batchID":   batchID,
		"projectID": projectID,
		"role":      "owner",
	})
	log.Info().Str("userID", req.UserID).Str("sessionID", sessionID).Str("batchID", batchID).Msg("Created new session")
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

	var body firestore.SessionPasswordRequest
	if r.Body != nil {
		dec := json.NewDecoder(r.Body)
		if err := dec.Decode(&body); err != nil {
			if errors.Is(err, io.EOF) {
				body = firestore.SessionPasswordRequest{}
			} else {
				http.Error(w, "Invalid request", http.StatusBadRequest)
				log.Error().Err(err).Str("sessionID", sessionID).Msg("Failed to decode join session body")
				return
			}
		}
	}

	req := firestore.JoinSessionRequest{
		Password:  body.Password,
		UserID:    userIDParam,
		UserEmail: sh.getUserEmailFromRequestOrStore(r, userIDParam),
		SessionID: sessionID,
	}

	// Retrieve session to validate password or ownership
	session, err := sh.Stores.SessionStore.GetSession(r.Context(), sessionID)
	if err != nil || session == nil {
		http.Error(w, "Session not found", http.StatusNotFound)
		log.Warn().Str("sessionID", sessionID).Err(err).Msg("Session not found while joining")
		return
	}
	isOwner := session.Owner.ID == req.UserID

	requiresPassword := session.Password != ""
	if !isOwner && requiresPassword {
		if req.Password == "" {
			http.Error(w, "Missing password", http.StatusBadRequest)
			log.Warn().Str("sessionID", sessionID).Str("userID", req.UserID).Msg("Join session password missing")
			return
		}

		if err := password.CheckPasswordHash(req.Password, session.Password); err != nil {
			http.Error(w, "Invalid session password", http.StatusForbidden)
			log.Warn().Str("sessionID", sessionID).Str("userID", req.UserID).Msg("Invalid session password")
			return
		}
	}

	if !isOwner {
		if isInSession, err := sh.Stores.SessionStore.IsUserInSession(r.Context(), req); err != nil {
			http.Error(w, "Failed to check user in session", http.StatusInternalServerError)
			log.Error().Str("userID", req.UserID).Str("sessionID", sessionID).Err(err).Msg("Failed to check user in session in Firestore")
			return
		} else if isInSession {
			http.Error(w, "User is already in session", http.StatusConflict)
			log.Warn().Str("userID", req.UserID).Str("sessionID", sessionID).Msg("User is already in session")
			return
		}
	}

	if !isOwner {
		err = sh.Stores.SessionStore.AddMemberToSession(r.Context(), req)
		if err == fs.ErrNotFound {
			http.Error(w, "Session not found", http.StatusNotFound)
			log.Warn().Str("sessionID", sessionID).Msg("Session not found when adding member")
			return
		} else if err != nil {
			http.Error(w, "Failed to add member to session", http.StatusInternalServerError)
			log.Error().Str("userID", req.UserID).Str("sessionID", sessionID).Err(err).Msg("Failed to add member to session in Firestore")
			return
		}
	} else {
		if err := sh.Stores.SessionStore.TouchSession(r.Context(), sessionID); err != nil && err != fs.ErrNotFound {
			log.Warn().Err(err).Str("sessionID", sessionID).Msg("Failed to update session timestamp for owner join")
		}
	}
	sh.Hub.EnsureSession(sessionID, session.BatchID)
	ttl := 60 * time.Second
	batchForToken := ""
	role := "member"
	if isOwner {
		batchForToken = session.BatchID
		role = "owner"
	}
	token, err := wsjwt.GenerateShortLivedSessionToken(req.UserID, sessionID, batchForToken, ttl)
	if err != nil {
		http.Error(w, "Failed to generate token", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"sessionID": sessionID,
		"batchID":   session.BatchID,
		"projectID": session.ProjectID,
		"token":     token,
		"expiresIn": int(ttl.Seconds()),
		"role":      role,
	})
	if isOwner {
		log.Info().Str("userID", req.UserID).Str("sessionID", sessionID).Msg("Owner refreshed session token")
	} else {
		log.Info().Str("userID", req.UserID).Str("sessionID", sessionID).Msg("User joined session")
	}
}

// StopSessionHandler allows the session owner to terminate an active session via REST.
func (sh *SessionHandler) StopSessionHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	sessionID := vars["sessionID"]
	if sessionID == "" {
		http.Error(w, "Missing sessionID", http.StatusBadRequest)
		return
	}
	userID := r.URL.Query().Get("userID")
	if userID == "" {
		http.Error(w, "Missing userID query parameter", http.StatusBadRequest)
		return
	}
	record, err := sh.Stores.SessionStore.GetSessionRecord(r.Context(), sessionID)
	if err == fs.ErrNotFound {
		http.Error(w, "Session not found", http.StatusNotFound)
		return
	} else if err != nil {
		http.Error(w, "Failed to fetch session", http.StatusInternalServerError)
		log.Error().Err(err).Str("sessionID", sessionID).Msg("Failed to fetch session for stop request")
		return
	}
	if record.Session.Owner.ID != userID {
		http.Error(w, "Only the session owner can stop the session", http.StatusForbidden)
		return
	}
	sh.Hub.StopSession(sessionID)
	if err := sh.Stores.SessionStore.DeleteSession(r.Context(), sessionID); err != nil && err != fs.ErrNotFound {
		http.Error(w, "Failed to delete session", http.StatusInternalServerError)
		log.Error().Err(err).Str("sessionID", sessionID).Msg("Failed to delete session during stop")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ActiveSessionsHandler returns the active sessions for a project or specific batch.
func (sh *SessionHandler) ActiveSessionsHandler(w http.ResponseWriter, r *http.Request) {
	projectID := r.URL.Query().Get("projectID")
	batchID := r.URL.Query().Get("batchID")
	if projectID == "" && batchID == "" {
		http.Error(w, "Provide projectID or batchID", http.StatusBadRequest)
		return
	}
	var (
		records []firestore.SessionRecord
		err     error
	)
	if batchID != "" {
		record, recErr := sh.Stores.SessionStore.GetSessionByBatch(r.Context(), batchID)
		if recErr == fs.ErrNotFound {
			records = []firestore.SessionRecord{}
		} else if recErr != nil {
			http.Error(w, "Failed to fetch session", http.StatusInternalServerError)
			log.Error().Err(recErr).Str("batchID", batchID).Msg("Failed to fetch session by batch")
			return
		} else if record != nil {
			records = []firestore.SessionRecord{*record}
		}
	} else {
		records, err = sh.Stores.SessionStore.ListSessionsByProject(r.Context(), projectID)
		if err != nil {
			http.Error(w, "Failed to list sessions", http.StatusInternalServerError)
			log.Error().Err(err).Str("projectID", projectID).Msg("Failed to list sessions for project")
			return
		}
	}
	responses := make([]ActiveSessionResponse, 0, len(records))
	for _, record := range records {
		responses = append(responses, ActiveSessionResponse{
			SessionID:      record.ID,
			BatchID:        record.Session.BatchID,
			ProjectID:      record.Session.ProjectID,
			Owner:          record.Session.Owner,
			Members:        append([]firestore.Member(nil), record.Session.Members...),
			OwnerConnected: sh.Hub.IsOwnerConnected(record.ID),
			LastUpdated:    record.Session.LastUpdated,
		})
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"sessions": responses})
}

// KickMemberHandler removes a member from the session (owner only) and disconnects their websocket if connected.
func (sh *SessionHandler) KickMemberHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	sessionID := vars["sessionID"]
	memberID := vars["memberID"]
	if sessionID == "" || memberID == "" {
		http.Error(w, "Missing sessionID or memberID", http.StatusBadRequest)
		return
	}
	userID := r.URL.Query().Get("userID")
	if userID == "" {
		http.Error(w, "Missing userID query parameter", http.StatusBadRequest)
		return
	}
	record, err := sh.Stores.SessionStore.GetSessionRecord(r.Context(), sessionID)
	if err == fs.ErrNotFound {
		http.Error(w, "Session not found", http.StatusNotFound)
		return
	} else if err != nil {
		http.Error(w, "Failed to fetch session", http.StatusInternalServerError)
		log.Error().Err(err).Str("sessionID", sessionID).Msg("Failed to fetch session for kick")
		return
	}
	if record.Session.Owner.ID != userID {
		http.Error(w, "Only the session owner can remove members", http.StatusForbidden)
		return
	}
	if memberID == record.Session.Owner.ID {
		http.Error(w, "Owner cannot be removed from session", http.StatusBadRequest)
		return
	}
	inSession := false
	var memberEmail string
	for _, member := range record.Session.Members {
		if member.ID == memberID {
			inSession = true
			memberEmail = member.Email
			break
		}
	}
	if !inSession {
		http.Error(w, "Member not found in session", http.StatusNotFound)
		return
	}
	if err := sh.Stores.SessionStore.RemoveMemberFromSession(r.Context(), sessionID, memberID, memberEmail); err != nil && err != fs.ErrNotFound {
		http.Error(w, "Failed to remove member", http.StatusInternalServerError)
		log.Error().Err(err).Str("sessionID", sessionID).Str("memberID", memberID).Msg("Failed to remove member from Firestore")
		return
	}
	sh.Hub.KickMember(sessionID, memberID)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"removed": true})
}
