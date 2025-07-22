package gsm

import (
	"context"

	secretmanager "cloud.google.com/go/secretmanager/apiv1"
)

// GSMClientInterface defines methods for GSM operations.
type GSMClientInterface interface {
	GetJWTSecret(context.Context) (string, error)
	Close() error
}

type GSMClient struct {
	client *secretmanager.Client
}
