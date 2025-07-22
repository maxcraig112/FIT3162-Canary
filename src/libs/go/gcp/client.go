package gcp

import (
	"context"

	fs "github.com/maxcraig112/FIT3165-Canary/libs/go/gcp/firestore"
	"github.com/maxcraig112/FIT3165-Canary/libs/go/gcp/gsm"
)

// ClientOptions should be populated by each service so they specify which clients they intend on using
// This avoids creating clients which are never used
type ClientOptions struct {
	UseFirestore bool
	UseGSM       bool

	FirestoreConfig fs.FireStoreClientConfig
}

// Clients holds all external service clients.
type Clients struct {
	Firestore fs.FirestoreClientInterface
	GSM       gsm.GSMClientInterface
}

// InitialiseClients creates and returns all required service clients.
func InitialiseClients(ctx context.Context, opts ClientOptions) (*Clients, error) {
	var firestoreClient *fs.FirestoreClient
	var gsmClient *gsm.GSMClient
	var err error

	if opts.UseFirestore {
		firestoreClient, err = fs.NewFirestoreClient(ctx, opts.FirestoreConfig)
		if err != nil {
			return nil, err
		}
	}

	if opts.UseGSM {
		gsmClient, err = gsm.NewGSMClient(ctx)
		if err != nil {
			return nil, err
		}
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
