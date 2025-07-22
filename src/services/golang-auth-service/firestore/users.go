package firestore

import (
	"context"

	fs "pkg/gcp/firestore"

	"cloud.google.com/go/firestore"
)

const (
	userCollectionID = "users"
)

type UserStore struct {
	users *firestore.CollectionRef
}

func NewUserStore(client fs.FirestoreClientInterface) *UserStore {
	return &UserStore{users: client.GetCollection(userCollectionID)}
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

func (s *UserStore) DeleteUser(ctx context.Context, email, hashedPassword string) error {
	iter := s.users.Where("email", "==", email).Where("password", "==", hashedPassword).Limit(1).Documents(ctx)
	docs, err := iter.GetAll()
	if err != nil {
		return err
	}
	_, err = docs[0].Ref.Delete(ctx)
	return err
}
