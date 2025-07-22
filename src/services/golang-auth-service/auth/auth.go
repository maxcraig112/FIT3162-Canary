package auth

import (
	"context"
	"net/http"
	"os"
	"pkg/gcp"

	"github.com/golang-jwt/jwt/v5"
)

func AuthHandler(ctx context.Context, w http.ResponseWriter, r *http.Request, clients *gcp.Clients) {
	// Get the Authorization header
	token := r.Header.Get("Authorization")
	if token == "" {
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte("Missing token"))
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
		return
	}

	// Optionally: return claims or just 200 OK
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("true"))
}

// ValidateJWT validates a JWT token and returns the claims if valid, or an error if invalid.
func ValidateJWT(tokenString string) (jwt.MapClaims, error) {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		return nil, jwt.ErrTokenMalformed
	}

	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		// Validate signing method
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, jwt.ErrTokenSignatureInvalid
		}
		return []byte(secret), nil
	})
	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		return claims, nil
	}
	return nil, jwt.ErrTokenExpired
}
