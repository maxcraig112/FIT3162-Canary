package firestore

import (
	"context"
	"fmt"
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
	BatchID                string `firestore:"batchID,omitempty" json:"batchID"`
	BatchName              string `firestore:"batchName,omitempty" json:"batchName"`
	ProjectID              string `firestore:"projectID,omitempty" json:"projectID"`
	NumberOfTotalFiles     int    `firestore:"numberOfTotalFiles,omitempty" json:"numberOfTotalFiles"`
	NumberOfAnnotatedFiles int    `firestore:"numberOfAnnotatedFiles,omitempty" json:"numberOfAnnotatedFiles"`
}

type CreateBatchRequest struct {
	ProjectID string `json:"projectID"`
	BatchName string `json:"batchName"`
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

func (s *BatchStore) CreateBatch(ctx context.Context, createBatchReq CreateBatchRequest) (string, error) {
	batchData := map[string]interface{}{
		"batchName":              createBatchReq.BatchName,
		"projectID":              createBatchReq.ProjectID,
		"lastUpdated":            time.Now(),
		"numberOfTotalFiles":     0,
		"numberOfAnnotatedFiles": 0,
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

func (s *BatchStore) DeleteBatch(ctx context.Context, batchID string) error {
	return s.genericStore.DeleteDoc(ctx, batchID)
}

func (s *BatchStore) DeleteAllBatches(ctx context.Context, projectID string) error {
	queryParams := []fs.QueryParameter{
		{Path: "projectID", Op: "==", Value: projectID},
	}
	return s.genericStore.DeleteDocsByQuery(ctx, queryParams)
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

func (s *BatchStore) IncrementNumberOfTotalFiles(ctx context.Context, batchID string, req IncrementQuantityRequest) (int64, error) {
	docSnap, err := s.genericStore.GetDoc(ctx, batchID)
	if err != nil {
		return 0, err
	}
	currentVal, err := docSnap.DataAt("numberOfTotalFiles")
	if err != nil {
		return 0, err
	}
	currentInt, ok := currentVal.(int64)
	if !ok {
		return 0, fmt.Errorf("invalid type for numberOfTotalFiles")
	}

	newVal := currentInt + int64(req.Quantity)
	if newVal < 0 {
		newVal = 0
	}
	err = s.genericStore.UpdateDoc(ctx, batchID, []firestore.Update{{Path: "numberOfTotalFiles", Value: newVal}})
	return newVal, err
}

func (s *BatchStore) IncrementNumberOfAnnotatedFiles(ctx context.Context, batchID string, req IncrementQuantityRequest) (int64, error) {
	docSnap, err := s.genericStore.GetDoc(ctx, batchID)
	if err != nil {
		return 0, err
	}
	currentVal, err := docSnap.DataAt("numberOfAnnotatedFiles")
	if err != nil {
		return 0, err
	}
	currentInt, ok := currentVal.(int64)
	if !ok {
		return 0, fmt.Errorf("invalid type for numberOfAnnotatedFiles")
	}

	newVal := currentInt + int64(req.Quantity)
	if newVal < 0 {
		newVal = 0
	}
	err = s.genericStore.UpdateDoc(ctx, batchID, []firestore.Update{{Path: "numberOfAnnotatedFiles", Value: newVal}})
	return newVal, err
}
