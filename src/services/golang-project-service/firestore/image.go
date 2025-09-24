package firestore

import (
	"context"
	"pkg/gcp/bucket"
	fs "pkg/gcp/firestore"
	"time"

	"cloud.google.com/go/firestore"
)

// This file is a placeholder for image storage logic, e.g., saving image metadata or references to Firestore.
// You can add functions here to save image info after uploading to GCP bucket.

const (
	imageCollectionID = "images"
)

type Image struct {
	ImageID     string    `firestore:"imageID,omitempty" json:"imageID"`
	ImageName   string    `firestore:"imageName" json:"imageName"`
	ImageURL    string    `firestore:"imageURL" json:"imageURL"`
	Height      int64     `firestore:"height" json:"height"`
	Width       int64     `firestore:"width" json:"width"`
	BatchID     string    `firestore:"batchID" json:"batchID"`
	LastUpdated time.Time `firestore:"lastUpdated" json:"lastUpdated"`
	IsSequence  bool      `firestore:"isSequence" json:"isSequence"`
	PrevImageID string    `firestore:"prevImageID" json:"prevImageID"`
	NextImageID string    `firestore:"nextImageID" json:"nextImageID"`
}

type ImageStore struct {
	genericStore *fs.GenericStore
}

func NewImageStore(client fs.FirestoreClientInterface) *ImageStore {
	return &ImageStore{genericStore: fs.NewGenericStore(client, imageCollectionID)}
}

func (s *ImageStore) GetImage(ctx context.Context, imageID string) (*Image, error) {
	docSnap, err := s.genericStore.GetDoc(ctx, imageID)
	if err != nil {
		return nil, err
	}

	var i Image
	if err := docSnap.DataTo(&i); err != nil {
		return nil, err
	}

	i.ImageID = docSnap.Ref.ID
	return &i, nil
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

func (s *ImageStore) GetTotalImageCountByBatchID(ctx context.Context, batchID string) (int64, error) {
	queryParams := []fs.QueryParameter{
		{Path: "batchID", Op: "==", Value: batchID},
	}
	return s.genericStore.GetAggregationWithQuery(ctx, queryParams, fs.Count)
}

func (s *ImageStore) CreateImageMetadata(ctx context.Context, batchID string, imageInfo bucket.ObjectList, isSequence bool) ([]Image, error) {
	imageBatch := []Image{}

	for _, objectData := range imageInfo {
		imageBatch = append(imageBatch, Image{
			ImageURL:    objectData.ImageData.URL,
			ImageName:   objectData.ImageName,
			Height:      objectData.ImageData.Height,
			Width:       objectData.ImageData.Width,
			BatchID:     batchID,
			LastUpdated: time.Now(),
			IsSequence:  isSequence,
			PrevImageID: "",
			NextImageID: "",
		})
	}

	imageInterfaces := make([]interface{}, len(imageBatch))
	for i, img := range imageBatch {
		imageInterfaces[i] = img
	}

	ids, err := s.genericStore.CreateDocsBatch(ctx, imageInterfaces)
	if err != nil {
		return nil, err
	}
	for i := range imageBatch {
		imageBatch[i].ImageID = ids[i]
		if isSequence {
			update := []firestore.Update{}
			if i > 0 {
				imageBatch[i].PrevImageID = ids[i-1]
				update = append(update, firestore.Update{Path: "prevImageID", Value: ids[i-1]})
			}
			if i < len(imageBatch)-1 {
				imageBatch[i].NextImageID = ids[i+1]
				update = append(update, firestore.Update{Path: "nextImageID", Value: ids[i+1]})
			}
			s.genericStore.UpdateDoc(ctx, ids[i], update)
		}
	}
	return imageBatch, nil
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
