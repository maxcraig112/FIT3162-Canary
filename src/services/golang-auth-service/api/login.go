package api

import (
	"context"
	"encoding/json"
	"net/http"

	"auth-service/firestore"
	"pkg/gcp"

	"github.com/rs/zerolog/log"
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
		log.Error().Err(err).Msg("Invalid login request")
		return
	}

	userStore := firestore.NewUserStore(clients.Firestore)
	doc, err := userStore.FindByEmail(ctx, req.Email)
	if err != nil {
		http.Error(w, "Error finding user", http.StatusInternalServerError)
		log.Error().Err(err).Str("email", req.Email).Msg("Error finding user for login")
		return
	}
	if doc == nil {
		http.Error(w, "Invalid email or password", http.StatusUnauthorized)
		log.Error().Str("email", req.Email).Msg("User not found for login")
		return
	}

	var userData struct {
		Email    string `firestore:"email"`
		Password string `firestore:"password"`
	}

	if err := doc.DataTo(&userData); err != nil {
		http.Error(w, "Error reading user data", http.StatusInternalServerError)
		log.Error().Err(err).Str("email", req.Email).Msg("Error reading user data for login")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(userData.Password), []byte(req.Password)); err != nil {
		http.Error(w, "Invalid email or password", http.StatusUnauthorized)
		log.Error().Str("email", req.Email).Msg("Password mismatch for login")
		return
	}

	token, err := GenerateJWT(ctx, clients, userData.Email)
	if err != nil {
		http.Error(w, "Failed to generate token", http.StatusInternalServerError)
		log.Error().Err(err).Str("email", req.Email).Msg("Failed to generate JWT for login")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	log.Info().Str("email", req.Email).Msg("User logged in successfully")
	json.NewEncoder(w).Encode(map[string]string{
		"token": token,
	})
}
