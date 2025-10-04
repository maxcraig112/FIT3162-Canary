package bucket

import (
	"context"
	"fmt"
	"io"
	"pkg/gcp/bucket"
)

type ImageBucket struct {
	genericBucket *bucket.GenericBucket
}

func NewImageBucket(bk bucket.BucketClientInterface) *ImageBucket {
	return &ImageBucket{genericBucket: bucket.NewGenericBucket(bk)}
}

func (b *ImageBucket) CreateImages(ctx context.Context, batchID string, objectMap bucket.ObjectMap) (map[string]bucket.ImageData, error) {
	objectData, err := b.genericBucket.CreateObjectsBatch(ctx, objectMap)
	if err != nil {
		return nil, err
	}
	return objectData, nil
}

func (b *ImageBucket) DeleteImage(ctx context.Context, batchID string, imageName string) error {
	objectName := fmt.Sprintf("%s/%s", batchID, imageName)
	return b.genericBucket.DeleteObject(ctx, objectName)
}

func (b *ImageBucket) DeleteImagesByBatchID(ctx context.Context, batchID string) error {
	return b.genericBucket.DeleteObjectsByPrefix(ctx, batchID)
}

func (b *ImageBucket) DownloadImage(ctx context.Context, imageName string) ([]byte, error) {
	return b.genericBucket.GetObject(ctx, imageName)
}

func (b *ImageBucket) StreamImage(ctx context.Context, imageName string) (io.ReadCloser, error) {
	return b.genericBucket.StreamObject(ctx, imageName)
}

func (b *ImageBucket) GetSignedURL(ctx context.Context, imageName string) (string, error) {
	return b.genericBucket.GetSignedURL(ctx, imageName)
}
