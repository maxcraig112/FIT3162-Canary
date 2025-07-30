package api

import (
	"context"
	"encoding/json"
	"net/http"
	"regexp"
	"unicode"

	"auth-service/firestore"
	"pkg/gcp"

	"github.com/rs/zerolog/log"
	"golang.org/x/crypto/bcrypt"
)

type RegisterRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
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
		log.Error().Err(err).Msg("Invalid register request")
		return
	}
	if !isValidEmail(req.Email) {
		http.Error(w, "Invalid email format", http.StatusBadRequest)
		log.Error().Str("email", req.Email).Msg("Invalid email format for register")
		return
	}
	if !isSecurePassword(req.Password) {
		http.Error(w, "Password must be at least 12 characters and include uppercase, lowercase, number, and special character", http.StatusBadRequest)
		log.Error().Str("email", req.Email).Msg("Password does not meet security requirements for register")
		return
	}

	userStore := firestore.NewUserStore(clients.Firestore)
	doc, err := userStore.FindByEmail(ctx, req.Email)
	if err != nil {
		http.Error(w, "Error processing email", http.StatusBadRequest)
		log.Error().Err(err).Str("email", req.Email).Msg("Error processing email for register")
		return
	}
	if doc != nil {
		http.Error(w, "Email already in use", http.StatusBadRequest)
		log.Error().Str("email", req.Email).Msg("Email already in use for register")
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "Error hashing password", http.StatusInternalServerError)
		log.Error().Err(err).Str("email", req.Email).Msg("Error hashing password for register")
		return
	}

	_, err = userStore.CreateUser(ctx, req.Email, string(hashedPassword))
	if err != nil {
		http.Error(w, "Error creating user", http.StatusInternalServerError)
		log.Error().Err(err).Str("email", req.Email).Msg("Error creating user for register")
		return
	}

	w.WriteHeader(http.StatusCreated)
	log.Info().Str("email", req.Email).Msg("User registered successfully")
	w.Write([]byte("User registered"))
}
