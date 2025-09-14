package firestore

import (
	"context"
	"time"

	fs "pkg/gcp/firestore"

	"errors"

	"cloud.google.com/go/firestore"
)

var ErrSameBatchName = errors.New("new batch name is the same as the current one")
var ErrBatchNotFound = errors.New("batch not found")

const (
	batchCollectionID = "batches"
)

type Batch struct {
	BatchID            string `firestore:"batchID,omitempty" json:"batchID"`
	BatchName          string `firestore:"batchName,omitempty" json:"batchName"`
	ProjectID          string `firestore:"projectID,omitempty" json:"projectID"`
	NumberOfTotalFiles int64  `firestore:"numberOfTotalFiles,omitempty" json:"numberOfTotalFiles"`
	IsComplete         bool   `firestore:"isComplete,omitempty" json:"isComplete"`
}

type CreateBatchRequest struct {
	ProjectID string `json:"projectID"`
	BatchName string `json:"batchName"`
}

type UpdateIsCompleteRequest struct {
	IsComplete bool `json:"isComplete"`
}

type RenameBatchRequest struct {
	NewBatchName string `json:"newBatchName"`
}

type BatchStore struct {
	genericStore *fs.GenericStore
}

func NewBatchStore(client fs.FirestoreClientInterface) *BatchStore {
	return &BatchStore{genericStore: fs.NewGenericStore(client, batchCollectionID)}
}

func (s *BatchStore) GetBatchesByProjectID(ctx context.Context, projectID string) ([]Batch, error) {
	queryParams := []fs.QueryParameter{
		{Path: "projectID", Op: "==", Value: projectID},
	}
	docs, err := s.genericStore.ReadCollection(ctx, queryParams)
	if err == fs.ErrNotFound {
		return []Batch{}, nil
	}
	if err != nil {
		return nil, err
	}

	batches := make([]Batch, 0, len(docs))
	for _, doc := range docs {
		var p Batch
		if err := doc.DataTo(&p); err != nil {
			return nil, err
		}
		p.BatchID = doc.Ref.ID
		batches = append(batches, p)
	}
	return batches, nil
}

func (s *BatchStore) GetTotalBatchCountByProjectID(ctx context.Context, projectID string) (int64, error) {
	queryParams := []fs.QueryParameter{
		{Path: "projectID", Op: "==", Value: projectID},
	}
	return s.genericStore.GetAggregationWithQuery(ctx, queryParams, fs.Count)
}

func (s *BatchStore) CreateBatch(ctx context.Context, createBatchReq CreateBatchRequest) (string, error) {
	batchData := map[string]interface{}{
		"batchName":   createBatchReq.BatchName,
		"projectID":   createBatchReq.ProjectID,
		"lastUpdated": time.Now(),
		"isComplete":  false,
	}

	return s.genericStore.CreateDoc(ctx, batchData)

}

func (s *BatchStore) RenameBatch(ctx context.Context, batchID string, renameBatchReq RenameBatchRequest) error {
	updateParams := []firestore.Update{
		{Path: "batchName", Value: renameBatchReq.NewBatchName},
		{Path: "lastUpdated", Value: time.Now()},
	}

	return s.genericStore.UpdateDoc(ctx, batchID, updateParams)
}

func (s *BatchStore) UpdateIsComplete(ctx context.Context, batchID string, isCompleteReq UpdateIsCompleteRequest) error {
	updateParams := []firestore.Update{
		{Path: "isComplete", Value: isCompleteReq.IsComplete},
	}

	return s.genericStore.UpdateDoc(ctx, batchID, updateParams)
}

func (s *BatchStore) DeleteBatch(ctx context.Context, batchID string) error {
	return s.genericStore.DeleteDoc(ctx, batchID)
}

func (s *BatchStore) DeleteAllBatches(ctx context.Context, projectID string) error {
	queryParams := []fs.QueryParameter{
		{Path: "projectID", Op: "==", Value: projectID},
	}
	err := s.genericStore.DeleteDocsByQuery(ctx, queryParams)
	if err != nil && err != fs.ErrNotFound {
		return err
	}
	return nil
}

func (s *BatchStore) GetBatch(ctx context.Context, batchID string) (*Batch, error) {
	docSnap, err := s.genericStore.GetDoc(ctx, batchID)
	if err != nil {
		return nil, err
	}

	var b Batch
	if err := docSnap.DataTo(&b); err != nil {
		return nil, err
	}

	b.BatchID = docSnap.Ref.ID
	return &b, nil
}

// Helper to list batch IDs by project (used by cascading operations)
func (s *BatchStore) ListBatchIDsByProjectID(ctx context.Context, projectID string) ([]string, error) {
	batches, err := s.GetBatchesByProjectID(ctx, projectID)
	if err != nil {
		return nil, err
	}
	ids := make([]string, 0, len(batches))
	for _, b := range batches {
		ids = append(ids, b.BatchID)
	}
	return ids, nil
}
