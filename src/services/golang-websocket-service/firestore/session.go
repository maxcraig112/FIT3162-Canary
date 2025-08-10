package firestore

import (
	"context"
	fs "pkg/gcp/firestore"
	"time"

	"cloud.google.com/go/firestore"
)

const (
	sessionCollectionID = "sessions"
)

type Session struct {
	OwnerID     string    `firestore:"ownerID,omitempty" json:"ownerID"`
	BatchID     string    `firestore:"batchID,omitempty" json:"batchID"`
	Members     []string  `firestore:"members,omitempty" json:"members"`
	LastUpdated time.Time `firestore:"lastUpdated,omitempty" json:"lastUpdated"`
}

type CreateSessionRequest struct {
	UserID  string `json:"userID"`
	BatchID string `json:"batchID"`
}

type JoinSessionRequest struct {
	UserID    string `json:"userID"`
	SessionID string `json:"sessionID"`
}

type SessionStore struct {
	genericStore *fs.GenericStore
}

func NewSessionStore(client fs.FirestoreClientInterface) *SessionStore {
	return &SessionStore{genericStore: fs.NewGenericStore(client, sessionCollectionID)}
}

// GenericClient exposes the underlying Firestore client for constructing other stores.
func (s *SessionStore) GenericClient() fs.FirestoreClientInterface { return s.genericStore.Client() }

func (s *SessionStore) CreateNewSession(ctx context.Context, req CreateSessionRequest) (string, error) {
	session := Session{
		OwnerID: req.UserID,
		BatchID: req.BatchID,
		Members: []string{},
	}
	return s.genericStore.CreateDoc(ctx, session)
}

func (s *SessionStore) DeleteSession(ctx context.Context, sessionID string) error {
	return s.genericStore.DeleteDoc(ctx, sessionID)
}

func (s *SessionStore) AddMemberToSession(ctx context.Context, req JoinSessionRequest) error {
	updateParams := []firestore.Update{
		{Path: "members", Value: firestore.ArrayUnion(req.UserID)},
		{Path: "lastUpdated", Value: time.Now()},
	}
	return s.genericStore.UpdateDoc(ctx, req.SessionID, updateParams)
}

func (s *SessionStore) RemoveMemberFromSession(ctx context.Context, sessionID string, memberID string) error {
	updateParams := []firestore.Update{
		{Path: "members", Value: firestore.ArrayRemove(memberID)},
		{Path: "lastUpdated", Value: time.Now()},
	}
	return s.genericStore.UpdateDoc(ctx, sessionID, updateParams)
}
