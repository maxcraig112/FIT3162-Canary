package gcp

import (
	"auth-service/gcp/firestore"
	"auth-service/gcp/gsm"
	"context"
)

// Clients holds all external service clients.
type Clients struct {
	Firestore firestore.FirestoreClientInterface
	GSM       gsm.GSMClientInterface
}

// InitialiseClients creates and returns all required service clients.
func InitialiseClients(ctx context.Context) (*Clients, error) {
	firestoreClient, err := firestore.NewFirestoreClient(ctx)
	if err != nil {
		return nil, err
	}
	gsmClient, err := gsm.NewGSMClient(ctx)
	if err != nil {
		return nil, err
	}

	return &Clients{
		Firestore: firestoreClient,
		GSM:       gsmClient,
	}, nil
}

func (c *Clients) CloseClients() error {
	if c.Firestore != nil {
		err := c.Firestore.Close()
		if err != nil {
			return err
		}
	}
	if c.GSM != nil {
		err := c.GSM.Close()
		if err != nil {
			return err
		}
	}

	return nil
}
