package api

import (
	"context"
	"errors"
	"os"
	"pkg/gcp"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// generateJWT generates a JWT token valid for 2 hours for the given email.
func GenerateJWT(ctx context.Context, clients *gcp.Clients, email string) (string, error) {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		return "", errors.New("JWT_SECRET ENVIRONMENT VARIABLE NOT SET")
	}
	claims := jwt.MapClaims{
		"email": email,
		"exp":   time.Now().Add(2 * time.Hour).Unix(),
		"iat":   time.Now().Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}
