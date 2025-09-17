package api

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"pkg/handler"
	"project-service/firestore"
	"slices"
	"time"

	coco "github.com/aidezone/golang-coco"
	"github.com/gorilla/mux"
	"github.com/rs/zerolog/log"
)

type CorrectKeypointDetection struct {
	Info        coco.Information    `json:"info"`
	Images      []coco.Image        `json:"images"`
	Annotations []coco.KPAnnotation `json:"annotations"`
	Licenses    []coco.License      `json:"licenses"`
	Categories  []coco.KPCategories `json:"categories"`
}

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
		{"GET", "/project/{projectID}/boundingboxes/export/coco", eh.exportBoundingBoxCOCOHandler},
	}

	for _, rt := range routes {
		wrapped := h.AuthMw(ValidateOwnershipMiddleware(http.HandlerFunc(rt.handlerFunc), eh.Stores))
		r.Handle(rt.pattern, wrapped).Methods(rt.method)
	}
}

func (h *ExportHandler) exportKeypointCOCOHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	projectID := vars["projectID"]

	project, err := h.ProjectStore.GetProject(h.Ctx, projectID)
	if err != nil {
		http.Error(w, "Error getting project", http.StatusInternalServerError)
		log.Error().Err(err).Str("projectID", projectID).Msg("Failed to get project by ID")
		return
	}

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

	keypointLabels, err := h.KeypointLabelStore.GetKeypointLabelsByProjectID(h.Ctx, projectID)
	if err != nil {
		http.Error(w, "Error getting keypoint labels", http.StatusInternalServerError)
		log.Error().Err(err).Str("projectID", projectID).Msg("Failed to get keypoint labels by projectID")
		return
	}

	kpLabelNames := make([]string, len(keypointLabels))
	kpLabelIDs := make([]string, len(keypointLabels))
	for i, kp := range keypointLabels {
		kpLabelNames[i] = kp.KeypointLabel
		kpLabelIDs[i] = kp.KeypointLabelID
	}

	// start creating coco format
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", "attachment; filename=keypoints.zip")
	zipWriter := zip.NewWriter(w)
	defer zipWriter.Close()

	now := time.Now()
	cocoDS := CorrectKeypointDetection{
		Info: coco.Information{
			Year:        now.Year(),
			Version:     "1.0",
			Description: fmt.Sprintf("Exported keypoints from project %s", projectID),
			DateCreated: now.Format("2006-01-02"),
		},
		Licenses: []coco.License{
			{
				ID:   1,
				Name: "Attribution-NonCommercial-ShareAlike License",
				URL:  "http://creativecommons.org/licenses/by-nc-sa/2.0/ ",
			},
		},
		Categories: []coco.KPCategories{
			{
				ID:            1,
				Name:          project.ProjectName, // keep as project name?
				Supercategory: "none",
				Keypoints:     kpLabelNames,
				Skeleton:      []coco.Edge{},
			},
		},
		Images:      make([]coco.Image, 0),
		Annotations: make([]coco.KPAnnotation, 0),
	}

	current_annotation_idx := 1

	for i, img := range images {
		// write image to zip
		rc, err := h.Buckets.ImageBucket.StreamImage(h.Ctx, img.ImageName)
		if err != nil {
			http.Error(w, "Error downloading image", http.StatusInternalServerError)
			log.Error().Err(err).Str("projectID", projectID).Str("batchID", img.BatchID).Str("filename", img.ImageName).Msg("Failed to download image")
			return
		}
		img_path := fmt.Sprintf("images/train/%d.jpg", i+1)
		fw, err := zipWriter.Create(img_path)
		if err != nil {
			http.Error(w, "Error creating zip entry", http.StatusInternalServerError)
			log.Error().Err(err).Str("filename", img.ImageName).Msg("Failed to add to zip")
			return
		}
		_, err = io.Copy(fw, rc)
		if err != nil {
			http.Error(w, "Error writing image to zip", http.StatusInternalServerError)
			log.Error().Err(err).Str("filename", img.ImageName).Msg("Failed to write to zip")
			return
		}

		cocoDS.Images = append(cocoDS.Images, coco.Image{
			ID:           i + 1,
			FileName:     img_path,
			License:      1,
			DateCaptured: now.Format(time.RFC3339),
			Width:        int(img.Width),
			Height:       int(img.Height),
		})

		bbox, err := h.BoundingBoxStore.GetBoundingBoxesByImageID(h.Ctx, img.ImageID)
		if err != nil {
			http.Error(w, "Error getting bounding boxes", http.StatusInternalServerError)
			log.Error().Err(err).Str("projectID", projectID).Str("imageID", img.ImageID).Msg("Failed to get bounding boxes")
			return
		}
		for _, bbox := range bbox {
			keypoints, err := h.KeypointStore.GetKeypointsByBoundingBoxID(h.Ctx, bbox.BoundingBoxID)
			if err != nil {
				http.Error(w, "Error getting keypoints", http.StatusInternalServerError)
				log.Error().Err(err).Str("projectID", projectID).Str("imageID", img.ImageID).Str("boundingBoxID", bbox.BoundingBoxID).Msg("Failed to get keypoints")
				return
			}
			kp := make([]float32, len(kpLabelIDs)*3)
			for _, k := range keypoints {
				idx := slices.IndexFunc(kpLabelIDs, func(s string) bool { return s == k.KeypointLabelID })
				if idx == -1 {
					http.Error(w, "Error keypoint label ID not found", http.StatusInternalServerError)
					log.Error().Str("projectID", projectID).Str("imageID", img.ImageID).Str("boundingBoxID", bbox.BoundingBoxID).Str("keypointLabelID", k.KeypointLabelID).Msg("Failed to get keypoint label ID index")
					return
				}
				kp[idx*3] = float32(k.Position.X)
				kp[idx*3+1] = float32(k.Position.Y)
				kp[idx*3+2] = 2
			}

			cocoDS.Annotations = append(cocoDS.Annotations, coco.KPAnnotation{
				ID:           current_annotation_idx,
				ImageID:      i + 1,
				CategoryID:   1,
				Bbox:         [4]float32{float32(bbox.Box.X), float32(bbox.Box.Y), float32(bbox.Box.Width), float32(bbox.Box.Height)},
				Area:         float32(bbox.Box.Width * bbox.Box.Height),
				Segmentation: nil,
				Keypoints:    kp,
				NumKeypoints: len(keypoints),
				Iscrowd:      0,
			})
			current_annotation_idx++
		}
	}

	// save coco json to zip
	cocoBytes, err := json.MarshalIndent(cocoDS, "", "  ")
	if err != nil {
		http.Error(w, "Error marshaling COCO JSON", http.StatusInternalServerError)
		log.Error().Err(err).Str("projectID", projectID).Msg("Failed to marshal coco JSON")
		return
	}

	fw, err := zipWriter.Create("annotations.json")
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

	log.Info().Str("projectID", projectID).Msg("Successfully exported project keypoint datset to COCO format")

}

