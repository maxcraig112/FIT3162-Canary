package bucket

import (
	"context"

	"cloud.google.com/go/storage"
)

type BucketClientInterface interface {
	BucketName() string
	Object(string) *storage.ObjectHandle
	Objects(ctx context.Context, q *storage.Query) *storage.ObjectIterator
	Close() error
}

type BucketClient struct {
	Client *storage.Client
	Handle *storage.BucketHandle
}
