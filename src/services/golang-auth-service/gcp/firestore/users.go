package firestore

import (
	"context"

	"cloud.google.com/go/firestore"
)

type UserStore struct {
	users *firestore.CollectionRef
}

func NewUserStore(client FirestoreClientInterface) *UserStore {
	return &UserStore{users: client.GetUsersCollection()}
}

func (s *UserStore) FindByEmail(ctx context.Context, email string) (*firestore.DocumentSnapshot, error) {
	iter := s.users.Where("email", "==", email).Limit(1).Documents(ctx)
	docs, err := iter.GetAll()
	if err != nil || len(docs) == 0 {
		return nil, err
	}
	return docs[0], nil
}

func (s *UserStore) CreateUser(ctx context.Context, email, hashedPassword string) (*firestore.DocumentRef, error) {
	userData := map[string]interface{}{
		"email":    email,
		"password": hashedPassword,
	}
	docRef, _, err := s.users.Add(ctx, userData)
	if err != nil {
		return nil, err
	}
	return docRef, nil
}
