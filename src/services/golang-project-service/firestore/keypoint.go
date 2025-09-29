package firestore

import (
	"context"

	fs "pkg/gcp/firestore"

	"cloud.google.com/go/firestore"
)

const keypointCollectionID = "keypoints"

// Firestore document model
type Keypoint struct {
	KeypointID      string `firestore:"keypointID,omitempty" json:"keypointID"`
	ImageID         string `firestore:"imageID,omitempty" json:"imageID"`
	Position        Point  `firestore:"position,omitempty" json:"position"`
	BoundingBoxID   string `firestore:"boundingBoxID,omitempty" json:"boundingBoxID"`
	KeypointLabelID string `firestore:"keypointLabelID,omitempty" json:"keypointLabelID"`
}

type KeypointPtr struct {
	ImageID         *string `firestore:"imageID" json:"imageID"`
	Position        *Point  `firestore:"position" json:"position"`
	BoundingBoxID   *string `firestore:"boundingBoxID" json:"boundingBoxID"`
	KeypointLabelID *string `firestore:"keypointLabelID" json:"keypointLabelID"`
}

type Point struct {
	X float64 `firestore:"x" json:"x"`
	Y float64 `firestore:"y" json:"y"`
}

// Request/response payloads
type CreateKeypointRequest struct {
	ImageID         string `json:"imageID"`
	Position        Point  `json:"position"`
	KeypointLabelID string `json:"keypointLabelID"`
	BoundingBoxID   string `json:"boundingBoxID"`
}

type UpdateKeypointRequest struct {
	KeypointID      string `json:"keypointID"`
	KeypointLabelID string `json:"keypointLabelID"`
	Position        *Point `json:"position"`
}

// Store wrapper
type KeypointStore struct {
	genericStore *fs.GenericStore
}

func NewKeypointStore(client fs.FirestoreClientInterface) *KeypointStore {
	return &KeypointStore{
		genericStore: fs.NewGenericStore(client, keypointCollectionID),
	}
}

// CRUD operations
func (s *KeypointStore) CreateKeypoint(ctx context.Context, req CreateKeypointRequest) (string, error) {
	qp := []fs.QueryParameter{
		{Path: "keypointLabelID", Op: "==", Value: req.KeypointLabelID},
		{Path: "imageID", Op: "==", Value: req.ImageID},
	}

	if req.BoundingBoxID != "" {
		qp = append(qp, fs.QueryParameter{Path: "boundingBoxID", Op: "==", Value: req.BoundingBoxID})
	} else {
		qp = append(qp, fs.QueryParameter{Path: "boundingBoxID", Op: "==", Value: nil})
	}

	docs, err := s.genericStore.ReadCollection(ctx, qp)
	if err != nil {
		return "", err
	}
	if len(docs) > 0 {
		return "", fs.ErrAlreadyExists
	}

	// convert request values into pointers (nil if missing/empty)
	var imageIDPtr *string
	if req.ImageID != "" {
		imageIDPtr = &req.ImageID
	}

	var keypointLabelIDPtr *string
	if req.KeypointLabelID != "" {
		keypointLabelIDPtr = &req.KeypointLabelID
	}

	var boundingBoxIDPtr *string
	if req.BoundingBoxID != "" {
		boundingBoxIDPtr = &req.BoundingBoxID
	}

	var positionPtr *Point
	if req.Position != (Point{}) { // assumes Point is comparable
		positionPtr = &req.Position
	}

	kp := KeypointPtr{
		ImageID:         imageIDPtr,
		Position:        positionPtr,
		KeypointLabelID: keypointLabelIDPtr,
		BoundingBoxID:   boundingBoxIDPtr,
	}

	return s.genericStore.CreateDoc(ctx, kp)
}

