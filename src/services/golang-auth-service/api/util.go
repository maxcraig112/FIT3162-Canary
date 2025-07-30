package api

import (
	"context"
	"errors"
	"os"
	"pkg/gcp"
	"regexp"
	"time"
	"unicode"

	"github.com/golang-jwt/jwt/v5"
	"github.com/rs/zerolog/log"
)

// JWT and validation helpers
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

func ValidateJWT(tokenString string) (jwt.MapClaims, error) {
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
		log.Info().Msg("JWT token claims validated and token is valid")
		return claims, nil
	}
	log.Error().Msg("JWT token expired or invalid claims")
	return nil, jwt.ErrTokenExpired
}

// Helpers
func isValidEmail(email string) bool {
	re := regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)
	return re.MatchString(email)
}

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
