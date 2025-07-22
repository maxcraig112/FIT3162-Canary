package firestore

import (
	"context"
	"fmt"
	"time"

	fs "pkg/gcp/firestore"

	"errors"

	"cloud.google.com/go/firestore"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

var ErrSameProjectName = errors.New("new project name is the same as the current one")
var ErrProjectNotFound = errors.New("project not found")

const (
	projectCollectionID = "projects"
)

type Project struct {
	ProjectID     string    `firestore:"projectID,omitempty" json:"projectID"`
	ProjectName   string    `firestore:"projectName,omitempty" json:"projectName"`
	UserID        string    `firestore:"userID,omitempty" json:"userID"`
	NumberOfFiles int       `firestore:"numberOfFiles,omitempty" json:"numberOfFiles"`
	LastUpdated   time.Time `firestore:"lastUpdated,omitempty" json:"lastUpdated"`
}

type CreateProjectRequest struct {
	UserID      string `json:"userID"`
	ProjectName string `json:"projectName"`
}

type RenameProjectRequest struct {
	NewProjectName string `json:"newProjectName"`
}

type UpdateNumberOfFilesRequest struct {
	Quantity int `json:"quantity"`
}

type ProjectStore struct {
	projects *firestore.CollectionRef
}

func NewProjectStore(client fs.FirestoreClientInterface) *ProjectStore {
	return &ProjectStore{projects: client.GetCollection(projectCollectionID)}
}

func (s *ProjectStore) getDoc(ctx context.Context, projectID string) (*firestore.DocumentRef, *firestore.DocumentSnapshot, error) {
	docRef := s.projects.Doc(projectID)
	docSnap, err := docRef.Get(ctx)
	if err != nil {
		if status.Code(err) == codes.NotFound {
			return nil, nil, fmt.Errorf("%w: %s", ErrProjectNotFound, projectID)
		}
		return nil, nil, err
	}
	return docRef, docSnap, nil
}

func (s *ProjectStore) GetProjectsByUserID(ctx context.Context, userID string) ([]Project, error) {
	queryParams := []fs.QueryParameter{
		{Path: "userID", Op: "==", Value: userID},
	}
	genericStore := fs.NewGenericStore(s.projects)
	docs, err := genericStore.ReadCollection(ctx, queryParams)
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
	projectData := map[string]interface{}{
		"projectName":   createProjectReq.ProjectName,
		"userID":        createProjectReq.UserID,
		"numberOfFiles": 0,
		"lastUpdated":   time.Now(),
	}

	genericStore := fs.NewGenericStore(s.projects)
	return genericStore.CreateDoc(ctx, projectData)

}

func (s *ProjectStore) RenameProject(ctx context.Context, projectID string, renameProjectReq RenameProjectRequest) error {
	updateParams := []firestore.Update{
		{Path: "projectName", Value: renameProjectReq.NewProjectName},
		{Path: "lastUpdated", Value: time.Now()},
	}

	genericStore := fs.NewGenericStore(s.projects)
	return genericStore.UpdateField(ctx, projectID, updateParams)
}

func (s *ProjectStore) DeleteProject(ctx context.Context, projectID string) error {
	genericStore := fs.NewGenericStore(s.projects)
	return genericStore.DeleteDoc(ctx, projectID)
}

func (s *ProjectStore) IncrementNumberOfFiles(ctx context.Context, projectID string, req UpdateNumberOfFilesRequest) (int64, error) {
	genericStore := fs.NewGenericStore(s.projects)
	docSnap, err := genericStore.GetDoc(ctx, projectID)
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
	err = genericStore.UpdateField(ctx, projectID, []firestore.Update{{Path: "numberOfFiles", Value: newVal}})
	return newVal, err
}
