package firestore

import (
	"context"

	"cloud.google.com/go/firestore"
	"github.com/joho/godotenv"
)

const (
	PROJECTID_ENV string = "FIRESTORE_PROJECTID"
	DATABSEID_ENV string = "FIRESTORE_DATABASEID"
)

type FireStoreClientConfig struct {
	ProjectID  string
	DatabaseID string
}

// NewFirestoreClient initializes and returns a FirestoreClient using a specific database ID.
func NewFirestoreClient(ctx context.Context, cfg FireStoreClientConfig) (*FirestoreClient, error) {
	_ = godotenv.Load()

	client, err := firestore.NewClientWithDatabase(ctx, cfg.ProjectID, cfg.DatabaseID)
	if err != nil {
		return nil, err
	}

	return &FirestoreClient{
		client: client,
		dbID:   cfg.DatabaseID,
	}, nil
}

func (fc *FirestoreClient) BulkWriter(ctx context.Context) *firestore.BulkWriter {
	return fc.client.BulkWriter(ctx)
}

// GetUsersCollection returns a reference to the "users" collection.
func (fc *FirestoreClient) GetCollection(path string) *firestore.CollectionRef {
	return fc.client.Collection(path)
}

// Close closes the Firestore client connection.
func (fc *FirestoreClient) Close() error {
	return fc.client.Close()
}
