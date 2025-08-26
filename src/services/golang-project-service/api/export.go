package api

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"net/http"
	"pkg/handler"
	"project-service/firestore"
	"time"

	"github.com/gorilla/mux"
	"github.com/rs/zerolog/log"
)

type ExportHandler struct {
	*handler.Handler
	// These are embedded fields so you don't need to call .Stores to get the inner fields
	Stores
	Buckets
}

func newExportHandler(h *handler.Handler) *ExportHandler {
	return &ExportHandler{
		Handler: h,
		Stores:  InitialiseStores(h),
		Buckets: InitialiseBuckets(h),
	}
}

func RegisterExportRoutes(r *mux.Router, h *handler.Handler) {
	eh := newExportHandler(h)

	routes := []Route{
		// Get all images from a batch
		{"GET", "/project/{projectID}/keypoints/export/coco", eh.exportKeypointCOCOHandler},
	}

	for _, rt := range routes {
		wrapped := h.AuthMw(ValidateOwnershipMiddleware(http.HandlerFunc(rt.handlerFunc), eh.Stores))
		r.Handle(rt.pattern, wrapped).Methods(rt.method)
	}
}

func (h *ExportHandler) exportKeypointCOCOHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	projectID := vars["projectID"]

	batches, err := h.BatchStore.GetBatchesByProjectID(h.Ctx, projectID)
	if err != nil {
		http.Error(w, "Error getting batches", http.StatusInternalServerError)
		log.Error().Err(err).Str("projectID", projectID).Msg("Failed to get batches by projectID")
		return
	}

	completedBatches := make([]*firestore.Batch, 0, len(batches))
	for _, b := range batches {
		if b.IsComplete {
			completedBatches = append(completedBatches, &b)
		}
	}
	if len(completedBatches) == 0 {
		http.Error(w, "No completed batches found", http.StatusNotFound)
		log.Error().Str("projectID", projectID).Msg("No completed batches found")
		return
	}

	images := make([]firestore.Image, 0)
	for _, b := range completedBatches {
		imgs, err := h.ImageStore.GetImagesByBatchID(h.Ctx, b.BatchID)
		if err != nil {
			http.Error(w, "Error getting images", http.StatusInternalServerError)
			log.Error().Err(err).Str("projectID", projectID).Str("batchID", b.BatchID).Msg("Failed to get images by batchID")
			return
		}
		images = append(images, imgs...)
	}

	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", "attachment; filename=keypoints.zip")

	zipWriter := zip.NewWriter(w)
	defer zipWriter.Close()

	var cocoJSON map[string]interface{}
	if err := json.Unmarshal([]byte(`{}`), &cocoJSON); err != nil {
		http.Error(w, "Error creating coco json", http.StatusInternalServerError)
		log.Error().Err(err).Msg("Failed to create coco json")
		return
	}

	currentTime := time.Now()
	cocoJSON["info"] = map[string]interface{}{
		"year":         currentTime.Format("2006"),
		"version":      "1.0",
		"description":  fmt.Sprintf("Exported keypoints from project %s", projectID),
		"contributor":  "",
		"url":          "",
		"date_created": currentTime.Format("2006/01/02"),
	}
	cocoJSON["licenses"] = []map[string]interface{}{
		{
			"url":  "http://creativecommons.org/licenses/by-nc-sa/2.0/",
			"id":   1,
			"name": "Attribution-NonCommercial-ShareAlike License",
		},
	}
	cocoJSON["categories"] = []map[string]interface{}{
		{
			"id":            0,
			"name":          "a",
			"supercategory": "none",
		},
	}
	cocoJSON["images"] = []map[string]interface{}{}

	cocoJSON["annotations"] = []map[string]interface{}{}

	current_annotation_idx := 0

	log.Info().Int("numImages", len(images)).Str("projectID", projectID).Msg("Found images")
	for i, img := range images {
		log.Info().Str("imageID", img.ImageID).Str("batchID", img.BatchID).Str("filename", img.ImageName).Str("image URL", img.ImageURL).Msg("Found image")

		imageBytes, err := h.Buckets.ImageBucket.DownloadImage(h.Ctx, img.ImageName)
		if err != nil {
			http.Error(w, "Error downloading image", http.StatusInternalServerError)
			log.Error().Err(err).Str("projectID", projectID).Str("batchID", img.BatchID).Str("filename", img.ImageName).Msg("Failed to download image")
			return
		}
		fw, err := zipWriter.Create(fmt.Sprintf("images/train/%d.jpg", i+1))
		if err != nil {
			http.Error(w, "Error creating zip entry", http.StatusInternalServerError)
			log.Error().Err(err).Str("filename", img.ImageName).Msg("Failed to add to zip")
			return
		}
		_, err = fw.Write(imageBytes)
		if err != nil {
			http.Error(w, "Error writing image to zip", http.StatusInternalServerError)
			log.Error().Err(err).Str("filename", img.ImageName).Msg("Failed to write to zip")
			return
		}

		// update coco json with image and image bbox
		cocoJSON["images"] = append(cocoJSON["images"].([]map[string]interface{}), map[string]interface{}{
			"id":            i,
			"license":       1,
			"file_name":     fmt.Sprintf("%d.jpg", i+1),
			"date_captured": time.Now().Format(time.RFC3339Nano),
			"extra": map[string]interface{}{
				"name": img.ImageName,
			},
		})

		bbox, err := h.BoundingBoxStore.GetBoundingBoxesByImageID(h.Ctx, img.ImageID)
		if err != nil {
			http.Error(w, "Error getting bounding boxes", http.StatusInternalServerError)
			log.Error().Err(err).Str("projectID", projectID).Str("imageID", img.ImageID).Msg("Failed to get bounding boxes")
			return
		}

		for _, bbox := range bbox {
			// get keypoints from bounding box
			keypoints_export := []float64{}
			keypoints, err := h.KeypointStore.GetKeypointsByBoundingBoxID(h.Ctx, bbox.BoundingBoxID)
			if err != nil {
				http.Error(w, "Error getting keypoints", http.StatusInternalServerError)
				log.Error().Err(err).Str("projectID", projectID).Str("imageID", img.ImageID).Str("boundingBoxID", bbox.BoundingBoxID).Msg("Failed to get keypoints")
				return
			}
			for _, k := range keypoints {
				keypoints_export = append(keypoints_export, k.Position.X, k.Position.Y, 2)
			}

			cocoJSON["annotations"] = append(cocoJSON["annotations"].([]map[string]interface{}), map[string]interface{}{
				"id":           current_annotation_idx,
				"image_id":     i,
				"category_id":  0,
				"bbox":         []float64{bbox.Box.X, bbox.Box.Y, bbox.Box.Width, bbox.Box.Height},
				"area":         bbox.Box.Width * bbox.Box.Height,
				"segmentation": [][]float64{},
				"keypoints":    keypoints_export,
				"iscrowd":      0,
			})
			current_annotation_idx++
		}
	}

	// save json to zip
	cocoBytes, err := json.MarshalIndent(cocoJSON, "", "  ")
	if err != nil {
		http.Error(w, "Error marshaling COCO JSON", http.StatusInternalServerError)
		log.Error().Err(err).Str("projectID", projectID).Msg("Failed to marshal coco JSON")
		return
	}

	fw, err := zipWriter.Create("images/train/_annotations.coco.json")
	if err != nil {
		http.Error(w, "Error creating coco JSON in zip", http.StatusInternalServerError)
		log.Error().Err(err).Msg("Failed to create annotations.json in zip")
		return
	}

	_, err = fw.Write(cocoBytes)
	if err != nil {
		http.Error(w, "Error writing coco JSON to zip", http.StatusInternalServerError)
		log.Error().Err(err).Msg("Failed to write annotations.json in zip")
		return
	}

}
