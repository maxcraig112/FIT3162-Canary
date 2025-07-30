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

type DeleteRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// DeleteHandler deletes a user account if the email and password are correct.
func DeleteHandler(ctx context.Context, w http.ResponseWriter, r *http.Request, clients *gcp.Clients) {
	var req DeleteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		log.Error().Err(err).Msg("Invalid delete user request")
		return
	}

	userStore := firestore.NewUserStore(clients.Firestore)
	doc, err := userStore.FindByEmail(ctx, req.Email)
	if err != nil {
		http.Error(w, "Error finding user", http.StatusInternalServerError)
		log.Error().Err(err).Str("email", req.Email).Msg("Error finding user for delete")
		return
	}
	if doc == nil {
		http.Error(w, "Invalid email or password", http.StatusUnauthorized)
		log.Error().Str("email", req.Email).Msg("User not found for delete")
		return
	}

	var userData struct {
		Email    string `firestore:"email"`
		Password string `firestore:"password"`
	}
	if err := doc.DataTo(&userData); err != nil {
		http.Error(w, "Error reading user data", http.StatusInternalServerError)
		log.Error().Err(err).Str("email", req.Email).Msg("Error reading user data for delete")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(userData.Password), []byte(req.Password)); err != nil {
		http.Error(w, "Invalid email or password", http.StatusUnauthorized)
		log.Error().Str("email", req.Email).Msg("Password mismatch for delete")
		return
	}

	err = userStore.DeleteUser(ctx, req.Email, userData.Password)
	if err != nil {
		http.Error(w, "Error deleting user", http.StatusInternalServerError)
		log.Error().Err(err).Str("email", req.Email).Msg("Error deleting user")
		return
	}

	w.WriteHeader(http.StatusOK)
	log.Info().Str("email", req.Email).Msg("User deleted successfully")
	w.Write([]byte("User deleted"))
}
