package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"pkg/handler"
	bk "project-service/bucket"
	"project-service/firestore"

	"github.com/gorilla/mux"
	"github.com/rs/zerolog/log"
)

type BatchHandler struct {
	*handler.Handler
	BatchStore       *firestore.BatchStore
	ImageStore       *firestore.ImageStore
	ImageBucket      *bk.ImageBucket
	KeypointStore    *firestore.KeypointStore
	BoundingBoxStore *firestore.BoundingBoxStore
}

func newBatchHandler(h *handler.Handler) *BatchHandler {
	return &BatchHandler{
		Handler:          h,
		BatchStore:       firestore.NewBatchStore(h.Clients.Firestore),
		ImageStore:       firestore.NewImageStore(h.Clients.Firestore),
		ImageBucket:      bk.NewImageBucket(h.Clients.Bucket),
		KeypointStore:    firestore.NewKeypointStore(h.Clients.Firestore),
		BoundingBoxStore: firestore.NewBoundingBoxStore(h.Clients.Firestore),
	}
}

func RegisterBatchRoutes(r *mux.Router, h *handler.Handler) {
	bh := newBatchHandler(h)

	routes := []Route{
		// Create a batch
		{"POST", "/batch", bh.CreateBatchHandler},
		// Rename a batch
		{"PUT", "/batch/{batchID}", bh.RenameBatchHandler},
		// Delete a batch
		{"DELETE", "/batch/{batchID}", bh.DeleteBatchHandler},
		// Get all batches associated with a project
		{"GET", "/projects/{projectID}/batches", bh.LoadBatchInfoHandler},
		// Delete all batches associated with a project
		{"DELETE", "/projects/{projectID}/batches", bh.DeleteAllBatchesHandler},
		// Increment numberOfTotalFiles
		{"PATCH", "/batch/{batchID}/numberofTotalFiles", bh.UpdateNumberOfTotalFilesHandler},
		// Increment numberOfAnnotatedFiles
		{"PATCH", "/batch/{batchID}/numberofAnnotatedFiles", bh.UpdateNumberOfAnnotatedFilesHandler},
	}

	for _, rt := range routes {
		r.Handle(rt.pattern, h.AuthMw(http.HandlerFunc(rt.handlerFunc))).Methods(rt.method)
	}
}

func (h *BatchHandler) LoadBatchInfoHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	projectID := vars["projectID"]

	batches, err := h.BatchStore.GetBatchesByProjectID(h.Ctx, projectID)
	if err != nil {
		http.Error(w, "Error getting batches", http.StatusInternalServerError)
		log.Error().Err(err).Str("projectID", projectID).Msg("Failed to get batches by projectID")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(batches); err != nil {
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
		log.Error().Err(err).Str("projectID", projectID).Msg("Failed to encode batch info response")
		return
	}
	log.Info().Str("projectID", projectID).Msg("Successfully returned batches by projectID")
}

func (h *BatchHandler) CreateBatchHandler(w http.ResponseWriter, r *http.Request) {
	var req firestore.CreateBatchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		log.Error().Err(err).Msg("Invalid create batch request")
		return
	}

	batchID, err := h.BatchStore.CreateBatch(h.Ctx, req)
	if err != nil {
		http.Error(w, "Error creating batch", http.StatusInternalServerError)
		log.Error().Err(err).Msg("Error creating batch")
		return
	}

	w.WriteHeader(http.StatusCreated)
	log.Info().Str("batchID", batchID).Msg("Batch created successfully")
	fmt.Fprintf(w, "Batch %s created", batchID)
}

func (h *BatchHandler) RenameBatchHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	batchID := vars["batchID"]

	var req firestore.RenameBatchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		log.Error().Err(err).Str("batchID", batchID).Msg("Invalid rename batch request")
		return
	}

	err := h.BatchStore.RenameBatch(h.Ctx, batchID, req)
	if err != nil {
		http.Error(w, "Error renaming batch", http.StatusInternalServerError)
		log.Error().Err(err).Str("batchID", batchID).Msg("Error renaming batch")
		return
	}

	w.WriteHeader(http.StatusOK)
	log.Info().Str("batchID", batchID).Str("newName", req.NewBatchName).Msg("Batch renamed successfully")
	fmt.Fprintf(w, "Batch %s renamed to %s", batchID, req.NewBatchName)
}

