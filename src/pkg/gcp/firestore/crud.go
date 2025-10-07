package firestore

import (
	"context"

	"cloud.google.com/go/firestore"
	"cloud.google.com/go/firestore/apiv1/firestorepb"
	"google.golang.org/api/iterator"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type QueryParameter struct {
	Path  string
	Op    string
	Value interface{}
}

type Aggregation string

var Count Aggregation = "count"

type GenericStore struct {
	client     FirestoreClientInterface
	collection *firestore.CollectionRef
}

func NewGenericStore(client FirestoreClientInterface, collectionID string) *GenericStore {
	return &GenericStore{client: client, collection: client.GetCollection(collectionID)}
}

// Client exposes the underlying Firestore client interface for advanced operations.
func (s *GenericStore) Client() FirestoreClientInterface { return s.client }

func (s *GenericStore) CreateDoc(ctx context.Context, data interface{}) (string, error) {
	docRef, _, err := s.collection.Add(ctx, data)
	if err != nil {
		return "", err
	}
	return docRef.ID, nil
}

func (s *GenericStore) CreateDocsBatch(ctx context.Context, docs []interface{}, ids []string) ([]string, error) {
	// If caller provided IDs, length must match docs
	if len(ids) != 0 && len(ids) != len(docs) {
		return nil, status.Error(codes.InvalidArgument, "number of ids and documents does not match")
	}

	// If no IDs provided, generate them
	if len(ids) == 0 {
		ids = make([]string, len(docs))
		for i := range docs {
			ids[i] = s.collection.NewDoc().ID
		}
	}

	bulkWriter := s.client.BulkWriter(ctx)
	errChan := make(chan error, len(docs))

	for i, data := range docs {
		docRef := s.collection.Doc(ids[i]) // use provided or generated ID
		_, err := bulkWriter.Set(docRef, data)
		if err != nil {
			errChan <- err
		}
	}

	// Finalize writes
	bulkWriter.End()

	// Check for errors
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

	return docs, nil
}

func (s *GenericStore) GetAggregationWithQuery(ctx context.Context, query []QueryParameter, aggregation Aggregation) (int64, error) {
	result := s.collection.Query

	for _, q := range query {
		result = result.Where(q.Path, q.Op, q.Value)
	}

	var aggregationQuery *firestore.AggregationQuery
	switch aggregation {
	case Count:
		aggregationQuery = result.NewAggregationQuery().WithCount(string(aggregation))
	default:
		return 0, status.Errorf(codes.InvalidArgument, "unsupported aggregation: %s", aggregation)
	}

	aggResult, err := aggregationQuery.Get(ctx)
	if err != nil {
		return 0, err
	}

	count, ok := aggResult[string(aggregation)]
	if !ok {
		return 0, status.Errorf(codes.Internal, "aggregation result missing count value")
	}
	countValue := count.(*firestorepb.Value)
	return countValue.GetIntegerValue(), nil
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

func (s *GenericStore) DeleteDocsByQuery(ctx context.Context, query []QueryParameter) error {
	docs, err := s.ReadCollection(ctx, query)
	if err != nil {
		return err
	}
	if len(docs) == 0 {
		return ErrNotFound
	}

	bulkWriter := s.client.BulkWriter(ctx)
	for _, doc := range docs {
		_, err := bulkWriter.Delete(doc.Ref)
		if err != nil {
			bulkWriter.End()
			return err
		}
	}
	bulkWriter.End()
	return nil
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

// WatchCollection listens for realtime updates matching the provided query and invokes onSnapshot
// with the current set of matching documents each time a snapshot is received. It returns a stop
// function to end the watch.
func (s *GenericStore) WatchCollection(ctx context.Context, query []QueryParameter, onSnapshot func([]*firestore.DocumentSnapshot)) (func(), error) {
	// Create a child context we can cancel independently
	watchCtx, cancel := context.WithCancel(ctx)

	q := s.collection.Query
	for _, qp := range query {
		q = q.Where(qp.Path, qp.Op, qp.Value)
	}
	iter := q.Snapshots(watchCtx)

	go func() {
		defer iter.Stop()
		for {
			snap, err := iter.Next()
			if err == iterator.Done {
				return
			}
			if err != nil {
				// On error, stop the watch; callers can restart if needed.
				return
			}
			var docs []*firestore.DocumentSnapshot
			for {
				doc, err := snap.Documents.Next()
				if err == iterator.Done {
					break
				}
				if err != nil {
					return
				}
				docs = append(docs, doc)
			}
			onSnapshot(docs)
		}
	}()

	stop := func() { cancel() }
	return stop, nil
}

func (s *GenericStore) GenerateNIDs(n int) ([]string, error) {
	ids := make([]string, n)
	for i := 0; i < n; i++ {
		ids[i] = s.collection.NewDoc().ID
	}
	return ids, nil
}
