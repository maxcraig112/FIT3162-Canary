package api

import (
	"encoding/json"
	"fmt"
	"net/http"

	"auth-service/firestore"
	fs "pkg/gcp/firestore"
	"pkg/handler"
	"pkg/jwt"

	"github.com/gorilla/mux"
	"github.com/rs/zerolog/log"
	"golang.org/x/crypto/bcrypt"
)

type UserHandler struct {
	*handler.Handler
	UserStore *firestore.UserStore
}

func NewUserHandler(h *handler.Handler) *UserHandler {
	return &UserHandler{
		Handler:   h,
		UserStore: firestore.NewUserStore(h.Clients.Firestore),
	}
}

func RegisterUserRoutes(r *mux.Router, h *handler.Handler) {
	uh := NewUserHandler(h)
	r.HandleFunc("/register", uh.RegisterHandler).Methods("POST")
	r.HandleFunc("/login", uh.LoginHandler).Methods("POST")
	r.HandleFunc("/auth/{userID}", uh.AuthHandler).Methods("POST")
	r.HandleFunc("/user", uh.DeleteHandler).Methods("DELETE")
	// refresh token - renew token
	r.HandleFunc("/refresh_token/{userID}", uh.RefreshHandler).Methods("POST")
	// logout - make token invalid
}

type RegisterRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type DeleteRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (h *UserHandler) RegisterHandler(w http.ResponseWriter, r *http.Request) {
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
	doc, _, err := h.UserStore.FindByEmail(r.Context(), req.Email)
	if err != nil && err != fs.ErrNotFound {
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
	_, err = h.UserStore.CreateUser(r.Context(), req.Email, string(hashedPassword))
	if err != nil {
		http.Error(w, "Error creating user", http.StatusInternalServerError)
		log.Error().Err(err).Str("email", req.Email).Msg("Error creating user for register")
		return
	}
	w.WriteHeader(http.StatusCreated)
	log.Info().Str("email", req.Email).Msg("User registered successfully")
	w.Write([]byte("User registered"))
}

func (h *UserHandler) LoginHandler(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		log.Error().Err(err).Msg("Invalid login request")
		return
	}
	user, userID, err := h.UserStore.FindByEmail(r.Context(), req.Email)
	if err != nil {
		http.Error(w, "Invalid email or password", http.StatusNotFound)
		log.Info().Str("email", req.Email).Msg("User not found")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		http.Error(w, "Invalid email or password", http.StatusUnauthorized)
		log.Info().Str("email", req.Email).Msg("Password mismatch for login")
		return
	}
	token, err := jwt.GenerateJWT(r.Context(), h.Clients, userID)
	if err != nil {
		http.Error(w, "Failed to generate token", http.StatusInternalServerError)
		log.Error().Err(err).Str("email", req.Email).Msg("Failed to generate JWT for login")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	log.Info().Str("email", req.Email).Msg("User logged in successfully")
	json.NewEncoder(w).Encode(map[string]string{"token": token, "userID": userID})
}

func (h *UserHandler) DeleteHandler(w http.ResponseWriter, r *http.Request) {
	var req DeleteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		log.Error().Err(err).Msg("Invalid delete user request")
		return
	}

	err := h.UserStore.DeleteUser(r.Context(), req.Email, req.Password)
	if err != nil {
		http.Error(w, "Error deleting user", http.StatusInternalServerError)
		log.Error().Err(err).Str("email", req.Email).Msg("Error deleting user")
		return
	}

	w.WriteHeader(http.StatusOK)
	log.Info().Str("email", req.Email).Msg("User deleted successfully")
	w.Write([]byte("User deleted"))
}

func (h *UserHandler) AuthHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := vars["userID"]

	err := jwt.ValidateJWT(r, userID)
	if err != nil {
		w.WriteHeader(http.StatusUnauthorized)
		fmt.Fprintf(w, "Invalid token %s", err.Error())
		log.Error().Err(err).Msg("Invalid JWT token")
		return
	}
	w.WriteHeader(http.StatusOK)
	log.Info().Msg("JWT token validated successfully")
	w.Write([]byte("true"))

}

func (h *UserHandler) RefreshHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := vars["userID"]

	err := jwt.ValidateJWT(r, userID)
	if err != nil {
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte("Invalid token"))
		log.Error().Err(err).Msg("Invalid JWT token")
		return
	}
	token, err := jwt.GenerateJWT(r.Context(), h.Clients, userID)
	if err != nil {
		http.Error(w, "Failed to generate token", http.StatusInternalServerError)
		log.Error().Err(err).Str("userID", userID).Msg("Failed to generate JWT for login")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	log.Info().Str("userID", userID).Msg("User logged in successfully")
	json.NewEncoder(w).Encode(map[string]string{"token": token})
}
