package firestore

import (
	"context"
	"fmt"
	"time"

	fs "pkg/gcp/firestore"

	"cloud.google.com/go/firestore"
)

const (
	projectCollectionID = "projects"
)

type Project struct {
	ProjectID     string          `firestore:"projectID,omitempty" json:"projectID"`
	ProjectName   string          `firestore:"projectName,omitempty" json:"projectName"`
	UserID        string          `firestore:"userID,omitempty" json:"userID"`
	NumberOfFiles int             `firestore:"numberOfFiles,omitempty" json:"numberOfFiles"`
	LastUpdated   time.Time       `firestore:"lastUpdated,omitempty" json:"lastUpdated"`
	Settings      ProjectSettings `firestore:"settings,omitempty" json:"settings"`
}

type ProjectSettings struct {
	TagLabels TagLabels `firestore:"tagLabels,omitempty" json:"tagLabels"`
}

type TagLabels struct {
	KeyPoints     []string `firestore:"keyPoints,omitempty" json:"keyPoints"`
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

func (s *ProjectStore) CreateProject(ctx context.Context, createProjectReq CreateProjectRequest) (string, error) {
	project := Project{
		ProjectName:   createProjectReq.ProjectName,
		UserID:        createProjectReq.UserID,
		NumberOfFiles: 0,
		LastUpdated:   time.Now(),
	}

	return s.genericStore.CreateDoc(ctx, project)

}

func (s *ProjectStore) RenameProject(ctx context.Context, projectID string, renameProjectReq RenameProjectRequest) error {
	updateParams := []firestore.Update{
		{Path: "projectName", Value: renameProjectReq.NewProjectName},
		{Path: "lastUpdated", Value: time.Now()},
	}

	return s.genericStore.UpdateField(ctx, projectID, updateParams)
}

func (s *ProjectStore) DeleteProject(ctx context.Context, projectID string) error {
	return s.genericStore.DeleteDoc(ctx, projectID)
}

func (s *ProjectStore) IncrementNumberOfFiles(ctx context.Context, projectID string, req IncrementQuantityRequest) (int64, error) {
	docSnap, err := s.genericStore.GetDoc(ctx, projectID)
	if err != nil {
		return 0, err
	}
	currentVal, err := docSnap.DataAt("numberOfFiles")
	if err != nil {
		return 0, err
	}
	currentInt, ok := currentVal.(int64)
	if !ok {
		return 0, fmt.Errorf("invalid type for numberOfFiles")
	}

	newVal := currentInt + int64(req.Quantity)
	if newVal < 0 {
		newVal = 0
	}
	err = s.genericStore.UpdateField(ctx, projectID, []firestore.Update{{Path: "numberOfFiles", Value: newVal}})
	return newVal, err
}

func (s *ProjectStore) UpdateProjectSettings(ctx context.Context, projectID string, req ProjectSettings) (*ProjectSettings, error) {
	updateParams := []firestore.Update{
		{Path: "settings.tagLabels.keyPoints", Value: req.TagLabels.KeyPoints},
		{Path: "settings.tagLabels.boundingBoxes", Value: req.TagLabels.BoundingBoxes},
	}

	err := s.genericStore.UpdateField(ctx, projectID, updateParams)
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
