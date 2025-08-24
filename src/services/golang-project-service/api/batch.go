package api

import (
	"encoding/json"
	"net/http"
	"pkg/handler"
	"project-service/firestore"

	"github.com/gorilla/mux"
	"github.com/rs/zerolog/log"
)

type BatchHandler struct {
	*handler.Handler
	// These are embedded fields so you don't need to call .Stores to get the inner fields
	Stores
	Buckets
}

func newBatchHandler(h *handler.Handler) *BatchHandler {
	return &BatchHandler{
		Handler: h,
		Stores:  InitialiseStores(h),
		Buckets: InitialiseBuckets(h),
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
		{"GET", "/projects/{projectID}/batches", bh.LoadBatchesInfoHandler},
		// Get a specific batch
		{"GET", "/batch/{batchID}", bh.LoadBatchHandler},
		// Delete all batches associated with a project
		{"DELETE", "/projects/{projectID}/batches", bh.DeleteAllBatchesHandler},
		// Increment numberOfTotalFiles
		{"PATCH", "/batch/{batchID}/numberofTotalFiles", bh.UpdateNumberOfTotalFilesHandler},
		// Increment numberOfAnnotatedFiles
		{"PATCH", "/batch/{batchID}/numberofAnnotatedFiles", bh.UpdateNumberOfAnnotatedFilesHandler},
	}

	for _, rt := range routes {
		wrapped := h.AuthMw(ValidateOwnershipMiddleware(http.HandlerFunc(rt.handlerFunc), bh.Stores))
		r.Handle(rt.pattern, wrapped).Methods(rt.method)
	}
}

func (h *BatchHandler) LoadBatchHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	batchID := vars["batchID"]

	batch, err := h.BatchStore.GetBatch(h.Ctx, batchID)
	if err != nil {
		http.Error(w, "Error getting batch", http.StatusInternalServerError)
		log.Error().Err(err).Str("batchID", batchID).Msg("Failed to get batch by batchID")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(batch); err != nil {
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
		log.Error().Err(err).Str("batchID", batchID).Msg("Failed to encode batch response")
		return
	}
	log.Info().Str("batchID", batchID).Msg("Successfully returned batch by batchID")
}

func (h *BatchHandler) LoadBatchesInfoHandler(w http.ResponseWriter, r *http.Request) {
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

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	log.Info().Str("batchID", batchID).Msg("Batch created successfully")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"batchID": batchID,
		"message": "Batch created",
		"created": true,
	})
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

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	log.Info().Str("batchID", batchID).Str("newName", req.NewBatchName).Msg("Batch renamed successfully")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"batchID": batchID,
		"newName": req.NewBatchName,
		"message": "Batch renamed",
	})
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

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	log.Info().Str("batchID", batchID).Msg("Batch deleted successfully")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"batchID": batchID,
		"deleted": true,
		"message": "Batch deleted",
	})
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

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	log.Info().Str("projectID", projectID).Msg("All batches deleted successfully")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"projectID": projectID,
		"deleted":   true,
		"message":   "All batches deleted",
	})
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

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	log.Info().Str("batchID", batchID).Int64("newNumberOfTotalFiles", newVal).Msg("Updated number of total files successfully")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"batchID":            batchID,
		"numberOfTotalFiles": newVal,
		"message":            "Updated numberOfTotalFiles",
	})
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

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	log.Info().Str("batchID", batchID).Int64("newNumberOfAnnotatedFiles", newVal).Msg("Updated number of annotated files successfully")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"batchID":                batchID,
		"numberOfAnnotatedFiles": newVal,
		"message":                "Updated numberOfAnnotatedFiles",
	})
}
