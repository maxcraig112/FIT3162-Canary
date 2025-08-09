package firestore

import (
	"context"

	"cloud.google.com/go/firestore"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type QueryParameter struct {
	Path  string
	Op    string
	Value interface{}
}

type GenericStore struct {
	client     FirestoreClientInterface
	collection *firestore.CollectionRef
}

func NewGenericStore(client FirestoreClientInterface, collectionID string) *GenericStore {
	return &GenericStore{client: client, collection: client.GetCollection(collectionID)}
}

var ErrNotFound = status.Error(codes.NotFound, "document not found")

func (s *GenericStore) CreateDoc(ctx context.Context, data interface{}) (string, error) {
	docRef, _, err := s.collection.Add(ctx, data)
	if err != nil {
		return "", err
	}
	return docRef.ID, nil
}

func (s *GenericStore) CreateDocsBatch(ctx context.Context, docs []interface{}) ([]string, error) {
	bulkWriter := s.client.BulkWriter(ctx)
	ids := make([]string, len(docs))
	errChan := make(chan error, len(docs))

	for i, data := range docs {
		docRef := s.collection.NewDoc()
		ids[i] = docRef.ID

		_, err := bulkWriter.Set(docRef, data)
		if err != nil {
			errChan <- err
		}
	}
	// End sends all the documents simulatenously and closes the channel
	bulkWriter.End()

	// Check for individual errors
	close(errChan)
	for err := range errChan {
		if err != nil {
			return nil, err
		}
	}

	return ids, nil
}

func (s *GenericStore) ReadCollection(ctx context.Context, query []QueryParameter) ([]*firestore.DocumentSnapshot, error) {
	result := s.collection.Query

	for _, q := range query {
		result = result.Where(q.Path, q.Op, q.Value)
	}
	iter := result.Documents(ctx)
	defer iter.Stop()
	docs, err := iter.GetAll()
	if err != nil {
		return nil, err
	}
	if len(docs) == 0 {
		return nil, ErrNotFound
	}
	return docs, nil
}

func (s *GenericStore) GetDoc(ctx context.Context, docID string) (*firestore.DocumentSnapshot, error) {
	docSnap, err := s.collection.Doc(docID).Get(ctx)
	if status.Code(err) == codes.NotFound {
		return nil, ErrNotFound
	}
	return docSnap, err
}

// GetDocByQuery returns a single document matching the query. Returns ErrNotFound if none, or error if not unique.
func (s *GenericStore) GetDocByQuery(ctx context.Context, query []QueryParameter) (*firestore.DocumentSnapshot, error) {
	docs, err := s.ReadCollection(ctx, query)
	if err != nil {
		return nil, err
	}
	if len(docs) == 0 {
		return nil, ErrNotFound
	}
	if len(docs) > 1 {
		return nil, status.Error(codes.FailedPrecondition, "query did not resolve to a unique document")
	}
	return docs[0], nil
}

func (s *GenericStore) DeleteDoc(ctx context.Context, docID string) error {
	_, err := s.collection.Doc(docID).Delete(ctx)
	if status.Code(err) == codes.NotFound {
		return ErrNotFound
	}
	return err
}

func (s *GenericStore) DeleteDocByQuery(ctx context.Context, query []QueryParameter) error {
	docs, err := s.ReadCollection(ctx, query)
	if err != nil {
		return err
	}
	if len(docs) == 0 {
		return ErrNotFound
	}
	if len(docs) > 1 {
		return status.Error(codes.FailedPrecondition, "query did not resolve to a unique document for delete")
	}
	_, err = docs[0].Ref.Delete(ctx)
	return err
}

func (s *GenericStore) UpdateDoc(ctx context.Context, docID string, updateParams []firestore.Update) error {
	// Convert updateParameters into firestore.Update
	// this struct is not even be needed but I like it

	_, err := s.collection.Doc(docID).Update(ctx, updateParams)
	if status.Code(err) == codes.NotFound {
		return ErrNotFound
	}
	return err
}
