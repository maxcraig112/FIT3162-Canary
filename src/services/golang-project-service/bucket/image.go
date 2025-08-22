package bucket

import (
	"context"
	"fmt"
	"pkg/gcp/bucket"
)

type ImageBucket struct {
	genericBucket *bucket.GenericBucket
}

func NewImageBucket(bk bucket.BucketClientInterface) *ImageBucket {
	return &ImageBucket{genericBucket: bucket.NewGenericBucket(bk)}
}

func (b *ImageBucket) CreateImages(ctx context.Context, batchID string, objectMap bucket.ObjectMap) (map[string]string, error) {
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
