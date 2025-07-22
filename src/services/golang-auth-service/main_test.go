package main

import (
	"bytes"
	"context"
	"encoding/json"
	"math/rand"
	"net/http"
	"net/http/httptest"
	"testing"

	authFirestore "auth-service/firestore"
	"pkg/gcp"

	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
	"github.com/stretchr/testify/assert"
)

func setupTestServer(ctx context.Context) (*gcp.Clients, *httptest.Server) {
	_ = godotenv.Load()
	opts := gcp.ClientOptions{}
	opts.LoadClientOptions()
	clients, err := gcp.InitialiseClients(ctx, opts)
	if err != nil {
		panic(err)
	}
	r := mux.NewRouter()
	setupHandlers(ctx, r, clients)
	return clients, httptest.NewServer(r)
}

func randomEmail() string {
	return "testuser" + string(rune(rand.Intn(1000000))) + "@example.com"
}

func TestRegisterAndLoginFlow(t *testing.T) {
	ctx := context.Background()
	clients, server := setupTestServer(ctx)
	defer server.Close()

	email := randomEmail()
	password := "testPassword123!"

	// Always attempt to delete the user at the end, even if test fails
	defer func() {
		defer clients.Firestore.Close()
		userStore := authFirestore.NewUserStore(clients.Firestore)
		_ = userStore.DeleteUser(ctx, email, password)
	}()

	// 1. Register user
	registerBody, _ := json.Marshal(map[string]string{
		"email":           email,
		"password":        password,
		"confirmPassword": password,
	})
	resp, err := http.Post(server.URL+"/register", "application/json", bytes.NewBuffer(registerBody))
	assert.NoError(t, err)
	assert.Equal(t, http.StatusCreated, resp.StatusCode)

	// 2. Login with correct credentials
	loginBody, _ := json.Marshal(map[string]string{
		"email":    email,
		"password": password,
	})
	resp, err = http.Post(server.URL+"/login", "application/json", bytes.NewBuffer(loginBody))
	assert.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	// 3. Login with invalid password
	loginBodyInvalid, _ := json.Marshal(map[string]string{
		"email":    email,
		"password": "WrongPassword",
	})
	resp, err = http.Post(server.URL+"/login", "application/json", bytes.NewBuffer(loginBodyInvalid))
	assert.NoError(t, err)
	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)

	// 4. Login with invalid email
	loginBodyInvalidEmail, _ := json.Marshal(map[string]string{
		"email":    "notarealuser@example.com",
		"password": password,
	})
	resp, err = http.Post(server.URL+"/login", "application/json", bytes.NewBuffer(loginBodyInvalidEmail))
	assert.NoError(t, err)
	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
}
