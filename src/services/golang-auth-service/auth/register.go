package auth

import (
	"context"
	"encoding/json"
	"net/http"
	"regexp"
	"unicode"

	"auth-service/gcp"
	"auth-service/gcp/firestore"

	"golang.org/x/crypto/bcrypt"
)

type RegisterRequest struct {
	Email           string `json:"email"`
	Password        string `json:"password"`
	ConfirmPassword string `json:"confirmPassword"`
}

// isValidEmail checks if the email is in a valid format.
func isValidEmail(email string) bool {
	// RFC 5322 regex for validating email address
	re := regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)
	return re.MatchString(email)
}

// isSecurePassword checks if the password meets security requirements.
func isSecurePassword(password string) bool {
	if len(password) < 12 {
		return false
	}
	var hasUpper, hasLower, hasNumber, hasSpecial bool
	for _, c := range password {
		switch {
		case unicode.IsUpper(c):
			hasUpper = true
		case unicode.IsLower(c):
			hasLower = true
		case unicode.IsDigit(c):
			hasNumber = true
		case unicode.IsPunct(c) || unicode.IsSymbol(c):
			hasSpecial = true
		}
	}
	return hasUpper && hasLower && hasNumber && hasSpecial
}

func RegisterHandler(ctx context.Context, w http.ResponseWriter, r *http.Request, clients *gcp.Clients) {
	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}
	if !isValidEmail(req.Email) {
		http.Error(w, "Invalid email format", http.StatusBadRequest)
		return
	}
	if !isSecurePassword(req.Password) {
		http.Error(w, "Password must be at least 12 characters and include uppercase, lowercase, number, and special character", http.StatusBadRequest)
		return
	}
	if req.Password != req.ConfirmPassword {
		http.Error(w, "Passwords do not match", http.StatusBadRequest)
		return
	}

	userStore := firestore.NewUserStore(clients.Firestore)
	doc, err := userStore.FindByEmail(ctx, req.Email)
	if err != nil {
		http.Error(w, "Error processing email", http.StatusBadRequest)
		return
	}
	if doc != nil {
		http.Error(w, "Email already in use", http.StatusBadRequest)
		return
	}

	// hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "Error hashing password", http.StatusInternalServerError)
		return
	}

	// create new user
	_, err = userStore.CreateUser(ctx, req.Email, string(hashedPassword))
	if err != nil {
		http.Error(w, "Error creating user", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	w.Write([]byte("User registered"))
}
