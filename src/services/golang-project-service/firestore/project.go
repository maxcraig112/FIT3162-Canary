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
	ProjectID   string `firestore:"projectID,omitempty" json:"projectID"`
	UserID      string `firestore:"userID,omitempty" json:"userID"`
	ProjectName string `firestore:"projectName,omitempty" json:"projectName"`
}

type CreateProjectRequest struct {
	UserID      string `json:"userID"`
	ProjectName string `json:"projectName"`
}

type RenameProjectRequest struct {
	NewProjectName string `json:"newProjectName"`
}

type ProjectStore struct {
	projects *firestore.CollectionRef
}

func NewProjectStore(client fs.FirestoreClientInterface) *ProjectStore {
	return &ProjectStore{projects: client.GetCollection(projectCollectionID)}
}

func (s *ProjectStore) GetProjectsByUserID(ctx context.Context, userID string) ([]Project, error) {
	iter := s.projects.Where("userID", "==", userID).Documents(ctx)
	docs, err := iter.GetAll()
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
		"projectName": createProjectReq.ProjectName,
		"userID":      createProjectReq.UserID,
		"lastOpened":  time.Now(),
	}
	docRef, _, err := s.projects.Add(ctx, projectData)
	if err != nil {
		return "", err
	}
	return docRef.ID, nil
}

func (s *ProjectStore) RenameProject(ctx context.Context, docID string, renameProjectReq RenameProjectRequest) error {
	docRef := s.projects.Doc(docID)

	docSnap, err := docRef.Get(ctx)
	if err != nil {
		if status.Code(err) == codes.NotFound {
			return fmt.Errorf("%w: %s", ErrProjectNotFound, docID)
		}
		return err
	}

	currentName, err := docSnap.DataAt("projectName")
	if err != nil {
		return err
	}
	if currentName == renameProjectReq.NewProjectName {
		return ErrSameProjectName
	}

	_, err = docRef.Update(ctx, []firestore.Update{
		{Path: "projectName", Value: renameProjectReq.NewProjectName},
	})
	return err
}

func (s *ProjectStore) DeleteProject(ctx context.Context, docID string) error {
	docRef := s.projects.Doc(docID)

	_, err := docRef.Get(ctx)
	if err != nil {
		if status.Code(err) == codes.NotFound {
			return fmt.Errorf("%w: %s", ErrProjectNotFound, docID)
		}
		return err
	}

	_, err = docRef.Delete(ctx)
	return err
}
