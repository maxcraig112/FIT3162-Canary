package gcp

import (
	"context"
	"os"

	"github.com/rs/zerolog/log"

	"pkg/gcp/bucket"
	fs "pkg/gcp/firestore"
	"pkg/gcp/gsm"

	"github.com/joho/godotenv"
)

const (
	USE_FIRESTORE_ENV string = "USE_FIRESTORE"
	USE_GSM_ENV       string = "USE_GSM"
	USE_BUCKET_ENV    string = "USE_BUCKET"
)

// ClientOptions should be populated by each service so they specify which clients they intend on using
// This avoids creating clients which are never used
type ClientOptions struct {
	UseFirestore bool
	UseGSM       bool
	UseBucket    bool

	FirestoreConfig fs.FireStoreClientConfig
	BucketConfig    bucket.BucketClientConfig
}

// Clients holds all external service clients.
type Clients struct {
	Firestore fs.FirestoreClientInterface
	GSM       gsm.GSMClientInterface
	Bucket    bucket.BucketClientInterface
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

	c.UseBucket = getEnvBool(USE_BUCKET_ENV)
	if c.UseBucket {
		c.BucketConfig.BucketName = os.Getenv(bucket.BUCKETNAME_ENV)
	}
}

// InitialiseClients creates and returns all required service clients.
func InitialiseClients(ctx context.Context, opts ClientOptions) (*Clients, error) {
	var firestoreClient *fs.FirestoreClient
	var gsmClient *gsm.GSMClient
	var bucketClient *bucket.BucketClient
	var err error

	if opts.UseFirestore {

		firestoreClient, err = fs.NewFirestoreClient(ctx, opts.FirestoreConfig)
		if err != nil {
			return nil, err
		}
		log.Info().Msg("Firestore Client Initialised")
	}

	if opts.UseGSM {
		gsmClient, err = gsm.NewGSMClient(ctx)
		if err != nil {
			return nil, err
		}
		log.Info().Msg("GSM Client Initialised")
	}

	if opts.UseBucket {
		bucketClient, err = bucket.NewBucketClient(ctx, opts.BucketConfig)
		if err != nil {
			return nil, err
		}
		log.Info().Msg("Bucket Client Initialised")
	}

	return &Clients{
		Firestore: firestoreClient,
		GSM:       gsmClient,
		Bucket:    bucketClient,
	}, nil

}

func (c *Clients) CloseClients() error {
	if c.Firestore != nil {
		err := c.Firestore.Close()
		if err != nil {
			return err
		}
	}
	log.Info().Msg("Firestore Client Closed")

	if c.GSM != nil {
		err := c.GSM.Close()
		if err != nil {
			return err
		}
	}
	log.Info().Msg("GSM Client Closed")

	if c.Bucket != nil {
		err := c.Bucket.Close()
		if err != nil {
			return err
		}
	}
	log.Info().Msg("Bucket Client Closed")

	return nil
}
