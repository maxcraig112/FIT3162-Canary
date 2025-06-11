package main

import (
	"context"
	"log"
	"net/http"
	"os"

	"auth-service/auth"
	"auth-service/gcp"

	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
)

// setupHandlers sets up all HTTP routes and handlers, injecting clients into handlers.
func setupHandlers(ctx context.Context, r *mux.Router, clients *gcp.Clients) {
	r.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("OK"))
	}).Methods("GET")

	r.HandleFunc("/register", func(w http.ResponseWriter, r *http.Request) {
		auth.RegisterHandler(ctx, w, r, clients)
	}).Methods("POST")

	r.HandleFunc("/login", func(w http.ResponseWriter, r *http.Request) {
		auth.LoginHandler(ctx, w, r, clients)
	}).Methods("POST")

	// Protected route example:
	r.Handle("/delete", auth.AuthMiddleware(clients)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		auth.DeleteHandler(ctx, w, r, clients)
	}))).Methods("POST")
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

	clients, err := gcp.InitialiseClients(ctx)
	if err != nil {
		log.Fatalf("Failed to initialize clients: %v", err)
	}
	// this will make sure to close the clients when the application ends
	defer clients.CloseClients()

	// get JWT secret and store it as ENV variable
	secret, err := clients.GSM.GetJWTSecret(ctx) // your function to generate a secret
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
