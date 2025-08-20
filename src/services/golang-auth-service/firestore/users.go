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

func (s *UserStore) FindByEmail(ctx context.Context, email string) (*User, string, error) {
	queryParams := []fs.QueryParameter{
		{Path: "email", Op: "==", Value: email},
	}

	doc, err := s.genericStore.GetDocByQuery(ctx, queryParams)
	if err != nil {
		return nil, "", err
	}
	// Convert to User
	var user User
	if err := doc.DataTo(&user); err != nil {
		return nil, "", err
	}
	return &user, doc.Ref.ID, nil
}

func (s *UserStore) CreateUser(ctx context.Context, email, hashedPassword string) (string, error) {
	user := User{
		Email:    email,
		Password: hashedPassword,
	}

	return s.genericStore.CreateDoc(ctx, user)
}

func (s *UserStore) DeleteUser(ctx context.Context, email string, hashedPassword string) error {
	queryParams := []fs.QueryParameter{
		{Path: "email", Op: "==", Value: email},
		{Path: "password", Op: "==", Value: hashedPassword},
	}
	return s.genericStore.DeleteDocByQuery(ctx, queryParams)
}
