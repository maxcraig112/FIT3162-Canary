package api

import (
	"net/http"

	pkgjwt "pkg/jwt"

	wsjwt "websocket-service/jwt"
	"websocket-service/websocket"

	"github.com/gorilla/mux"
	"github.com/rs/zerolog/log"
)

// CreateSessionWebSocketHandler upgrades for owner using provided short-lived token.
func (sh *SessionHandler) CreateSessionWebSocketHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	sessionID := vars["sessionID"]
	token := r.URL.Query().Get("token")
	if token == "" {
		http.Error(w, "missing token", http.StatusUnauthorized)
		return
	}

	if r.Header.Get("Authorization") == "" {
		if qpAuth := r.URL.Query().Get("auth"); qpAuth != "" {
			r.Header.Set("Authorization", "Bearer "+qpAuth)
		}
	}

	claims, err := wsjwt.ValidateShortLivedSessionToken(token)
	if err != nil || claims.SessionID != sessionID || claims.Purpose != "session-join" {
		http.Error(w, "invalid token", http.StatusUnauthorized)
		return
	}
	if err := pkgjwt.ValidateJWT(r, claims.UserID); err != nil { // ensure main auth token still present
		http.Error(w, "auth failed", http.StatusUnauthorized)
		return
	}
	if claims.BatchID == "" {
		http.Error(w, "missing batch id", http.StatusBadRequest)
		return
	}
	req := websocket.CreateSessionConnectionRequest{OwnerID: claims.UserID, SessionID: sessionID, BatchID: claims.BatchID}
	if err := sh.Hub.CreateSession(w, r, req); err != nil {
		log.Error().Err(err).Str("sessionID", sessionID).Msg("owner websocket upgrade failed")
		return
	}
}

// JoinSessionWebSocketHandler upgrades for member using provided short-lived token.
func (sh *SessionHandler) JoinSessionWebSocketHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	sessionID := vars["sessionID"]
	token := r.URL.Query().Get("token")
	if token == "" {
		http.Error(w, "missing token", http.StatusUnauthorized)
		return
	}

	if r.Header.Get("Authorization") == "" {
		if qpAuth := r.URL.Query().Get("auth"); qpAuth != "" {
			r.Header.Set("Authorization", "Bearer "+qpAuth)
		}
	}

	claims, err := wsjwt.ValidateShortLivedSessionToken(token)
	if err != nil || claims.SessionID != sessionID || claims.Purpose != "session-join" {
		http.Error(w, "invalid token", http.StatusUnauthorized)
		return
	}

	if err := pkgjwt.ValidateJWT(r, claims.UserID); err != nil {
		http.Error(w, "auth failed", http.StatusUnauthorized)
		return
	}
	req := websocket.JoinSessionConnectionRequest{MemberID: claims.UserID, SessionID: sessionID}
	if err := sh.Hub.JoinSession(w, r, req); err != nil {
		log.Error().Err(err).Str("sessionID", sessionID).Msg("member websocket upgrade failed")
		return
	}
}
