package firestore

import (
	"context"
	fs "pkg/gcp/firestore"
	"time"
)

const (
	sessionCollectionID = "sessions"
)

// Session represents a collaborative annotation session document.
type Session struct {
	OwnerID     string    `firestore:"ownerID,omitempty" json:"ownerID"`
	BatchID     string    `firestore:"batchID,omitempty" json:"batchID"`
	ProjectID   string    `firestore:"projectID,omitempty" json:"projectID"`
	Password    string    `firestore:"password,omitempty" json:"password"`
	Members     []string  `firestore:"members,omitempty" json:"members"`
	LastUpdated time.Time `firestore:"lastUpdated,omitempty" json:"lastUpdated"`
}

type SessionStore struct {
	genericStore *fs.GenericStore
}

func NewSessionStore(client fs.FirestoreClientInterface) *SessionStore {
	return &SessionStore{genericStore: fs.NewGenericStore(client, sessionCollectionID)}
}

// GetSession fetches a session document by ID.
func (s *SessionStore) GetSession(ctx context.Context, sessionID string) (*Session, error) {
	snap, err := s.genericStore.GetDoc(ctx, sessionID)
	if err != nil {
		return nil, err
	}
	var session Session
	if err := snap.DataTo(&session); err != nil {
		return nil, err
	}
	return &session, nil
}
