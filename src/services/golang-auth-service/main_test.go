package main

import (
	"bytes"
	"context"
	"encoding/json"
	"math/rand"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"testing"

	"auth-service/api"
	authFirestore "auth-service/firestore"
	"pkg/gcp"
	"pkg/handler"
	"pkg/jwt"

	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"github.com/stretchr/testify/assert"
)

func setupTestServer(ctx context.Context) (*gcp.Clients, *httptest.Server) {
	// Setup logger to give colourised, human friendly output
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})

	_ = godotenv.Load()
	opts := gcp.ClientOptions{}
	opts.LoadClientOptions()
	clients, err := gcp.InitialiseClients(ctx, opts)
	if err != nil {
		panic(err)
	}

	projectID := os.Getenv("GCP_PROJECT_ID")
	secretName := os.Getenv("JWT_SECRET_NAME")
	secret, err := clients.GSM.GetSecret(ctx, projectID, secretName)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to retrieve JWT Secret")
	}
	os.Setenv("JWT_SECRET", secret)

	r := mux.NewRouter()
	authMw := jwt.AuthMiddleware(clients)
	h := handler.NewHandler(ctx, clients, authMw)
	api.RegisterUserRoutes(r, h)

	// Wrap router with CORS middleware
	corsWrapped := corsMiddleware(r)
	return clients, httptest.NewServer(corsWrapped)
}

func randomEmail() string {
	return "testuser" + strconv.Itoa(rand.Intn(1000000)) + "@example.com"
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
	assert.Equal(t, http.StatusNotFound, resp.StatusCode)
}