func (h *BatchHandler) DeleteBatchHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	batchID := vars["batchID"]

	// 1) List images in this batch
	images, err := h.ImageStore.GetImagesByBatchID(h.Ctx, batchID)
	if err != nil {
		http.Error(w, "Error deleting batch", http.StatusInternalServerError)
		log.Error().Err(err).Str("batchID", batchID).Msg("Error listing images for batch delete")
		return
	}

	// 2) Delete all image objects in bucket
	if err := h.ImageBucket.DeleteImagesByBatchID(h.Ctx, batchID); err != nil {
		http.Error(w, "Error deleting images in bucket", http.StatusInternalServerError)
		log.Error().Err(err).Str("batchID", batchID).Msg("Error deleting images in bucket for batch")
		return
	}
	// 3) Delete image metadata in firestore
	if err := h.ImageStore.DeleteImagesByBatchID(h.Ctx, batchID); err != nil {
		http.Error(w, "Error deleting images metadata", http.StatusInternalServerError)
		log.Error().Err(err).Str("batchID", batchID).Msg("Error deleting images metadata for batch")
		return
	}

	// 4) Cascade delete annotations: keypoints and bounding boxes associated with those images
	imageIDs := make([]string, 0, len(images))
	for _, img := range images {
		imageIDs = append(imageIDs, img.ImageID)
	}
	if err := h.KeypointStore.DeleteKeypointsByImageIDs(h.Ctx, imageIDs); err != nil {
		http.Error(w, "Error deleting keypoints for batch", http.StatusInternalServerError)
		log.Error().Err(err).Str("batchID", batchID).Msg("Error deleting keypoints for images in batch")
		return
	}
	if err := h.BoundingBoxStore.DeleteBoundingBoxesByImageIDs(h.Ctx, imageIDs); err != nil {
		http.Error(w, "Error deleting bounding boxes for batch", http.StatusInternalServerError)
		log.Error().Err(err).Str("batchID", batchID).Msg("Error deleting bounding boxes for images in batch")
		return
	}

	// 5) Finally delete the batch document
	err = h.BatchStore.DeleteBatch(h.Ctx, batchID)
	if err != nil {
		http.Error(w, "Error deleting batch", http.StatusInternalServerError)
		log.Error().Err(err).Str("batchID", batchID).Msg("Error deleting batch")
		return
	}

	w.WriteHeader(http.StatusOK)
	log.Info().Str("batchID", batchID).Msg("Batch deleted successfully")
	fmt.Fprintf(w, "Batch %s deleted", batchID)
}

func (h *BatchHandler) DeleteAllBatchesHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	projectID := vars["projectID"]

	err := h.BatchStore.DeleteAllBatches(h.Ctx, projectID)
	if err != nil {
		http.Error(w, "Error deleting batches", http.StatusInternalServerError)
		log.Error().Err(err).Str("projectID", projectID).Msg("Error deleting batches")
		return
	}

	w.WriteHeader(http.StatusOK)
	log.Info().Str("projectID", projectID).Msg("All batches deleted successfully")
	fmt.Fprintf(w, "All batches deleted for project %s", projectID)
}

func (h *BatchHandler) UpdateNumberOfTotalFilesHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	batchID := vars["batchID"]

	var req firestore.IncrementQuantityRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		log.Error().Err(err).Str("batchID", batchID).Msg("Invalid update number of total files request")
		return
	}

	newVal, err := h.BatchStore.IncrementNumberOfTotalFiles(h.Ctx, batchID, req)
	if err != nil {
		http.Error(w, "Error incrementing number of total files", http.StatusInternalServerError)
		log.Error().Err(err).Str("batchID", batchID).Msg("Error incrementing number of total files")
		return
	}

	w.WriteHeader(http.StatusOK)
	log.Info().Str("batchID", batchID).Int64("newNumberOfTotalFiles", newVal).Msg("Updated number of total files successfully")
	fmt.Fprintf(w, "Batch: %s numberOfTotalFiles: %d", batchID, newVal)
}

func (h *BatchHandler) UpdateNumberOfAnnotatedFilesHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	batchID := vars["batchID"]

	var req firestore.IncrementQuantityRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		log.Error().Err(err).Str("batchID", batchID).Msg("Invalid update number of annotated files request")
		return
	}

	newVal, err := h.BatchStore.IncrementNumberOfAnnotatedFiles(h.Ctx, batchID, req)
	if err != nil {
		http.Error(w, "Error incrementing number of annotated files", http.StatusInternalServerError)
		log.Error().Err(err).Str("batchID", batchID).Msg("Error incrementing number of annotated files")
		return
	}

	w.WriteHeader(http.StatusOK)
	log.Info().Str("batchID", batchID).Int64("newNumberOfAnnotatedFiles", newVal).Msg("Updated number of annotated files successfully")
	fmt.Fprintf(w, "Batch: %s numberOfAnnotatedFiles: %d", batchID, newVal)
}
