package bucket

import (
	"cloud.google.com/go/storage"
)

type BucketClientInterface interface {
	BucketName() string
	Object(string) *storage.ObjectHandle
	Close() error
}

type BucketClient struct {
	Client *storage.Client
	Handle *storage.BucketHandle
}
