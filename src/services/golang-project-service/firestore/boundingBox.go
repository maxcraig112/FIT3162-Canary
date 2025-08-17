package firestore

import (
	"context"

	fs "pkg/gcp/firestore"

	"cloud.google.com/go/firestore"
)

const boundingBoxCollectionID = "boundingBoxes"

// Firestore document model
type BoundingBox struct {
	BoundingBoxID      string `firestore:"boundingBoxID,omitempty" json:"boundingBoxID"`
	ImageID            string `firestore:"imageID,omitempty" json:"imageID"`
	Box                Rect   `firestore:"box,omitempty" json:"box"`
	BoundingBoxLabelID string `firestore:"boundingBoxLabelID,omitempty" json:"boundingBoxLabelID"`
}

type Rect struct {
	X      float64 `firestore:"x" json:"x"`
	Y      float64 `firestore:"y" json:"y"`
	Width  float64 `firestore:"width" json:"width"`
	Height float64 `firestore:"height" json:"height"`
}

// Request/response payloads
type CreateBoundingBoxRequest struct {
	ImageID            string `json:"imageID"`
	Box                Rect   `json:"box"`
	BoundingBoxLabelID string `json:"boundingBoxLabelID"`
}

type UpdateBoundingBoxPositionRequest struct {
	BoundingBoxID      string `json:"boundingBoxID"`
	Box                Rect   `json:"box"`
	BoundingBoxLabelID string `json:"boundingBoxLabelID"`
}

// Store wrapper
type BoundingBoxStore struct {
	genericStore *fs.GenericStore
}

func NewBoundingBoxStore(client fs.FirestoreClientInterface) *BoundingBoxStore {
	return &BoundingBoxStore{
		genericStore: fs.NewGenericStore(client, boundingBoxCollectionID),
	}
}

// CRUD operations
func (s *BoundingBoxStore) CreateBoundingBox(ctx context.Context, req CreateBoundingBoxRequest) (string, error) {
	bb := BoundingBox{
		ImageID:            req.ImageID,
		Box:                req.Box,
		BoundingBoxLabelID: req.BoundingBoxLabelID,
	}
	return s.genericStore.CreateDoc(ctx, bb)
}

func (s *BoundingBoxStore) GetBoundingBoxesByImageID(ctx context.Context, imageID string) ([]BoundingBox, error) {
	qp := []fs.QueryParameter{{Path: "imageID", Op: "==", Value: imageID}}
	docs, err := s.genericStore.ReadCollection(ctx, qp)

	if err == fs.ErrNotFound {
		return []BoundingBox{}, nil
	}

	if err != nil {
		return nil, err
	}

	out := make([]BoundingBox, 0, len(docs))
	for _, d := range docs {
		var bb BoundingBox
		if err := d.DataTo(&bb); err != nil {
			return nil, err
		}
		bb.BoundingBoxID = d.Ref.ID
		out = append(out, bb)
	}
	return out, nil
}

func (s *BoundingBoxStore) GetBoundingBox(ctx context.Context, boundingBoxID string) (*BoundingBox, error) {
	doc, err := s.genericStore.GetDoc(ctx, boundingBoxID)
	if err != nil {
		return nil, err
	}
	var bb BoundingBox
	if err := doc.DataTo(&bb); err != nil {
		return nil, err
	}
	bb.BoundingBoxID = doc.Ref.ID
	return &bb, nil
}

func (s *BoundingBoxStore) UpdateBoundingBoxPosition(ctx context.Context, req UpdateBoundingBoxPositionRequest) error {
	updates := []firestore.Update{
		{Path: "box", Value: req.Box},
		{Path: "boundingBoxLabelID", Value: req.BoundingBoxLabelID},
	}

	return s.genericStore.UpdateDoc(ctx, req.BoundingBoxID, updates)
}

func (s *BoundingBoxStore) DeleteBoundingBox(ctx context.Context, boundingBoxID string) error {
	return s.genericStore.DeleteDoc(ctx, boundingBoxID)
}
