package firestore

import (
	"context"

	fs "pkg/gcp/firestore"

	"cloud.google.com/go/firestore"
)

const (
	boundingBoxLabelCollectionID = "boundingBoxLabels"
)

type BoundingBoxLabel struct {
	BoundingBoxLabelID string `firestore:"boundingBoxLabelID,omitempty" json:"boundingBoxLabelID"`
	BoundingBoxLabel   string `firestore:"boundingBoxLabel,omitempty" json:"boundingBoxLabel"`
	ProjectID          string `firestore:"projectID,omitempty" json:"projectID"`
}

type CreateBoundingBoxLabelRequest struct {
	BoundingBoxLabel string `json:"boundingBoxLabel"`
	ProjectID        string `json:"projectID"`
}

type UpdateBoundingBoxLabelRequest struct {
	BoundingBoxLabelID string `json:"boundingBoxLabelID"`
	BoundingBoxLabel   string `json:"boundingBoxLabel"`
}

type BoundingBoxLabelStore struct {
	genericStore *fs.GenericStore
}

func NewBoundingBoxLabelStore(client fs.FirestoreClientInterface) *BoundingBoxLabelStore {
	return &BoundingBoxLabelStore{genericStore: fs.NewGenericStore(client, boundingBoxLabelCollectionID)}
}

func (s *BoundingBoxLabelStore) GetBoundingBoxLabelsByProjectID(ctx context.Context, projectID string) ([]BoundingBoxLabel, error) {

	queryParams := []fs.QueryParameter{
		{Path: "projectID", Op: "==", Value: projectID},
	}
 	docs, err := s.genericStore.ReadCollection(ctx, queryParams)
	if err != nil {
		return nil, err
	}

	boundingBoxLabels := make([]BoundingBoxLabel, 0, len(docs))
	for _, doc := range docs {
		var bl BoundingBoxLabel
		if err := doc.DataTo(&bl); err != nil {
			return nil, err
		}
		bl.BoundingBoxLabelID = doc.Ref.ID
		boundingBoxLabels = append(boundingBoxLabels, bl)
	}
	return boundingBoxLabels, nil
}

func (s *BoundingBoxLabelStore) CreateBoundingBoxLabel(ctx context.Context, createBoundingBoxLabelReq CreateBoundingBoxLabelRequest) (string, error) {
	boundingBoxLabel := BoundingBoxLabel{
		BoundingBoxLabel: createBoundingBoxLabelReq.BoundingBoxLabel,
		ProjectID:        createBoundingBoxLabelReq.ProjectID,
	}

	return s.genericStore.CreateDoc(ctx, boundingBoxLabel)
}

func (s *BoundingBoxLabelStore) DeleteBoundingBoxLabel(ctx context.Context, boundingBoxLabelID string) error {
	return s.genericStore.DeleteDoc(ctx, boundingBoxLabelID)
}

func (s *BoundingBoxLabelStore) UpdateBoundingBoxLabelName(ctx context.Context, updateBoundingBoxLabelReq UpdateBoundingBoxLabelRequest) error {
	updateParams := []firestore.Update{
		{Path: "boundingBoxLabel", Value: updateBoundingBoxLabelReq.BoundingBoxLabel},
	}

	return s.genericStore.UpdateDoc(ctx, updateBoundingBoxLabelReq.BoundingBoxLabelID, updateParams)
}

func (s *BoundingBoxLabelStore) GetBoundingBoxLabel(ctx context.Context, boundingBoxLabelID string) (BoundingBoxLabel, error) {
	docSnap, err := s.genericStore.GetDoc(ctx, boundingBoxLabelID)
	if err != nil {
		return BoundingBoxLabel{}, err
	}
	var bl BoundingBoxLabel
	err = docSnap.DataTo(&bl)
	if err != nil {
		return BoundingBoxLabel{}, err
	}
	bl.BoundingBoxLabelID = docSnap.Ref.ID
	return bl, nil
}
