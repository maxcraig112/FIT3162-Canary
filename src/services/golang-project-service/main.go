package main

import (
	"context"
	"net/http"
	"os"

	"pkg/gcp"
	"pkg/handler"
	"pkg/jwt"
	"project-service/api"

	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

// setupHandlers sets up all HTTP routes and handlers, injecting clients into handlers.

// load projects, create project, rename project, delete project, load batch info

func setupHandlers(ctx context.Context, r *mux.Router, clients *gcp.Clients) {
	authMw := jwt.AuthMiddleware(clients)

	r.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("OK"))
	}).Methods("GET")

	h := handler.NewHandler(ctx, clients, authMw)
	api.RegisterProjectRoutes(r, h)
	api.RegisterBatchRoutes(r, h)
	api.RegisterImageRoutes(r, h)

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
	// Setup logger to give colourised, human friendly output
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})

	ctx := context.Background()
	_ = godotenv.Load()
	port := os.Getenv("PORT")

	opts := gcp.ClientOptions{}
	opts.LoadClientOptions()

	clients, err := gcp.InitialiseClients(ctx, opts)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to initialize clients")
	}
	// this will make sure to close the clients when the application ends
	defer func() {
		if err := clients.CloseClients(); err != nil {
			log.Err(err).Msg("Failed to close clients")
		}
	}()

	// get JWT secret and store it as ENV variable
	projectID := os.Getenv("GCP_PROJECT_ID")
	secretName := os.Getenv("JWT_SECRET_NAME")
	secret, err := clients.GSM.GetSecret(ctx, projectID, secretName) // your function to generate a secret
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to retrieve JWT Secret")
	}
	os.Setenv("JWT_SECRET", secret)

	r := mux.NewRouter()

	setupHandlers(ctx, r, clients)

	// Wrap router with CORS middleware
	corsWrapped := corsMiddleware(r)

	log.Info().Str("port", port).Msg("Project service running")
	err = http.ListenAndServe(":"+port, corsWrapped)
	if err != nil {
		log.Err(err).Msg("Failed to listen on port")
	}
}
