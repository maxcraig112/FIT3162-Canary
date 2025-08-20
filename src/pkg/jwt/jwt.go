package jwt

import (
	"context"
	"errors"
	"net/http"
	"os"
	"pkg/gcp"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/rs/zerolog/log"
)

func GetAuthTokenString(r *http.Request) (string, error) {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
		return "", errors.New("missing or invalid Authorization header")
	}
	return strings.TrimPrefix(authHeader, "Bearer "), nil
}

func AuthMiddleware(clients *gcp.Clients) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			tokenString, err := GetAuthTokenString(r)
			if err != nil {
				http.Error(w, err.Error(), http.StatusUnauthorized)
				return
			}

			secret := os.Getenv("JWT_SECRET")
			if secret == "" {
				http.Error(w, "Could not retrieve JWT secret", http.StatusInternalServerError)
				return
			}

			token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
				if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, jwt.ErrSignatureInvalid
				}
				return []byte(secret), nil
			})
			if err != nil || !token.Valid {
				http.Error(w, "Invalid or expired token", http.StatusUnauthorized)
				return
			}

			// Optionally, set claims in context for downstream handlers
			type contextKey string
			const jwtClaimsKey contextKey = "jwtClaims"
			ctx := context.WithValue(r.Context(), jwtClaimsKey, token.Claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// JWT and validation helpers
func GenerateJWT(ctx context.Context, clients *gcp.Clients, userID string) (string, error) {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		log.Error().Msg("JWT_SECRET environment variable not set for JWT generation")
		return "", errors.New("JWT_SECRET ENVIRONMENT VARIABLE NOT SET")
	}
	claims := jwt.MapClaims{
		"userID": userID,
		"exp":    time.Now().Add(720 * time.Hour).Unix(),
		"iat":    time.Now().Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(secret))
	if err != nil {
		log.Error().Err(err).Str("userID", userID).Msg("Failed to sign JWT")
		return "", err
	}
	log.Info().Str("userID", userID).Msg("JWT generated successfully")
	return signed, nil
}

func GetJWTClaims(tokenString string) (jwt.MapClaims, error) {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		log.Error().Msg("JWT_SECRET environment variable not set")
		return nil, jwt.ErrTokenMalformed
	}
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
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
		log.Info().Msg("JWT token claims extracted successfully")
		return claims, nil
	}
	log.Error().Msg("JWT token expired or invalid claims")
	return nil, jwt.ErrTokenExpired
}

func GetUserIDFromJWT(r *http.Request) (string, error) {
	tokenString, err := GetAuthTokenString(r)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get JWT token from request")
		return "", err
	}
	claims, err := GetJWTClaims(tokenString)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get JWT claims")
		return "", err
	}
	claimUserID, ok := claims["userID"].(string)
	if !ok {
		log.Error().Msg("Failed to parse userID from JWT claims")
		return "", errors.New("invalid token claims")
	}
	return claimUserID, nil
}

func ValidateJWT(r *http.Request, userID string) error {
	claimUserID, err := GetUserIDFromJWT(r)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get userID from JWT")
		return err
	}
	if claimUserID != userID {
		log.Error().Msg("UserID in token does not match provided userID")
		return errors.New("userID mismatch in token")
	}
	log.Info().Msg("JWT token claims validated and token is valid")
	return nil
}
