package api

import (
	"archive/zip"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"pkg/handler"
	"project-service/firestore"

	coco "github.com/aidezone/golang-coco"
	"github.com/gorilla/mux"
	"github.com/rs/zerolog/log"
)

type CorrectKeypointDetection struct {
	Info        coco.Information    `json:"info,omitempty"`
	Images      []coco.Image        `json:"images,omitempty"`
	Annotations []coco.KPAnnotation `json:"annotations,omitempty"`
	Licenses    []coco.License      `json:"licenses,omitempty"`
	Categories  []coco.KPCategories `json:"categories,omitempty"`
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
		{"GET", "/project/{projectID}/boundingboxes/export/pascalvoc", eh.exportBoundingBoxPASCALVOCHandler},
	}

	for _, rt := range routes {
		wrapped := h.AuthMw(ValidateOwnershipMiddleware(http.HandlerFunc(rt.handlerFunc), eh.Stores))
		r.Handle(rt.pattern, wrapped).Methods(rt.method)
	}
}

type Annotation struct {
	XMLName  xml.Name `xml:”annotation”`
	Folder   string   `xml:”folder”`
	FileName string   `xml:”fileName”`
	Size     Size     `xml:”size”`
	Object   []Object `xml:”object”`
}

type Size struct {
	Width  int `xml:”width”`
	Height int `xml:”height”`
	Depth  int `xml:”depth”`
}

type Object struct {
	Name        string      `xml:”name”`
	Pose        string      `xml:”pose”`
	Truncated   int         `xml:”truncated”`
	Difficult   int         `xml:”difficult”`
	Occluded    int         `xml:”occluded”`
	BoundingBox BoundingBox `xml:”bndbox”`
}

type BoundingBox struct {
	XMin int `xml:”xmin”`
	YMin int `xml:”ymin”`
	XMax int `xml:”xmax”`
	YMax int `xml:”ymax”`
}

func (h *ExportHandler) exportBoundingBoxPASCALVOCHandler(w http.ResponseWriter, r *http.Request) {

	vars := mux.Vars(r)
	projectID := vars["projectID"]

	_, err := h.ProjectStore.GetProject(h.Ctx, projectID)
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

	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", "attachment; filename=bbox_annotations.zip")
	zipWriter := zip.NewWriter(w)
	defer zipWriter.Close()

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

		bbox, err := h.BoundingBoxStore.GetBoundingBoxesByImageID(h.Ctx, img.ImageID)
		if err != nil {
			http.Error(w, "Error getting bounding boxes", http.StatusInternalServerError)
			log.Error().Err(err).Str("projectID", projectID).Str("imageID", img.ImageID).Msg("Failed to get bounding boxes")
			return
		}

		annotation := &Annotation{
			FileName: img.ImageName,
			Size:     Size{Width: int(img.Width), Height: int(img.Height), Depth: 3},
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

			annotation.Object = append(annotation.Object, Object{
				Name:      bbLabelNames[idx],
				Pose:      "Unspecified",
				Truncated: 0,
				Difficult: 0,
				Occluded:  0,
				BoundingBox: BoundingBox{
					XMin: int(bbox.Box.X),
					YMin: int(bbox.Box.Y),
					XMax: int(bbox.Box.X + bbox.Box.Width),
					YMax: int(bbox.Box.Y + bbox.Box.Height),
				},
			})
		}

		// add xml to zip
		xmlBytes, err := xml.MarshalIndent(annotation, "", "  ")
		if err != nil {
			http.Error(w, "Error marshaling XML", http.StatusInternalServerError)
			log.Error().Err(err).Str("projectID", projectID).Str("imageID", img.ImageID).Msg("Failed to marshal XML")
			return
		}
		xmlBytes = append([]byte(xml.Header), xmlBytes...)

		// create the annotation XML inside the zip
		xmlPath := fmt.Sprintf("annotations/%d.xml", i+1)
		fw, err = zipWriter.Create(xmlPath)
		if err != nil {
			http.Error(w, "Error creating zip entry for XML", http.StatusInternalServerError)
			log.Error().Err(err).Str("filename", xmlPath).Msg("Failed to add XML to zip")
			return
		}
		_, err = fw.Write(xmlBytes)
		if err != nil {
			http.Error(w, "Error writing XML to zip", http.StatusInternalServerError)
			log.Error().Err(err).Str("filename", xmlPath).Msg("Failed to write XML to zip")
			return
		}
	}

	log.Info().Str("projectID", projectID).Msg("Successfully exported project bounding box dataset to PASCAL VOC format")

}
