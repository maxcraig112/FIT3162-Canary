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
	KeypointLabelID string `firestore:"keyPointLabelID,omitempty" json:"keyPointLabelID"`
	KeypointLabel   string `firestore:"keypointLabel,omitempty" json:"keypointLabel"`
	ProjectID       string `firestore:"projectID,omitempty" json:"projectID"`
}

type CreateKeypointLabelRequest struct {
	KeypointLabel string `json:"keypointLabel"`
	ProjectID     string `json:"projectID"`
}

type UpdateKeypointLabelRequest struct {
	KeypointLabelID string `json:"keyPointLabelID"`
	KeypointLabel   string `json:"keypointLabel"`
}

type KeypointLabelStore struct {
	genericStore *fs.GenericStore
}

func NewKeypointLabelStore(client fs.FirestoreClientInterface) *KeypointLabelStore {
	return &KeypointLabelStore{genericStore: fs.NewGenericStore(client, keypointLabelCollectionID)}
}

func (s *KeypointLabelStore) GetKeypointLabelsByProjectID(ctx context.Context, projectID string) ([]KeypointLabel, error) {

	queryParams := []fs.QueryParameter{
		{Path: "projectID", Op: "==", Value: projectID},
	}
	docs, err := s.genericStore.ReadCollection(ctx, queryParams)
	if err != nil {
		return nil, err
	}

	keypointLabels := make([]KeypointLabel, 0, len(docs))
	for _, doc := range docs {
		var kp KeypointLabel
		if err := doc.DataTo(&kp); err != nil {
			return nil, err
		}
		kp.KeypointLabelID = doc.Ref.ID
		keypointLabels = append(keypointLabels, kp)
	}
	return keypointLabels, nil
}

func (s *KeypointLabelStore) CreateKeypointLabel(ctx context.Context, createKeypointLabelReq CreateKeypointLabelRequest) (string, error) {
	keypointLabel := KeypointLabel{
		KeypointLabel: createKeypointLabelReq.KeypointLabel,
		ProjectID:     createKeypointLabelReq.ProjectID,
	}

	return s.genericStore.CreateDoc(ctx, keypointLabel)
}

func (s *KeypointLabelStore) DeleteKeypointLabel(ctx context.Context, keypointLabelID string) error {
	return s.genericStore.DeleteDoc(ctx, keypointLabelID)
}

func (s *KeypointLabelStore) UpdateKeypointLabelName(ctx context.Context, updateKeypointLabelReq UpdateKeypointLabelRequest) error {
	updateParams := []firestore.Update{
		{Path: "keypointLabel", Value: updateKeypointLabelReq.KeypointLabel},
	}

	return s.genericStore.UpdateField(ctx, updateKeypointLabelReq.KeypointLabelID, updateParams)
}

func (s *KeypointLabelStore) GetKeypointLabel(ctx context.Context, keypointLabelID string) (KeypointLabel, error) {
	docSnap, err := s.genericStore.GetDoc(ctx, keypointLabelID)
	if err != nil {
		return KeypointLabel{}, err
	}
	var k KeypointLabel
	err = docSnap.DataTo(&k)
	if err != nil {
		return KeypointLabel{}, err
	}
	k.KeypointLabelID = docSnap.Ref.ID
	return k, nil
}
