package firestore

import (
	"context"

	fs "pkg/gcp/firestore"
)

const (
	userCollectionID = "users"
)

type User struct {
	Email    string `firestore:"email" json:"email"`
	Password string `firestore:"password" json:"password"`
}

type UserStore struct {
	genericStore *fs.GenericStore
}

func NewUserStore(client fs.FirestoreClientInterface) *UserStore {
	return &UserStore{genericStore: fs.NewGenericStore(client, userCollectionID)}
}

func (s *UserStore) GetUserByID(ctx context.Context, userID string) (*User, error) {
	doc, err := s.genericStore.GetDoc(ctx, userID)
	if err != nil {
		return nil, err
	}

	var user User
	if err := doc.DataTo(&user); err != nil {
		return nil, err
	}

	return &user, nil
}
