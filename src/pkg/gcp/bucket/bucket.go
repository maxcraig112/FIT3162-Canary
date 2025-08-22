package bucket

import (
	"context"

	"cloud.google.com/go/storage"
	"github.com/joho/godotenv"
)

const (
	BUCKETNAME_ENV string = "BUCKET_NAME"
)

type BucketClientConfig struct {
	BucketName string
}

func NewBucketClient(ctx context.Context, cfg BucketClientConfig) (*BucketClient, error) {
	_ = godotenv.Load()

	client, err := storage.NewClient(ctx)
	if err != nil {
		return nil, err
	}

	bucketHandle := client.Bucket(cfg.BucketName)

	return &BucketClient{
		Client: client,
		Handle: bucketHandle,
	}, nil
}

func (bc *BucketClient) BucketName() string {
	return bc.Handle.BucketName()
}

func (bc *BucketClient) Object(objectName string) *storage.ObjectHandle {
	return bc.Handle.Object(objectName)
}

func (bc *BucketClient) Objects(ctx context.Context, q *storage.Query) *storage.ObjectIterator {
	return bc.Handle.Objects(ctx, q)
}

// Close closes the Firestore client connection.
func (bc *BucketClient) Close() error {
	return bc.Client.Close()
}
