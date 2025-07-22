package gcp

import (
	"context"
	"log"
	"os"

	fs "pkg/gcp/firestore"
	"pkg/gcp/gsm"

	"github.com/joho/godotenv"
)

const (
	USE_FIRESTORE_ENV string = "USE_FIRESTORE"
	USE_GSM_ENV       string = "USE_GSM"
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

func getEnvBool(envName string) bool {
	return os.Getenv(envName) == "true"
}
func (c *ClientOptions) LoadClientOptions() {
	_ = godotenv.Load()
	c.UseFirestore = getEnvBool(USE_FIRESTORE_ENV)
	if c.UseFirestore {
		c.FirestoreConfig.ProjectID = os.Getenv(fs.PROJECTID_ENV)
		c.FirestoreConfig.DatabaseID = os.Getenv(fs.DATABSEID_ENV)
	}

	c.UseGSM = getEnvBool(USE_GSM_ENV)
}

// InitialiseClients creates and returns all required service clients.
func InitialiseClients(ctx context.Context, opts ClientOptions) (*Clients, error) {
	var firestoreClient *fs.FirestoreClient
	var gsmClient *gsm.GSMClient
	var err error

	if opts.UseFirestore {
		log.Printf("Initialising Firestone Client")
		firestoreClient, err = fs.NewFirestoreClient(ctx, opts.FirestoreConfig)
		if err != nil {
			return nil, err
		}
	}

	if opts.UseGSM {
		log.Printf("Initialising GSM Client")
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
