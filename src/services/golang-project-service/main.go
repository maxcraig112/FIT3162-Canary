package main

import (
	"context"
	"log"
	"net/http"
	"os"

	"pkg/gcp"
	"pkg/jwt"
	"project-service/api"

	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
)

// setupHandlers sets up all HTTP routes and handlers, injecting clients into handlers.

// load projects, create project, rename project, delete project, load batch info

func setupHandlers(ctx context.Context, r *mux.Router, clients *gcp.Clients) {
	r.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("OK"))
	}).Methods("GET")

	authMw := jwt.AuthMiddleware(clients)

	r.Handle("/projects/{userID}", authMw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Load all projects
		api.LoadProjectsHandler(ctx, w, r, clients)
	}))).Methods("GET")

	r.Handle("/projects", authMw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Create a new project
		api.CreateProjectHandler(ctx, w, r, clients)
	}))).Methods("POST")

	r.Handle("/projects/{projectID}", authMw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Rename a project
		api.RenameProjectHandler(ctx, w, r, clients)
	}))).Methods("PUT")

	r.Handle("/projects/{projectID}", authMw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Delete a project
		api.DeleteProjectHandler(ctx, w, r, clients)
	}))).Methods("DELETE")

	r.Handle("/projects/{projectID}/numberoffiles", authMw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Increment the number of files in a project
		api.UpdateNumberOfFilesHandler(ctx, w, r, clients)
	}))).Methods("PATCH")

	r.Handle("/projects/{projectID}/batches", authMw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Load batch info
		api.LoadBatchInfoHandler(ctx, w, r, clients)
	}))).Methods("GET")

	r.Handle("/batch", authMw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Create a new batch
		api.CreateBatchHandler(ctx, w, r, clients)
	}))).Methods("POST")

	r.Handle("/batch/{batchID}", authMw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Rename a batch
		api.RenameBatchHandler(ctx, w, r, clients)
	}))).Methods("PUT")

	r.Handle("/batch/{batchID}", authMw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Delete a batch
		api.DeleteBatchHandler(ctx, w, r, clients)
	}))).Methods("DELETE")

}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		allowedOrigin := os.Getenv("CORS_ALLOW_ORIGIN")
		if allowedOrigin == "" {
			allowedOrigin = "*" // fallback for dev
		}
		w.Header().Set("Access-Control-Allow-Origin", allowedOrigin)
		w.Header().Set("Access-Control-Allow-Methods", os.Getenv("CORS_ALLOW_METHODS"))
		w.Header().Set("Access-Control-Allow-Headers", os.Getenv("CORS_ALLOW_HEADERS"))
		w.Header().Set("Access-Control-Allow-Credentials", os.Getenv("CORS_ALLOW_CREDENTIALS"))
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func main() {
	ctx := context.Background()
	_ = godotenv.Load()
	port := os.Getenv("PORT")

	opts := gcp.ClientOptions{}
	opts.LoadClientOptions()

	clients, err := gcp.InitialiseClients(ctx, opts)
	if err != nil {
		log.Fatalf("Failed to initialize clients: %v", err)
	}
	// this will make sure to close the clients when the application ends
	defer clients.CloseClients()

	// get JWT secret and store it as ENV variable
	projectID := os.Getenv("GCP_PROJECT_ID")
	secretName := os.Getenv("JWT_SECRET_NAME")
	secret, err := clients.GSM.GetSecret(ctx, projectID, secretName) // your function to generate a secret
	if err != nil {
		log.Fatalf("Failed to retrieve JWT Secert: %v", err)
	}
	os.Setenv("JWT_SECRET", secret)

	r := mux.NewRouter()
	setupHandlers(ctx, r, clients)

	// Wrap router with CORS middleware
	corsWrapped := corsMiddleware(r)

	log.Println("Service running on port", port)
	log.Fatal(http.ListenAndServe(":"+port, corsWrapped))
}
