package firestore

import "cloud.google.com/go/firestore"

// FirestoreClientInterface defines methods for Firestore operations.
type FirestoreClientInterface interface {
	GetUsersCollection() *firestore.CollectionRef
	Close() error
}

// FirestoreClient wraps the Firestore client and implements FirestoreClientInterface.
type FirestoreClient struct {
	client *firestore.Client
	dbID   string
}
