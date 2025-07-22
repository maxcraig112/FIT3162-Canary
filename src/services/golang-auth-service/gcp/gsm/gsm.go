package gsm

import (
	"context"
	"os"

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
func (g *GSMClient) GetJWTSecret(ctx context.Context) (string, error) {
	projectID := os.Getenv("GCP_PROJECT_ID")
	secretName := os.Getenv("JWT_SECRET_NAME")
	// Format: projects/{project}/secrets/{secret}/versions/latest
	secretPath := "projects/" + projectID + "/secrets/" + secretName + "/versions/latest"
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
