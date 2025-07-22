package jwt

import (
	"context"
	"net/http"
	"os"
	"pkg/gcp"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

func AuthMiddleware(clients *gcp.Clients) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
				http.Error(w, "Missing or invalid Authorization header", http.StatusUnauthorized)
				return
			}
			tokenString := strings.TrimPrefix(authHeader, "Bearer ")

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
