package firestore

import (
	"context"
	fs "pkg/gcp/firestore"
)

const (
	projectCollectionID = "projects"
)

type Project struct {
	UserID string `firestore:"userID,omitempty" json:"userID"`
}

type ProjectStore struct {
	genericStore *fs.GenericStore
}

func NewProjectStore(client fs.FirestoreClientInterface) *ProjectStore {
	return &ProjectStore{genericStore: fs.NewGenericStore(client, projectCollectionID)}
}

func (s *ProjectStore) GetUserIDFromProjectID(ctx context.Context, projectID string) (string, error) {
	doc, err := s.genericStore.GetDoc(ctx, projectID)
	if err != nil {
		return "", err
	}
	var project Project
	if err := doc.DataTo(&project); err != nil {
		return "", err
	}
	return project.UserID, nil
}
