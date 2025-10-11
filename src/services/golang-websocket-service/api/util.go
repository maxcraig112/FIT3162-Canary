package api

import (
	"pkg/handler"
	"websocket-service/firestore"
)

// SessionStores groups the Firestore-backed stores required by session handlers.
type SessionStores struct {
	SessionStore *firestore.SessionStore
	ProjectStore *firestore.ProjectStore
	BatchStore   *firestore.BatchStore
	UserStore    *firestore.UserStore
}

// InitialiseSessionStores instantiates Firestore stores used across session REST and websocket handlers.
func InitialiseSessionStores(h *handler.Handler) SessionStores {
	client := h.Clients.Firestore
	return SessionStores{
		SessionStore: firestore.NewSessionStore(client),
		ProjectStore: firestore.NewProjectStore(client),
		BatchStore:   firestore.NewBatchStore(client),
		UserStore:    firestore.NewUserStore(client),
	}
}
