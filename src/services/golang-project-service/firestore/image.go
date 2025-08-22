package firestore

import (
	"context"
	fs "pkg/gcp/firestore"
	"time"
)

// This file is a placeholder for image storage logic, e.g., saving image metadata or references to Firestore.
// You can add functions here to save image info after uploading to GCP bucket.

const (
	imageCollectionID = "images"
)

type Image struct {
	ImageID   string `firestore:"imageID,omitempty" json:"imageID"`
	ImageURL  string `firestore:"imageURL" json:"imageURL"`
	ImageName string `firestore:"imageName" json:"imageName"`
	BatchID   string `firestore:"batchID" json:"batchID"`
}

type ImageStore struct {
	genericStore *fs.GenericStore
}

func NewImageStore(client fs.FirestoreClientInterface) *ImageStore {
	return &ImageStore{genericStore: fs.NewGenericStore(client, imageCollectionID)}
}

func (s *ImageStore) GetImagesByBatchID(ctx context.Context, batchID string) ([]Image, error) {
	queryParams := []fs.QueryParameter{
		{Path: "batchID", Op: "==", Value: batchID},
	}
	docs, err := s.genericStore.ReadCollection(ctx, queryParams)
	if err == fs.ErrNotFound {
		return []Image{}, nil
	}
	if err != nil {
		return nil, err
	}

	images := make([]Image, 0, len(docs))
	for _, doc := range docs {
		var i Image
		if err := doc.DataTo(&i); err != nil {
			return nil, err
		}
		i.BatchID = batchID
		i.ImageID = doc.Ref.ID
		images = append(images, i)
	}
	return images, nil
}

func (s *ImageStore) CreateImageMetadata(ctx context.Context, batchID string, imageInfo map[string]string) error {
	var batch []interface{}
	for imageName, imageURL := range imageInfo {
		batch = append(batch, map[string]interface{}{
			"imageURL":    imageURL,
			"imageName":   imageName,
			"batchID":     batchID,
			"lastUpdated": time.Now(),
		})
	}

	_, err := s.genericStore.CreateDocsBatch(ctx, batch)
	return err
}

func (s *ImageStore) DeleteImagesByBatchID(ctx context.Context, batchID string) error {
	queryParams := []fs.QueryParameter{
		{Path: "batchID", Op: "==", Value: batchID},
	}
	err := s.genericStore.DeleteDocsByQuery(ctx, queryParams)
	if err == fs.ErrNotFound {
		return nil
	}
	return err
}
