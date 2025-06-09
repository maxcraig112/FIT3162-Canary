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

	r.HandleFunc("/delete", func(w http.ResponseWriter, r *http.Request) {
		auth.DeleteHandler(ctx, w, r, clients)
	}).Methods("POST")
}

func main() {
	ctx := context.Background()
	_ = godotenv.Load()
	port := os.Getenv("PORT")

	clients, err := gcp.InitialiseClients(ctx)
	if err != nil {
		log.Fatalf("Failed to initialize clients: %v", err)
	}
	defer clients.Firestore.Close()

	r := mux.NewRouter()
	setupHandlers(ctx, r, clients)

	log.Println("Service running on port", port)
	log.Fatal(http.ListenAndServe(":"+port, r))
}
