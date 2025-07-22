package firestore

import (
	"context"
	"log"
	"os"

	"cloud.google.com/go/firestore"
	"github.com/joho/godotenv"
)

// NewFirestoreClient initializes and returns a FirestoreClient using a specific database ID.
func NewFirestoreClient(ctx context.Context) (*FirestoreClient, error) {
	_ = godotenv.Load()

	projectID := os.Getenv("GCP_PROJECT_ID")
	databaseID := os.Getenv("DATABASE_ID")

	client, err := firestore.NewClientWithDatabase(ctx, projectID, databaseID)
	if err != nil {
		return nil, err
	}

	return &FirestoreClient{
		client: client,
		dbID:   databaseID,
	}, nil
}

// GetUsersCollection returns a reference to the "users" collection.
func (fc *FirestoreClient) GetUsersCollection() *firestore.CollectionRef {
	return fc.client.Collection("users")
}

// Close closes the Firestore client connection.
func (fc *FirestoreClient) Close() error {
	return fc.client.Close()
}

// Example usage
func Example() {
	ctx := context.Background()
	client, err := NewFirestoreClient(ctx)
	if err != nil {
		log.Fatalf("Failed to initialize Firestore client: %v", err)
	}
	defer client.Close()

	usersCol := client.GetUsersCollection()
	_ = usersCol // Use this collection reference as needed
}
