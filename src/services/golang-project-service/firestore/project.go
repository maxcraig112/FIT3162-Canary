package firestore

import (
	"context"
	"time"

	fs "pkg/gcp/firestore"

	"cloud.google.com/go/firestore"
)

const (
	projectCollectionID = "projects"
)

type Project struct {
	ProjectID       string          `firestore:"projectID,omitempty" json:"projectID"`
	ProjectName     string          `firestore:"projectName,omitempty" json:"projectName"`
	UserID          string          `firestore:"userID,omitempty" json:"userID"`
	NumberOfBatches int64           `firestore:"numberOfBatches,omitempty" json:"numberOfBatches"`
	LastUpdated     time.Time       `firestore:"lastUpdated,omitempty" json:"lastUpdated"`
	Settings        ProjectSettings `firestore:"settings,omitempty" json:"settings"`
}

type ProjectSettings struct {
	TagLabels TagLabels `firestore:"tagLabels,omitempty" json:"tagLabels"`
}

type TagLabels struct {
	Keypoints     []string `firestore:"keyPoints,omitempty" json:"keyPoints"`
	BoundingBoxes []string `firestore:"boundingBoxes,omitempty" json:"boundingBoxes"`
}

type CreateProjectRequest struct {
	UserID      string `json:"userID"`
	ProjectName string `json:"projectName"`
}

type RenameProjectRequest struct {
	NewProjectName string `json:"newProjectName"`
}

type IncrementQuantityRequest struct {
	Quantity int `json:"quantity"`
}

type ProjectStore struct {
	genericStore *fs.GenericStore
}

func NewProjectStore(client fs.FirestoreClientInterface) *ProjectStore {
	return &ProjectStore{genericStore: fs.NewGenericStore(client, projectCollectionID)}
}

func (s *ProjectStore) GetProjectsByUserID(ctx context.Context, userID string) ([]Project, error) {

	queryParams := []fs.QueryParameter{
		{Path: "userID", Op: "==", Value: userID},
	}
	docs, err := s.genericStore.ReadCollection(ctx, queryParams)
	if err != nil {
		if fs.ErrNotFound == err {
			return []Project{}, nil
		}
		return nil, err
	}

	projects := make([]Project, 0, len(docs))
	for _, doc := range docs {
		var p Project
		if err := doc.DataTo(&p); err != nil {
			return nil, err
		}
		p.ProjectID = doc.Ref.ID
		projects = append(projects, p)
	}
	return projects, nil
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

func (s *ProjectStore) CreateProject(ctx context.Context, createProjectReq CreateProjectRequest) (string, error) {
	project := Project{
		ProjectName: createProjectReq.ProjectName,
		UserID:      createProjectReq.UserID,
		LastUpdated: time.Now(),
	}

	return s.genericStore.CreateDoc(ctx, project)

}

func (s *ProjectStore) RenameProject(ctx context.Context, projectID string, renameProjectReq RenameProjectRequest) error {
	updateParams := []firestore.Update{
		{Path: "projectName", Value: renameProjectReq.NewProjectName},
		{Path: "lastUpdated", Value: time.Now()},
	}

	return s.genericStore.UpdateDoc(ctx, projectID, updateParams)
}

func (s *ProjectStore) DeleteProject(ctx context.Context, projectID string) error {
	return s.genericStore.DeleteDoc(ctx, projectID)
}

func (s *ProjectStore) UpdateProjectSettings(ctx context.Context, projectID string, req ProjectSettings) (*ProjectSettings, error) {
	updateParams := []firestore.Update{
		{Path: "settings.tagLabels.keyPoints", Value: req.TagLabels.Keypoints},
		{Path: "settings.tagLabels.boundingBoxes", Value: req.TagLabels.BoundingBoxes},
	}

	err := s.genericStore.UpdateDoc(ctx, projectID, updateParams)
	if err != nil {
		return nil, err
	}

	docSnap, err := s.genericStore.GetDoc(ctx, projectID)
	if err != nil {
		return nil, err
	}

	var p Project
	err = docSnap.DataTo(&p)
	if err != nil {
		return nil, err
	}

	return &p.Settings, nil
}
