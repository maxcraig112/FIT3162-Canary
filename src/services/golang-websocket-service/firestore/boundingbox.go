package firestore

import (
	"context"
	pfs "pkg/gcp/firestore"

	cfs "cloud.google.com/go/firestore"
)

const (
	boundingBoxesCollectionID = "boundingBoxes"
)

type BoundingBoxStore struct {
	generic *pfs.GenericStore
}

func NewBoundingBoxStore(client pfs.FirestoreClientInterface) *BoundingBoxStore {
	return &BoundingBoxStore{generic: pfs.NewGenericStore(client, boundingBoxesCollectionID)}
}

// WatchByImagesID listens for realtime updates to boundingBoxes documents matching a specific imageID.
// Returns a stop function to cancel the watch.
func (s *BoundingBoxStore) WatchByImagesID(ctx context.Context, imageID string, onSnapshot func([]*cfs.DocumentSnapshot)) (func(), error) {
	query := []pfs.QueryParameter{{Path: "imageID", Op: "==", Value: imageID}}
	return s.generic.WatchCollection(ctx, query, func(docs []*cfs.DocumentSnapshot) {
		onSnapshot(docs)
	})
}