func (h *ExportHandler) exportBoundingBoxCOCOHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	projectID := vars["projectID"]

	project, err := h.ProjectStore.GetProject(h.Ctx, projectID)
	if err != nil {
		http.Error(w, "Error getting project", http.StatusInternalServerError)
		log.Error().Err(err).Str("projectID", projectID).Msg("Failed to get project by ID")
		return
	}

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

	boundingBoxLabels, err := h.BoundingBoxLabelStore.GetBoundingBoxLabelsByProjectID(h.Ctx, projectID)
	if err != nil {
		http.Error(w, "Error getting bounding box labels", http.StatusInternalServerError)
		log.Error().Err(err).Str("projectID", projectID).Msg("Failed to get bounding box labels by projectID")
		return
	}

	bbLabelNames := make([]string, len(boundingBoxLabels))
	bbLabelIDs := make([]string, len(boundingBoxLabels))
	for i, bb := range boundingBoxLabels {
		bbLabelNames[i] = bb.BoundingBoxLabel
		bbLabelIDs[i] = bb.BoundingBoxLabelID
	}

	// start creating coco format
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", "attachment; filename=bounding_boxes.zip")
	zipWriter := zip.NewWriter(w)
	defer zipWriter.Close()

	now := time.Now()
	cocoDS := coco.ObjectDetection{
		Info: coco.Information{
			Year:        now.Year(),
			Version:     "1.0",
			Description: fmt.Sprintf("Exported bounding boxes from project %s", projectID),
			DateCreated: now.Format("2006-01-02"),
		},
		Licenses: []coco.License{
			{
				ID:   1,
				Name: "Attribution-NonCommercial-ShareAlike License",
				URL:  "http://creativecommons.org/licenses/by-nc-sa/2.0/ ",
			},
		},
		Categories: []coco.ODCategories{
			{
				ID:            1,
				Name:          project.ProjectName, // keep as project name?
				Supercategory: "none",
			},
		},
		Images:      make([]coco.Image, 0),
		Annotations: make([]coco.ODAnnotation, 0),
	}

	for i, bbLabelNames := range bbLabelNames {
		cocoDS.Categories = append(cocoDS.Categories, coco.ODCategories{
			ID:            i + 2,
			Name:          bbLabelNames,
			Supercategory: project.ProjectName,
		})
	}

	current_annotation_idx := 1

	for i, img := range images {
		// write image to zip
		rc, err := h.Buckets.ImageBucket.StreamImage(h.Ctx, img.ImageName)
		if err != nil {
			http.Error(w, "Error downloading image", http.StatusInternalServerError)
			log.Error().Err(err).Str("projectID", projectID).Str("batchID", img.BatchID).Str("filename", img.ImageName).Msg("Failed to download image")
			return
		}
		img_path := fmt.Sprintf("images/train/%d.jpg", i+1)
		fw, err := zipWriter.Create(img_path)
		if err != nil {
			http.Error(w, "Error creating zip entry", http.StatusInternalServerError)
			log.Error().Err(err).Str("filename", img.ImageName).Msg("Failed to add to zip")
			return
		}
		_, err = io.Copy(fw, rc)
		if err != nil {
			http.Error(w, "Error writing image to zip", http.StatusInternalServerError)
			log.Error().Err(err).Str("filename", img.ImageName).Msg("Failed to write to zip")
			return
		}

		cocoDS.Images = append(cocoDS.Images, coco.Image{
			ID:           i + 1,
			FileName:     img_path,
			License:      1,
			DateCaptured: now.Format(time.RFC3339),
			Width:        int(img.Width),
			Height:       int(img.Height),
		})

		bbox, err := h.BoundingBoxStore.GetBoundingBoxesByImageID(h.Ctx, img.ImageID)
		if err != nil {
			http.Error(w, "Error getting bounding boxes", http.StatusInternalServerError)
			log.Error().Err(err).Str("projectID", projectID).Str("imageID", img.ImageID).Msg("Failed to get bounding boxes")
			return
		}
		for _, bbox := range bbox {
			idx := -1
			for j, labelID := range bbLabelIDs {
				if labelID == bbox.BoundingBoxLabelID {
					idx = j
					break
				}
			}
			if idx == -1 {
				http.Error(w, "Error getting bounding box label", http.StatusInternalServerError)
				log.Error().Err(err).Str("projectID", projectID).Str("imageID", img.ImageID).Str("labelID", bbox.BoundingBoxLabelID).Msg("Failed to get bounding box label")
				return
			}
			cocoDS.Annotations = append(cocoDS.Annotations, coco.ODAnnotation{
				ID:           current_annotation_idx,
				ImageID:      i + 1,
				CategoryID:   idx + 2,
				Bbox:         [4]float32{float32(bbox.Box.X), float32(bbox.Box.Y), float32(bbox.Box.Width), float32(bbox.Box.Height)},
				Area:         float32(bbox.Box.Width * bbox.Box.Height),
				Segmentation: nil,
				Iscrowd:      0,
			})
			current_annotation_idx++
		}
	}

	// save coco json to zip
	cocoBytes, err := json.MarshalIndent(cocoDS, "", "  ")
	if err != nil {
		http.Error(w, "Error marshaling COCO JSON", http.StatusInternalServerError)
		log.Error().Err(err).Str("projectID", projectID).Msg("Failed to marshal coco JSON")
		return
	}

	fw, err := zipWriter.Create("annotations.json")
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

	log.Info().Str("projectID", projectID).Msg("Successfully exported project bounding box datset to COCO format")

}
