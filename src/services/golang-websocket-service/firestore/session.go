package firestore

import (
	"context"
	fs "pkg/gcp/firestore"
	"time"

	"cloud.google.com/go/firestore"
	"github.com/samber/lo"
)

const (
	sessionCollectionID = "sessions"
)

type Session struct {
	OwnerID     string    `firestore:"ownerID,omitempty" json:"ownerID"`
	BatchID     string    `firestore:"batchID,omitempty" json:"batchID"`
	ProjectID   string    `firestore:"projectID,omitempty" json:"projectID"`
	Password    string    `firestore:"password,omitempty" json:"password"`
	Members     []string  `firestore:"members,omitempty" json:"members"`
	LastUpdated time.Time `firestore:"lastUpdated,omitempty" json:"lastUpdated"`
}

type CreateSessionRequest struct {
	UserID    string `json:"userID"`
	BatchID   string `json:"batchID"`
	ProjectID string `json:"projectID"`
	Password  string `json:"password,omitempty"`
}

type JoinSessionRequest struct {
	UserID    string `json:"userID"`
	SessionID string `json:"sessionID"`
	Password  string `json:"password,omitempty"`
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
		OwnerID:   req.UserID,
		BatchID:   req.BatchID,
		ProjectID: req.ProjectID,
		Password:  req.Password,
		Members:   []string{},
	}
	return s.genericStore.CreateDoc(ctx, session)
}

func (s *SessionStore) DeleteSession(ctx context.Context, sessionID string) error {
	return s.genericStore.DeleteDoc(ctx, sessionID)
}

func (s *SessionStore) DoesSessionWithBatchExist(ctx context.Context, batchID string) bool {
	queryParams := []fs.QueryParameter{
		{Path: "batchID", Op: "==", Value: batchID},
	}
	doc, err := s.genericStore.GetDocByQuery(ctx, queryParams)
	if err != nil {
		return false
	}
	var session Session
	if err := doc.DataTo(&session); err != nil {
		return false
	}
	return doc.Ref.ID != ""
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

func (s *SessionStore) IsUserInSession(ctx context.Context, req JoinSessionRequest) (bool, error) {
	doc, err := s.genericStore.GetDoc(ctx, req.SessionID)
	if err != nil {
		return false, nil // If the session doesn't exist, return false
	}

	// convert into Session
	var session Session
	if err := doc.DataTo(&session); err != nil {
		return false, nil
	}

	return req.UserID == session.OwnerID || lo.Contains(session.Members, req.UserID), nil
}

func (s *SessionStore) GetSession(ctx context.Context, sessionID string) (*Session, error) {
	docSnap, err := s.genericStore.GetDoc(ctx, sessionID)
	if err != nil {
		return nil, err
	}
	var session Session
	if err := docSnap.DataTo(&session); err != nil {
		return nil, err
	}
	return &session, nil
}
