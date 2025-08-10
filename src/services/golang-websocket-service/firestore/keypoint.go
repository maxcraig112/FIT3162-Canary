package firestore

import (
	"context"
	pfs "pkg/gcp/firestore"

	cfs "cloud.google.com/go/firestore"
)

const (
	keypointsCollectionID = "keypoints"
)

type KeypointStore struct {
	generic *pfs.GenericStore
}

func NewKeypointStore(client pfs.FirestoreClientInterface) *KeypointStore {
	return &KeypointStore{generic: pfs.NewGenericStore(client, keypointsCollectionID)}
}

// WatchByImagesID listens for realtime updates to keypoints documents matching a specific imageID.
// Returns a stop function to cancel the watch.
func (s *KeypointStore) WatchByImagesID(ctx context.Context, imageID string, onSnapshot func([]*cfs.DocumentSnapshot)) (func(), error) {
	query := []pfs.QueryParameter{{Path: "imageID", Op: "==", Value: imageID}}
	return s.generic.WatchCollection(ctx, query, func(docs []*cfs.DocumentSnapshot) {
		onSnapshot(docs)
	})
}
