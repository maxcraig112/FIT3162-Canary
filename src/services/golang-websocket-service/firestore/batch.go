package firestore

import (
	"context"
	fs "pkg/gcp/firestore"
)

const (
	batchCollectionID = "batches"
)

type Batch struct {
	ProjectID string `firestore:"projectID,omitempty" json:"projectID"`
}

type BatchStore struct {
	genericStore *fs.GenericStore
}

func NewBatchStore(client fs.FirestoreClientInterface) *BatchStore {
	return &BatchStore{genericStore: fs.NewGenericStore(client, batchCollectionID)}
}

func (s *BatchStore) GetProjectIDFromBatchID(ctx context.Context, batchID string) (string, error) {
	doc, err := s.genericStore.GetDoc(ctx, batchID)
	if err != nil {
		return "", err
	}
	var batch Batch
	if err := doc.DataTo(&batch); err != nil {
		return "", err
	}
	return batch.ProjectID, nil
}
