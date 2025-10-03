package api

import (
	"net/http"
	"pkg/handler"
	bk "project-service/bucket"
	"project-service/firestore"
)

type Route struct {
	method      string
	pattern     string
	handlerFunc http.HandlerFunc
}

type Stores struct {
	ProjectStore          *firestore.ProjectStore
	BatchStore            *firestore.BatchStore
	ImageStore            *firestore.ImageStore
	KeypointStore         *firestore.KeypointStore
	KeypointLabelStore    *firestore.KeypointLabelStore
	BoundingBoxStore      *firestore.BoundingBoxStore
	BoundingBoxLabelStore *firestore.BoundingBoxLabelStore
	SessionStore          *firestore.SessionStore
}

type Buckets struct {
	ImageBucket *bk.ImageBucket
}

func InitialiseStores(h *handler.Handler) Stores {
	return Stores{
		ProjectStore:          firestore.NewProjectStore(h.Clients.Firestore),
		BatchStore:            firestore.NewBatchStore(h.Clients.Firestore),
		ImageStore:            firestore.NewImageStore(h.Clients.Firestore),
		KeypointStore:         firestore.NewKeypointStore(h.Clients.Firestore),
		KeypointLabelStore:    firestore.NewKeypointLabelStore(h.Clients.Firestore),
		BoundingBoxStore:      firestore.NewBoundingBoxStore(h.Clients.Firestore),
		BoundingBoxLabelStore: firestore.NewBoundingBoxLabelStore(h.Clients.Firestore),
		SessionStore:          firestore.NewSessionStore(h.Clients.Firestore),
	}
}

func InitialiseBuckets(h *handler.Handler) Buckets {
	return Buckets{
		ImageBucket: bk.NewImageBucket(h.Clients.Bucket),
	}
}
