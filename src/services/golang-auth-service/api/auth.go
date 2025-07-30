package api

import (
	"context"
	"net/http"
	"os"
	"pkg/gcp"

	"github.com/golang-jwt/jwt/v5"
	"github.com/rs/zerolog/log"
)

func AuthHandler(ctx context.Context, w http.ResponseWriter, r *http.Request, clients *gcp.Clients) {
	// Get the Authorization header
	token := r.Header.Get("Authorization")
	if token == "" {
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte("Missing token"))
		log.Error().Msg("Missing token in Authorization header")
		return
	}

	// Remove "Bearer " prefix if present
	if len(token) > 7 && token[:7] == "Bearer " {
		token = token[7:]
	}

	// Validate the JWT token
	_, err := ValidateJWT(token)
	if err != nil {
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte("Invalid token"))
		log.Error().Err(err).Msg("Invalid JWT token")
		return
	}

	w.WriteHeader(http.StatusOK)
	log.Info().Msg("JWT token validated successfully")
	w.Write([]byte("true"))
}

// ValidateJWT validates a JWT token and returns the claims if valid, or an error if invalid.
func ValidateJWT(tokenString string) (jwt.MapClaims, error) {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		log.Error().Msg("JWT_SECRET environment variable not set")
		return nil, jwt.ErrTokenMalformed
	}

	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		// Validate signing method
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			log.Error().Msg("Unexpected signing method in JWT token")
			return nil, jwt.ErrTokenSignatureInvalid
		}
		return []byte(secret), nil
	})
	if err != nil {
		log.Error().Err(err).Msg("Failed to parse JWT token")
		return nil, err
	}

	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		log.Info().Msg("JWT token claims validated and token is valid")
		return claims, nil
	}
	log.Error().Msg("JWT token expired or invalid claims")
	return nil, jwt.ErrTokenExpired
}
