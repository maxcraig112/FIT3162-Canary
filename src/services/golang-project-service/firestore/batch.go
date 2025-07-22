package firestore

import (
	"context"
	"fmt"

	fs "pkg/gcp/firestore"

	"errors"

	"cloud.google.com/go/firestore"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

var ErrSameBatchName = errors.New("new batch name is the same as the current one")
var ErrBatchNotFound = errors.New("batch not found")

const (
	batchCollectionID = "batchs"
)

type Batch struct {
	BatchID   string `firestore:"batchID,omitempty" json:"batchID"`
	BatchName string `firestore:"batchName,omitempty" json:"batchName"`
	ProjectID string `firestore:"userID,omitempty" json:"userID"`
}

type CreateBatchRequest struct {
	UserID    string `json:"userID"`
	BatchName string `json:"batchName"`
}

type RenameBatchRequest struct {
	NewBatchName string `json:"newBatchName"`
}

type BatchStore struct {
	batchs *firestore.CollectionRef
}

func NewBatchStore(client fs.FirestoreClientInterface) *BatchStore {
	return &BatchStore{batchs: client.GetCollection(batchCollectionID)}
}

func (s *BatchStore) GetBatchsByUserID(ctx context.Context, userID string) ([]Batch, error) {
	iter := s.batchs.Where("userID", "==", userID).Documents(ctx)
	docs, err := iter.GetAll()
	if err != nil {
		return nil, err
	}

	batchs := make([]Batch, 0, len(docs))
	for _, doc := range docs {
		var p Batch
		if err := doc.DataTo(&p); err != nil {
			return nil, err
		}
		p.BatchID = doc.Ref.ID
		batchs = append(batchs, p)
	}
	return batchs, nil
}

func (s *BatchStore) CreateBatch(ctx context.Context, createBatchReq CreateBatchRequest) (string, error) {
	batchData := map[string]interface{}{
		"batchName": createBatchReq.BatchName,
		"userID":    createBatchReq.UserID,
	}
	docRef, _, err := s.batchs.Add(ctx, batchData)
	if err != nil {
		return "", err
	}
	return docRef.ID, nil
}

func (s *BatchStore) RenameBatch(ctx context.Context, docID string, renameBatchReq RenameBatchRequest) error {
	docRef := s.batchs.Doc(docID)

	docSnap, err := docRef.Get(ctx)
	if err != nil {
		if status.Code(err) == codes.NotFound {
			return fmt.Errorf("%w: %s", ErrBatchNotFound, docID)
		}
		return err
	}

	currentName, err := docSnap.DataAt("batchName")
	if err != nil {
		return err
	}
	if currentName == renameBatchReq.NewBatchName {
		return ErrSameBatchName
	}

	_, err = docRef.Update(ctx, []firestore.Update{
		{Path: "batchName", Value: renameBatchReq.NewBatchName},
	})
	return err
}

func (s *BatchStore) DeleteBatch(ctx context.Context, docID string) error {
	docRef := s.batchs.Doc(docID)

	_, err := docRef.Get(ctx)
	if err != nil {
		if status.Code(err) == codes.NotFound {
			return fmt.Errorf("%w: %s", ErrBatchNotFound, docID)
		}
		return err
	}

	_, err = docRef.Delete(ctx)
	return err
}
