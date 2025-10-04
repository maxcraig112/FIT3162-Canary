package bucket

import (
	"context"
	"fmt"
	"io"
	"os"
	"time"

	"cloud.google.com/go/storage"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/iterator"
)

type ObjectList []ObjectData

type ObjectData struct {
	ImageName string
	ImageData ImageData
}

var signedURLDuration = 60 * time.Minute

type ObjectMap map[string]ImageData

type ImageData struct {
	Width        int64
	Height       int64
	URL          string
	ObjectReader io.Reader
}
type GenericBucket struct {
	bucket BucketClientInterface
}

func NewGenericBucket(bucket BucketClientInterface) *GenericBucket {
	return &GenericBucket{
		bucket: bucket,
	}
}

// CreateObject uploads a single object and returns its URL.
func (b *GenericBucket) CreateObject(ctx context.Context, objectName string, data io.Reader) error {
	wc := b.bucket.Object(objectName).NewWriter(ctx)
	if _, err := io.Copy(wc, data); err != nil {
		err := wc.Close()
		if err != nil {
			return fmt.Errorf("failed to close bucket writer: %w", err)
		}
		return fmt.Errorf("failed to write object: %w", err)
	}
	if err := wc.Close(); err != nil {
		return fmt.Errorf("failed to close writer: %w", err)
	}
	// This is the private URL which we cannot use
	// url := fmt.Sprintf("https://storage.cloud.google.com/%s/%s", b.bucket.BucketName(), objectName)
	// This is the public URL
	// url := fmt.Sprintf("https://storage.googleapis.com/%s/%s", b.bucket.BucketName(), objectName)
	return nil
}

// CreateObjectsBatch uploads multiple objects and returns their URLs.
func (b *GenericBucket) CreateObjectsBatch(ctx context.Context, objects ObjectList) (ObjectList, error) {
	objectDatas := make([]ObjectData, len(objects))

	for i := range len(objects) {
		err := b.CreateObject(ctx, objects[i].ImageName, objects[i].ImageData.ObjectReader)
		if err != nil {
			return nil, fmt.Errorf("failed to upload %s: %w", objects[i].ImageName, err)
		}
		objectDatas[i] = ObjectData{
			ImageName: objects[i].ImageName,
			ImageData: ImageData{
				Width:  objects[i].ImageData.Width,
				Height: objects[i].ImageData.Height,
			},
		}
	}

	return objectDatas, nil
}

func (b *GenericBucket) DeleteObject(ctx context.Context, objectName string) error {
	err := b.bucket.Object(objectName).Delete(ctx)
	if err != nil {
		return fmt.Errorf("failed to delete object %s: %w", objectName, err)
	}
	return nil
}

func (b *GenericBucket) DeleteObjectsByPrefix(ctx context.Context, prefix string) error {
	it := b.bucket.Objects(ctx, &storage.Query{Prefix: prefix})
	for {
		objAttrs, err := it.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return fmt.Errorf("failed to list objects: %w", err)
		}
		if err := b.DeleteObject(ctx, objAttrs.Name); err != nil {
			return fmt.Errorf("failed to delete object %s: %w", objAttrs.Name, err)
		}
	}
	return nil
}

func (b *GenericBucket) GetObject(ctx context.Context, objectName string) ([]byte, error) {
	rc, err := b.bucket.Object(objectName).NewReader(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to create reader for object %s: %w", objectName, err)
	}
	defer func() {
		if err := rc.Close(); err != nil {
			fmt.Printf("failed to close reader for object %s: %v", objectName, err)
		}
	}()

	data, err := io.ReadAll(rc)
	if err != nil {
		return nil, fmt.Errorf("failed to read object %s: %w", objectName, err)
	}
	return data, nil
}

func (b *GenericBucket) StreamObject(ctx context.Context, objectName string) (io.ReadCloser, error) {
	rc, err := b.bucket.Object(objectName).NewReader(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to create reader for object %s: %w", objectName, err)
	}
	return rc, nil
}

func (b *GenericBucket) GetSignedURL(ctx context.Context, objectName string) (string, error) {
	keyJSON := os.Getenv("BUCKET_JSON_KEY")
	conf, err := google.JWTConfigFromJSON([]byte(keyJSON))
	if err != nil {
		return "", fmt.Errorf("failed to parse service account key JSON: %w", err)
	}

	url, err := storage.SignedURL(b.bucket.BucketName(), objectName, &storage.SignedURLOptions{
		Scheme:         storage.SigningSchemeV4,
		Method:         "GET",
		GoogleAccessID: os.Getenv("BUCKET_SIGNER_SA"),
		PrivateKey:     conf.PrivateKey,
		Expires:        time.Now().Add(signedURLDuration),
	})
	if err != nil {
		return "", fmt.Errorf("failed to generate signed URL for object %s: %w", objectName, err)
	}
	return url, nil
}
