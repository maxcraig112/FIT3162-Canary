package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"pkg/gcp/bucket"
	"pkg/handler"
	bk "project-service/bucket"
	"project-service/firestore"
	"strings"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/rs/zerolog/log"
)

type ImageHandler struct {
	*handler.Handler
	ImageStore       *firestore.ImageStore
	ImageBucket      *bk.ImageBucket
	KeypointStore    *firestore.KeypointStore
	BoundingBoxStore *firestore.BoundingBoxStore
}

func newImageHandler(h *handler.Handler) *ImageHandler {
	return &ImageHandler{
		Handler:          h,
		ImageStore:       firestore.NewImageStore(h.Clients.Firestore),
		ImageBucket:      bk.NewImageBucket(h.Clients.Bucket),
		KeypointStore:    firestore.NewKeypointStore(h.Clients.Firestore),
		BoundingBoxStore: firestore.NewBoundingBoxStore(h.Clients.Firestore),
	}
}

func RegisterImageRoutes(r *mux.Router, h *handler.Handler) {
	ih := newImageHandler(h)

	routes := []Route{
		// Get all images from a batch
		{"GET", "/batch/{batchID}/images", ih.LoadImagesHandler},
		// Upload images
		{"POST", "/batch/{batchID}/images", ih.UploadImagesHandler},
		// Delete all images from a batch
		{"DELETE", "/batch/{batchID}/images", ih.DeleteImagesHandler},
	}

	for _, rt := range routes {
		r.Handle(rt.pattern, h.AuthMw(http.HandlerFunc(rt.handlerFunc))).Methods(rt.method)
	}
}

func (h *ImageHandler) LoadImagesHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	vars := mux.Vars(r)
	batchID := vars["batchID"]
	if batchID == "" {
		http.Error(w, "Missing batchID in URL", http.StatusBadRequest)
		log.Error().Msg("Missing batchID in URL for LoadImagesHandler")
		return
	}

	// Retrieve image metadata from Firestore
	images, err := h.ImageStore.GetImagesByBatchID(ctx, batchID)
	if err != nil {
		http.Error(w, "Failed to load image metadata", http.StatusInternalServerError)
		log.Error().Err(err).Str("batchID", batchID).Msg("Failed to load image metadata")
		return
	}

	// Respond with image metadata as JSON
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(images); err != nil {
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
		log.Error().Err(err).Str("batchID", batchID).Msg("Failed to encode image metadata response")
		return
	}
	log.Info().Str("batchID", batchID).Msg("Successfully returned images by batchID")
}

func (h *ImageHandler) UploadImagesHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	err := r.ParseMultipartForm(10 << 20)
	if err != nil {
		http.Error(w, "Could not parse multipart form", http.StatusBadRequest)
		log.Error().Err(err).Msg("Could not parse multipart form in UploadImagesHandler")
		return
	}

	files := r.MultipartForm.File["images"]
	if len(files) == 0 {
		http.Error(w, "No images uploaded", http.StatusBadRequest)
		log.Error().Msg("No images uploaded in UploadImagesHandler")
		return
	}

	vars := mux.Vars(r)
	batchID := vars["batchID"]
	if batchID == "" {
		http.Error(w, "Missing batchID in URL", http.StatusBadRequest)
		log.Error().Msg("Missing batchID in URL for UploadImagesHandler")
		return
	}

	objects := make(bucket.ObjectMap, len(files))

	for _, fileHeader := range files {
		file, err := fileHeader.Open()
		if err != nil {
			http.Error(w, fmt.Sprintf("Could not open file %s", fileHeader.Filename), http.StatusInternalServerError)
			log.Error().Err(err).Str("filename", fileHeader.Filename).Msg("Could not open uploaded file")
			return
		}
		defer file.Close()

		// Construct object key, e.g. batchID/filename.png
		sanitisedFileName := strings.ReplaceAll(fileHeader.Filename, " ", "_")
		objectName := fmt.Sprintf("%s/%s-%s", batchID, sanitisedFileName, uuid.New().String())
		// Assign io.Reader to ObjectMap
		objects[objectName] = file
	}

	// Upload the images to google bucket
	var imageData map[string]string
	if imageData, err = h.ImageBucket.CreateImages(ctx, batchID, objects); err != nil {
		http.Error(w, "Failed to upload images", http.StatusInternalServerError)
		log.Error().Err(err).Str("batchID", batchID).Msg("Failed to upload images to bucket")
		return
	}

	// Once the images have been uploaded, we now want to create the image metadata in firestore
	if err := h.ImageStore.CreateImageMetadata(ctx, batchID, imageData); err != nil {
		http.Error(w, "Failed to create image metadata", http.StatusInternalServerError)
		log.Error().Err(err).Str("batchID", batchID).Msg("Failed to create image metadata in Firestore")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	log.Info().Str("batchID", batchID).Int("numImages", len(files)).Msg("Images uploaded and metadata created successfully")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"batchID":  batchID,
		"uploaded": len(files),
		"message":  "Images uploaded successfully",
	})
}

func (h *ImageHandler) DeleteImagesHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	vars := mux.Vars(r)
	batchID := vars["batchID"]
	if batchID == "" {
		http.Error(w, "Missing batchID in URL", http.StatusBadRequest)
		log.Error().Msg("Missing batchID in URL for DeleteImagesHandler")
		return
	}

	// List images first to know their IDs for annotation deletes
	images, err := h.ImageStore.GetImagesByBatchID(ctx, batchID)
	if err != nil {
		http.Error(w, "Failed to list images for deletion", http.StatusInternalServerError)
		log.Error().Err(err).Str("batchID", batchID).Msg("Failed to list images before delete")
		return
	}

	// Delete images from the bucket
	if err := h.ImageBucket.DeleteImagesByBatchID(ctx, batchID); err != nil {
		http.Error(w, "Failed to delete images from bucket", http.StatusInternalServerError)
		log.Error().Err(err).Str("batchID", batchID).Msg("Failed to delete images from bucket")
		return
	}

	// Delete image metadata from Firestore
	if err := h.ImageStore.DeleteImagesByBatchID(ctx, batchID); err != nil {
		http.Error(w, "Failed to delete image metadata", http.StatusInternalServerError)
		log.Error().Err(err).Str("batchID", batchID).Msg("Failed to delete image metadata from Firestore")
		return
	}

	// Cascade delete annotations for these images
	imageIDs := make([]string, 0, len(images))
	for _, img := range images {
		imageIDs = append(imageIDs, img.ImageID)
	}
	if err := h.KeypointStore.DeleteKeypointsByImageIDs(ctx, imageIDs); err != nil {
		http.Error(w, "Failed to delete keypoints for images", http.StatusInternalServerError)
		log.Error().Err(err).Str("batchID", batchID).Msg("Failed to delete keypoints for images")
		return
	}
	if err := h.BoundingBoxStore.DeleteBoundingBoxesByImageIDs(ctx, imageIDs); err != nil {
		http.Error(w, "Failed to delete bounding boxes for images", http.StatusInternalServerError)
		log.Error().Err(err).Str("batchID", batchID).Msg("Failed to delete bounding boxes for images")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	log.Info().Str("batchID", batchID).Msg("All images and annotations deleted successfully")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"batchID": batchID,
		"deleted": true,
		"message": "All images and annotations deleted",
	})
}
