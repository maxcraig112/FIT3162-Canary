package firestore

import (
	"context"

	fs "pkg/gcp/firestore"

	"cloud.google.com/go/firestore"
)

const (
	keypointLabelCollectionID = "keypointLabels"
)

// type Project struct {
// 	ProjectID     string          `firestore:"projectID,omitempty" json:"projectID"`
// 	ProjectName   string          `firestore:"projectName,omitempty" json:"projectName"`
// 	UserID        string          `firestore:"userID,omitempty" json:"userID"`
// 	NumberOfFiles int             `firestore:"numberOfFiles,omitempty" json:"numberOfFiles"`
// 	LastUpdated   time.Time       `firestore:"lastUpdated,omitempty" json:"lastUpdated"`
// 	Settings      ProjectSettings `firestore:"settings,omitempty" json:"settings"`
// }

type KeypointLabel struct {
	KeyPointLabelID string `firestore:"keyPointLabelID,omitempty" json:"keyPointLabelID"`
	KeypointLabel   string `firestore:"keypointLabel,omitempty" json:"keypointLabel"`
	ProjectID       string `firestore:"projectID,omitempty" json:"projectID"`
}

type CreateKeypointLabelRequest struct {
	KeypointLabel string `json:"keypointLabel"`
	ProjectID     string `json:"projectID"`
}

type GetKeypointLabelRequest struct {
	KeyPointLabelID string `json:"keyPointLabelID"`
}

type UpdateKeypointLabelRequest struct {
	KeyPointLabelID string `json:"keyPointLabelID"`
	KeypointLabel   string `json:"keypointLabel"`
}

type DeleteKeypointLabelRequest struct {
	KeyPointLabelID string `json:"keyPointLabelID"`
}

type KeypointLabelStore struct {
	genericStore *fs.GenericStore
}

func NewKeypointLabelStore(client fs.FirestoreClientInterface) *KeypointLabelStore {
	return &KeypointLabelStore{genericStore: fs.NewGenericStore(client, keypointLabelCollectionID)}
}

func (s *KeypointLabelStore) GetProjectsByUserID(ctx context.Context, userID string) ([]Project, error) {

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

func (s *KeypointLabelStore) CreateKeypointLabel(ctx context.Context, createKeypointLabelReq CreateKeypointLabelRequest) (string, error) {
	keypointLabel := KeypointLabel{
		KeypointLabel: createKeypointLabelReq.KeypointLabel,
		ProjectID:     createKeypointLabelReq.ProjectID,
	}

	return s.genericStore.CreateDoc(ctx, keypointLabel)
}

func (s *KeypointLabelStore) DeleteKeypointLabel(ctx context.Context, deleteKeypointLabelReq DeleteKeypointLabelRequest) error {
	return s.genericStore.DeleteDoc(ctx, deleteKeypointLabelReq.KeyPointLabelID)
}

func (s *KeypointLabelStore) UpdateKeypointLabelName(ctx context.Context, updateKeypointLabelReq UpdateKeypointLabelRequest) error {
	updateParams := []firestore.Update{
		{Path: "keypointLabel", Value: updateKeypointLabelReq.KeypointLabel},
	}

	return s.genericStore.UpdateField(ctx, updateKeypointLabelReq.KeyPointLabelID, updateParams)
}

func (s *KeypointLabelStore) GetKeypointLabel(ctx context.Context, getKeypointLabelRequest GetKeypointLabelRequest) (KeypointLabel, error) {
	docSnap, err := s.genericStore.GetDoc(ctx, getKeypointLabelRequest.KeyPointLabelID)
	if err != nil {
		return KeypointLabel{}, err
	}
	var k KeypointLabel
	err = docSnap.DataTo(&k)
	if err != nil {
		return KeypointLabel{}, err
	}
	k.KeyPointLabelID = docSnap.Ref.ID
	return k, nil
}
