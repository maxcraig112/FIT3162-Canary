package auth

import (
	"context"
	"encoding/json"
	"net/http"

	"auth-service/gcp"
	"auth-service/gcp/firestore"

	"golang.org/x/crypto/bcrypt"
)

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func LoginHandler(ctx context.Context, w http.ResponseWriter, r *http.Request, clients *gcp.Clients) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	userStore := firestore.NewUserStore(clients.Firestore)
	doc, err := userStore.FindByEmail(ctx, req.Email)
	if err != nil {
		http.Error(w, "Error finding user", http.StatusInternalServerError)
		return
	}
	if doc == nil {
		http.Error(w, "Invalid email or password", http.StatusUnauthorized)
		return
	}

	var userData struct {
		Email    string `firestore:"email"`
		Password string `firestore:"password"`
	}

	if err := doc.DataTo(&userData); err != nil {
		http.Error(w, "Error reading user data", http.StatusInternalServerError)
		return
	}

	// Compare hashed password
	if err := bcrypt.CompareHashAndPassword([]byte(userData.Password), []byte(req.Password)); err != nil {
		http.Error(w, "Invalid email or password", http.StatusUnauthorized)
		return
	}

	w.Write([]byte("User logged in"))
}