func (s *KeypointStore) GetKeypointsByImageID(ctx context.Context, imageID string) ([]Keypoint, error) {
	qp := []fs.QueryParameter{{Path: "imageID", Op: "==", Value: imageID}}
	docs, err := s.genericStore.ReadCollection(ctx, qp)

	if err == fs.ErrNotFound {
		return []Keypoint{}, nil
	}

	if err != nil {
		return nil, err
	}

	out := make([]Keypoint, 0, len(docs))
	for _, d := range docs {
		var k Keypoint
		if err := d.DataTo(&k); err != nil {
			return nil, err
		}
		k.KeypointID = d.Ref.ID
		out = append(out, k)
	}
	return out, nil
}

func (s *KeypointStore) GetKeypointsByBoundingBoxID(ctx context.Context, boundingBoxID string) ([]Keypoint, error) {
	qp := []fs.QueryParameter{{Path: "boundingBoxID", Op: "==", Value: boundingBoxID}}
	docs, err := s.genericStore.ReadCollection(ctx, qp)

	if err == fs.ErrNotFound {
		return []Keypoint{}, nil
	}

	if err != nil {
		return nil, err
	}

	out := make([]Keypoint, 0, len(docs))
	for _, d := range docs {
		var k Keypoint
		if err := d.DataTo(&k); err != nil {
			return nil, err
		}
		k.KeypointID = d.Ref.ID
		out = append(out, k)
	}
	return out, nil
}

func (s *KeypointStore) GetKeypoint(ctx context.Context, keypointID string) (*Keypoint, error) {
	doc, err := s.genericStore.GetDoc(ctx, keypointID)
	if err != nil {
		return nil, err
	}
	var k Keypoint
	if err := doc.DataTo(&k); err != nil {
		return nil, err
	}
	k.KeypointID = doc.Ref.ID
	return &k, nil
}

func (s *KeypointStore) UpdateKeypoint(ctx context.Context, req UpdateKeypointRequest) error {
	kp, err := s.GetKeypoint(ctx, req.KeypointID)
	if err == fs.ErrNotFound {
		return fs.ErrNotFound
	}

	qp := []fs.QueryParameter{
		{Path: "keypointLabelID", Op: "==", Value: req.KeypointLabelID},
		{Path: "imageID", Op: "==", Value: kp.ImageID},
	}

	if kp.BoundingBoxID != "" {
		qp = append(qp, fs.QueryParameter{Path: "boundingBoxID", Op: "==", Value: kp.BoundingBoxID})
	} else {
		qp = append(qp, fs.QueryParameter{Path: "boundingBoxID", Op: "==", Value: nil})
	}

	docs, err := s.genericStore.ReadCollection(ctx, qp)
	if err != nil {
		return err
	}
	if len(docs) > 0 {
		return fs.ErrAlreadyExists
	}
	updates := []firestore.Update{}

	if req.KeypointLabelID != "" {
		updates = append(updates, firestore.Update{Path: "keypointLabelID", Value: req.KeypointLabelID})
	}
	if req.Position != nil {
		updates = append(updates, firestore.Update{Path: "position", Value: req.Position})
	}

	return s.genericStore.UpdateDoc(ctx, req.KeypointID, updates)
}

func (s *KeypointStore) DeleteKeypoint(ctx context.Context, keypointID string) error {
	return s.genericStore.DeleteDoc(ctx, keypointID)
}

// Delete all keypoints associated with a given imageID
func (s *KeypointStore) DeleteKeypointsByImageID(ctx context.Context, imageID string) error {
	qp := []fs.QueryParameter{{Path: "imageID", Op: "==", Value: imageID}}
	err := s.genericStore.DeleteDocsByQuery(ctx, qp)
	if err != fs.ErrNotFound {
		return err
	}
	return nil
}

// Delete all keypoints associated with any of the provided imageIDs
func (s *KeypointStore) DeleteKeypointsByImageIDs(ctx context.Context, imageIDs []string) error {
	for _, id := range imageIDs {
		if err := s.DeleteKeypointsByImageID(ctx, id); err != nil {
			return err
		}
	}
	return nil
}
