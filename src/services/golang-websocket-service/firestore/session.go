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

type Member struct {
	ID    string `firestore:"id" json:"id"`
	Email string `firestore:"email" json:"email"`
}

type Session struct {
	Owner       Member    `firestore:"owner,omitempty" json:"owner"`
	BatchID     string    `firestore:"batchID,omitempty" json:"batchID"`
	ProjectID   string    `firestore:"projectID,omitempty" json:"projectID"`
	Password    string    `firestore:"password,omitempty" json:"password"`
	Members     []Member  `firestore:"members,omitempty" json:"members"`
	LastUpdated time.Time `firestore:"lastUpdated,omitempty" json:"lastUpdated"`
}

type SessionRecord struct {
	ID      string  `json:"id"`
	Session Session `json:"session"`
}

type SessionPasswordRequest struct {
	Password string `json:"password"`
}

type CreateSessionRequest struct {
	UserID    string `json:"userID"`
	UserEmail string `json:"userEmail"`
	BatchID   string `json:"batchID"`
	ProjectID string `json:"projectID"`
	Password  string `json:"password,omitempty"`
}

type JoinSessionRequest struct {
	UserID    string `json:"userID"`
	UserEmail string `json:"userEmail"`
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
		Owner: Member{
			ID:    req.UserID,
			Email: req.UserEmail,
		},
		BatchID:     req.BatchID,
		ProjectID:   req.ProjectID,
		Password:    req.Password,
		Members:     []Member{},
		LastUpdated: time.Now(),
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
	return doc.Ref.ID != ""
}

func (s *SessionStore) AddMemberToSession(ctx context.Context, req JoinSessionRequest) error {
	member := Member{
		ID:    req.UserID,
		Email: req.UserEmail,
	}
	updateParams := []firestore.Update{
		{Path: "members", Value: firestore.ArrayUnion(member)},
		{Path: "lastUpdated", Value: time.Now()},
	}
	return s.genericStore.UpdateDoc(ctx, req.SessionID, updateParams)
}

func (s *SessionStore) RemoveMemberFromSession(ctx context.Context, sessionID string, memberID string, memberEmail string) error {
	member := Member{
		ID:    memberID,
		Email: memberEmail,
	}
	updateParams := []firestore.Update{
		{Path: "members", Value: firestore.ArrayRemove(member)},
		{Path: "lastUpdated", Value: time.Now()},
	}
	return s.genericStore.UpdateDoc(ctx, sessionID, updateParams)
}

func (s *SessionStore) TouchSession(ctx context.Context, sessionID string) error {
	updateParams := []firestore.Update{
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

	return req.UserID == session.Owner.ID || lo.Contains(lo.Map(session.Members, func(m Member, _ int) string { return m.ID }), req.UserID), nil
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

func (s *SessionStore) GetSessionRecord(ctx context.Context, sessionID string) (*SessionRecord, error) {
	docSnap, err := s.genericStore.GetDoc(ctx, sessionID)
	if err != nil {
		return nil, err
	}
	var session Session
	if err := docSnap.DataTo(&session); err != nil {
		return nil, err
	}
	return &SessionRecord{ID: docSnap.Ref.ID, Session: session}, nil
}

func (s *SessionStore) GetSessionByBatch(ctx context.Context, batchID string) (*SessionRecord, error) {
	queryParams := []fs.QueryParameter{
		{Path: "batchID", Op: "==", Value: batchID},
	}
	doc, err := s.genericStore.GetDocByQuery(ctx, queryParams)
	if err != nil {
		return nil, err
	}
	var session Session
	if err := doc.DataTo(&session); err != nil {
		return nil, err
	}
	return &SessionRecord{ID: doc.Ref.ID, Session: session}, nil
}

func (s *SessionStore) ListSessionsByProject(ctx context.Context, projectID string) ([]SessionRecord, error) {
	queryParams := []fs.QueryParameter{
		{Path: "projectID", Op: "==", Value: projectID},
	}
	docs, err := s.genericStore.ReadCollection(ctx, queryParams)
	if err != nil {
		return nil, err
	}
	result := make([]SessionRecord, 0, len(docs))
	for _, doc := range docs {
		var session Session
		if err := doc.DataTo(&session); err != nil {
			continue
		}
		result = append(result, SessionRecord{ID: doc.Ref.ID, Session: session})
	}
	return result, nil
}
