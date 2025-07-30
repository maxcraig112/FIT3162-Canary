package gsm

import (
	"context"

	secretmanager "cloud.google.com/go/secretmanager/apiv1"
)

// GSMClientInterface defines methods for GSM operations.
type GSMClientInterface interface {
	GetSecret(ctx context.Context, projectID string, secretName string) (string, error)
	Close() error
}

type GSMClient struct {
	client *secretmanager.Client
}
