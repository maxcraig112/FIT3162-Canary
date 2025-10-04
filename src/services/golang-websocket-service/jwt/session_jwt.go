package jwt

import (
	"errors"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/rs/zerolog/log"
)

// Claims for short-lived session join tokens
// Contains: userID, sessionID, batchID (optional), purpose = "session-join"
// Very short expiration (e.g. 1 minute) to reduce risk of reuse

type SessionJoinClaims struct {
	UserID    string `json:"userID"`
	SessionID string `json:"sessionID"`
	BatchID   string `json:"batchID"`
	Purpose   string `json:"purpose"`
	jwt.RegisteredClaims
}

const sessionJoinPurpose = "session-join"

// GenerateShortLivedSessionToken creates a JWT with a very short expiry for authorizing a websocket upgrade
func GenerateShortLivedSessionToken(userID, sessionID, batchID string, ttl time.Duration) (string, error) {
	if ttl <= 0 {
		ttl = 60 * time.Second
	}
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		log.Error().Msg("JWT_SECRET environment variable not set for session join token")
		return "", errors.New("jwt secret not set")
	}
	claims := SessionJoinClaims{
		UserID:    userID,
		SessionID: sessionID,
		BatchID:   batchID,
		Purpose:   sessionJoinPurpose,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(ttl)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(secret))
	if err != nil {
		log.Error().Err(err).Msg("Failed to sign session join token")
		return "", err
	}
	return signed, nil
}

// ValidateShortLivedSessionToken parses and validates the short-lived token and returns claims
func ValidateShortLivedSessionToken(tokenString string) (*SessionJoinClaims, error) {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		log.Error().Msg("JWT_SECRET environment variable not set for session join token validation")
		return nil, errors.New("jwt secret not set")
	}
	token, err := jwt.ParseWithClaims(tokenString, &SessionJoinClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, jwt.ErrSignatureInvalid
		}
		return []byte(secret), nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(*SessionJoinClaims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid or expired session join token")
	}
	if claims.Purpose != sessionJoinPurpose {
		return nil, errors.New("invalid token purpose")
	}
	return claims, nil
}
