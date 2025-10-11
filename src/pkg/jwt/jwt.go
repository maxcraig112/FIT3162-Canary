package jwt

import (
	"context"
	"errors"
	"net/http"
	"os"
	"pkg/gcp"
	"strings"
	"time"

	jwtlib "github.com/golang-jwt/jwt/v5"
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

			token, err := jwtlib.Parse(tokenString, func(token *jwtlib.Token) (interface{}, error) {
				if _, ok := token.Method.(*jwtlib.SigningMethodHMAC); !ok {
					return nil, jwtlib.ErrSignatureInvalid
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
func GenerateJWT(ctx context.Context, clients *gcp.Clients, userID string, email string) (string, error) {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		log.Error().Msg("JWT_SECRET environment variable not set for JWT generation")
		return "", errors.New("JWT_SECRET ENVIRONMENT VARIABLE NOT SET")
	}
	claims := jwtlib.MapClaims{
		"userID": userID,
		"email":  email,
		"exp":    time.Now().Add(720 * time.Hour).Unix(),
		"iat":    time.Now().Unix(),
	}
	token := jwtlib.NewWithClaims(jwtlib.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(secret))
	if err != nil {
		log.Error().Err(err).Str("userID", userID).Msg("Failed to sign JWT")
		return "", err
	}
	log.Info().Str("userID", userID).Msg("JWT generated successfully")
	return signed, nil
}

func GetJWTClaims(tokenString string) (jwtlib.MapClaims, error) {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		log.Error().Msg("JWT_SECRET environment variable not set")
		return nil, jwtlib.ErrTokenMalformed
	}
	token, err := jwtlib.Parse(tokenString, func(token *jwtlib.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwtlib.SigningMethodHMAC); !ok {
			log.Error().Msg("Unexpected signing method in JWT token")
			return nil, jwtlib.ErrTokenSignatureInvalid
		}
		return []byte(secret), nil
	})
	if err != nil {
		log.Error().Err(err).Msg("Failed to parse JWT token")
		return nil, err
	}
	if claims, ok := token.Claims.(jwtlib.MapClaims); ok && token.Valid {
		log.Info().Msg("JWT token claims extracted successfully")
		return claims, nil
	}
	log.Error().Msg("JWT token expired or invalid claims")
	return nil, jwtlib.ErrTokenExpired
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
