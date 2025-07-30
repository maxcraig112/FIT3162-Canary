package api

import (
	"context"
	"errors"
	"os"
	"pkg/gcp"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/rs/zerolog/log"
)

// generateJWT generates a JWT token valid for 2 hours for the given email.
func GenerateJWT(ctx context.Context, clients *gcp.Clients, email string) (string, error) {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		log.Error().Msg("JWT_SECRET environment variable not set for JWT generation")
		return "", errors.New("JWT_SECRET ENVIRONMENT VARIABLE NOT SET")
	}
	claims := jwt.MapClaims{
		"email": email,
		"exp":   time.Now().Add(2 * time.Hour).Unix(),
		"iat":   time.Now().Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(secret))
	if err != nil {
		log.Error().Err(err).Str("email", email).Msg("Failed to sign JWT")
		return "", err
	}
	log.Info().Str("email", email).Msg("JWT generated successfully")
	return signed, nil
}
