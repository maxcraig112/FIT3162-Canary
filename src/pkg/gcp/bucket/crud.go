package bucket

import (
	"context"
	"fmt"
	"io"
)

type ObjectReader io.Reader
type ObjectMap map[string]ObjectReader

type GenericBucket struct {
	bucket BucketClientInterface
}

func NewGenericBucket(bucket BucketClientInterface) *GenericBucket {
	return &GenericBucket{
		bucket: bucket,
	}
}

// CreateObject uploads a single object and returns its URL.
func (b *GenericBucket) CreateObject(ctx context.Context, objectName string, data io.Reader) (string, error) {
	wc := b.bucket.Object(objectName).NewWriter(ctx)
	if _, err := io.Copy(wc, data); err != nil {
		err := wc.Close()
		if err != nil {
			return "", fmt.Errorf("failed to close bucket writer: %w", err)
		}
		return "", fmt.Errorf("failed to write object: %w", err)
	}
	if err := wc.Close(); err != nil {
		return "", fmt.Errorf("failed to close writer: %w", err)
	}
	url := fmt.Sprintf("https://storage.cloud.google.com/%s/%s", b.bucket.BucketName(), objectName)
	return url, nil
}

// CreateObjectsBatch uploads multiple objects and returns their URLs.
func (b *GenericBucket) CreateObjectsBatch(ctx context.Context, objects ObjectMap) (map[string]string, error) {
	urls := make(map[string]string, len(objects))

	for name, reader := range objects {
		url, err := b.CreateObject(ctx, name, reader)
		if err != nil {
			return nil, fmt.Errorf("failed to upload %s: %w", name, err)
		}
		urls[name] = url
	}

	return urls, nil
}
func (b *GenericBucket) DeleteObject(ctx context.Context, objectName string) error {
	err := b.bucket.Object(objectName).Delete(ctx)
	if err != nil {
		return fmt.Errorf("failed to delete object %s: %w", objectName, err)
	}
	return nil
}
