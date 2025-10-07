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

func (s *BoundingBoxLabelStore) CreateBoundingBoxLabel(ctx context.Context, req CreateBoundingBoxLabelRequest) (string, error) {
	boundingBoxLabel := BoundingBoxLabel{
		BoundingBoxLabel: req.BoundingBoxLabel,
		ProjectID:        req.ProjectID,
	}

	qp := []fs.QueryParameter{
		{Path: "boundingBoxLabel", Op: "==", Value: req.BoundingBoxLabel},
		{Path: "projectID", Op: "==", Value: req.ProjectID},
	}

	docs, err := s.genericStore.ReadCollection(ctx, qp)
	if err != nil {
		return "", err
	}
	if len(docs) > 0 {
		return "", fs.ErrAlreadyExists
	}

	return s.genericStore.CreateDoc(ctx, boundingBoxLabel)
}

func (s *BoundingBoxLabelStore) DeleteBoundingBoxLabel(ctx context.Context, boundingBoxLabelID string) error {
	return s.genericStore.DeleteDoc(ctx, boundingBoxLabelID)
}

func (s *BoundingBoxLabelStore) UpdateBoundingBoxLabelName(ctx context.Context, req UpdateBoundingBoxLabelRequest) error {

	bbl, err := s.GetBoundingBoxLabel(ctx, req.BoundingBoxLabelID)
	if err == fs.ErrNotFound {
		return fs.ErrNotFound
	}

	qp := []fs.QueryParameter{
		{Path: "boundingBoxLabel", Op: "==", Value: req.BoundingBoxLabel},
		{Path: "projectID", Op: "==", Value: bbl.ProjectID},
	}

	docs, err := s.genericStore.ReadCollection(ctx, qp)
	if err != nil {
		return err
	}
	if len(docs) > 0 {
		return fs.ErrAlreadyExists
	}

	updateParams := []firestore.Update{
		{Path: "keypointLabel", Value: req.BoundingBoxLabel},
	}

	return s.genericStore.UpdateDoc(ctx, req.BoundingBoxLabelID, updateParams)
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
