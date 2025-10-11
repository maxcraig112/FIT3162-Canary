package firestore

import (
	"context"
	fs "pkg/gcp/firestore"
	"time"
)

const (
	projectCollectionID = "projects"
)

type Project struct {
	ProjectID       string    `firestore:"projectID,omitempty" json:"projectID"`
	ProjectName     string    `firestore:"projectName,omitempty" json:"projectName"`
	UserID          string    `firestore:"userID,omitempty" json:"userID"`
	NumberOfBatches int64     `firestore:"numberOfBatches,omitempty" json:"numberOfBatches"`
	LastUpdated     time.Time `firestore:"lastUpdated,omitempty" json:"lastUpdated"`
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

func (s *ProjectStore) GetProject(ctx context.Context, projectID string) (*Project, error) {
	docSnap, err := s.genericStore.GetDoc(ctx, projectID)
	if err != nil {
		return nil, err
	}

	var p Project
	if err := docSnap.DataTo(&p); err != nil {
		return nil, err
	}

	p.ProjectID = docSnap.Ref.ID
	return &p, nil
}
