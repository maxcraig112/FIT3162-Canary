package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"auth-service/api"

	"pkg/gcp"
	"pkg/jwt"

	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

// setupHandlers sets up all HTTP routes and handlers, injecting clients into handlers.
func setupHandlers(ctx context.Context, r *mux.Router, clients *gcp.Clients) {
	r.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("OK"))
	}).Methods("GET")

	r.HandleFunc("/register", func(w http.ResponseWriter, r *http.Request) {
		api.RegisterHandler(ctx, w, r, clients)
	}).Methods("POST")

	r.HandleFunc("/login", func(w http.ResponseWriter, r *http.Request) {
		api.LoginHandler(ctx, w, r, clients)
	}).Methods("POST")

	// Protected route example:
	r.Handle("/user", jwt.AuthMiddleware(clients)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		api.DeleteHandler(ctx, w, r, clients)
	}))).Methods("DELETE")

	r.HandleFunc("/auth", func(w http.ResponseWriter, r *http.Request) {
		api.AuthHandler(ctx, w, r, clients)
	}).Methods("POST")
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

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	_ = godotenv.Load()
	port := os.Getenv("PORT")

	opts := gcp.ClientOptions{}
	opts.LoadClientOptions()

	clients, err := gcp.InitialiseClients(ctx, opts)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to initialize clients")
	}
	defer clients.CloseClients()

	projectID := os.Getenv("GCP_PROJECT_ID")
	secretName := os.Getenv("JWT_SECRET_NAME")
	secret, err := clients.GSM.GetSecret(ctx, projectID, secretName)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to retrieve JWT Secret")
	}
	os.Setenv("JWT_SECRET", secret)

	r := mux.NewRouter()
	setupHandlers(ctx, r, clients)

	corsWrapped := corsMiddleware(r)

	server := &http.Server{
		Addr:    ":" + port,
		Handler: corsWrapped,
	}

	go func() {
		log.Info().Str("port", port).Msg("Service running")
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("ListenAndServe failed")
		}
	}()

	<-ctx.Done()
	log.Info().Msg("Shutting down gracefully...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Fatal().Err(err).Msg("Server forced to shutdown")
	}
	log.Info().Msg("Server exited")
}
