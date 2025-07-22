package gsm

import (
	"context"
	"fmt"

	secretmanager "cloud.google.com/go/secretmanager/apiv1"
	"cloud.google.com/go/secretmanager/apiv1/secretmanagerpb"
	"github.com/joho/godotenv"
)

// NewGSMClient initializes and returns a GSMClient.
func NewGSMClient(ctx context.Context) (*GSMClient, error) {
	_ = godotenv.Load()
	client, err := secretmanager.NewClient(ctx)
	if err != nil {
		return nil, err
	}
	return &GSMClient{client: client}, nil
}

// GetJWTSecret retrieves the JWT secret from Google Secret Manager using the secret name in .env.
func (g *GSMClient) GetSecret(ctx context.Context, projectID string, secretName string, secretVersion string) (string, error) {
	// Format: projects/{project}/secrets/{secret}/versions/latest
	secretPath := fmt.Sprintf("projects/%s/secrets/%s/versions/%s", projectID, secretName, secretVersion)
	req := &secretmanagerpb.AccessSecretVersionRequest{
		Name: secretPath,
	}
	result, err := g.client.AccessSecretVersion(ctx, req)
	if err != nil {
		return "", err
	}
	return string(result.Payload.Data), nil
}

func (g *GSMClient) Close() error {
	return g.client.Close()
}
