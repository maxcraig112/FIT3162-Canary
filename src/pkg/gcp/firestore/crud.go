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
	collection *firestore.CollectionRef
}

func NewGenericStore(collection *firestore.CollectionRef) *GenericStore {
	return &GenericStore{collection: collection}
}

var ErrNotFound = status.Error(codes.NotFound, "document not found")

func (s *GenericStore) CreateDoc(ctx context.Context, data interface{}) (string, error) {
	docRef, _, err := s.collection.Add(ctx, data)
	if err != nil {
		return "", err
	}
	return docRef.ID, nil
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

func (s *GenericStore) DeleteDoc(ctx context.Context, docID string) error {
	_, err := s.collection.Doc(docID).Delete(ctx)
	if status.Code(err) == codes.NotFound {
		return ErrNotFound
	}
	return err
}

func (s *GenericStore) UpdateField(ctx context.Context, docID string, updateParams []firestore.Update) error {
	// Convert updateParameters into firestore.Update
	// this struct is not even be needed but I like it

	_, err := s.collection.Doc(docID).Update(ctx, updateParams)
	if status.Code(err) == codes.NotFound {
		return ErrNotFound
	}
	return err
}
