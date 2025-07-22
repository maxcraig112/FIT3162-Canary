package auth

import (
	"context"
	"encoding/json"
	"net/http"

	"auth-service/firestore"
	"pkg/gcp"

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
		return
	}

	userStore := firestore.NewUserStore(clients.Firestore)
	// Find the user by email
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

	// Use DeleteUser to delete the user
	err = userStore.DeleteUser(ctx, req.Email, userData.Password)
	if err != nil {
		http.Error(w, "Error deleting user", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte("User deleted"))
}
