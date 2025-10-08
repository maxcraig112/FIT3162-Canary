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

	"encoding/xml"

	coco "github.com/aidezone/golang-coco"
	"github.com/gorilla/mux"
	"github.com/rs/zerolog/log"
	"github.com/samber/lo"
)

type CorrectKeypointDetection struct {
	Info        coco.Information    `json:"info"`
	Images      []coco.Image        `json:"images"`
	Annotations []coco.KPAnnotation `json:"annotations"`
	Licenses    []coco.License      `json:"licenses"`
	Categories  []coco.KPCategories `json:"categories"`
}

// PascalVOCAnnotation represents the root of a Pascal VOC XML file.
type PascalVOCAnnotation struct {
	XMLName   xml.Name       `xml:"annotation"`
	Folder    string         `xml:"folder"`
	Filename  string         `xml:"filename"`
	Path      string         `xml:"path,omitempty"`
	Source    Source         `xml:"source"`
	Size      Size           `xml:"size"`
	Segmented int            `xml:"segmented"`
	Objects   []PascalObject `xml:"object"`
}

// Source holds dataset source info (often "Unknown" or "VOC2007").
type Source struct {
	Database string `xml:"database"`
}

// Size stores image dimensions.
type Size struct {
	Width  int `xml:"width"`
	Height int `xml:"height"`
	Depth  int `xml:"depth"`
}

// PascalObject represents one labeled object in the image.
type PascalObject struct {
	Name      string `xml:"name"`                // class label
	Pose      string `xml:"pose,omitempty"`      // optional: Left, Right, Frontal, etc.
	Truncated int    `xml:"truncated,omitempty"` // 1 if object cut by image border
	Difficult int    `xml:"difficult,omitempty"` // 1 if hard to recognize
	Occluded  int    `xml:"occluded,omitempty"`  // 1 if object is occluded
	BndBox    BndBox `xml:"bndbox"`              // bounding box
}

// BndBox stores the bounding box coordinates.
type BndBox struct {
	XMin int `xml:"xmin"`
	YMin int `xml:"ymin"`
	XMax int `xml:"xmax"`
	YMax int `xml:"ymax"`
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
		{"GET", "/project/{projectID}/boundingboxes/export/pascal_voc", eh.exportBoundingBoxPascalVOCHandler},
	}

	for _, rt := range routes {
		wrapped := h.AuthMw(ValidateOwnershipMiddleware(http.HandlerFunc(rt.handlerFunc), eh.Stores))
		r.Handle(rt.pattern, wrapped).Methods(rt.method)
	}
}

func (h *ExportHandler) getCompletedBatches(projectID string) ([]*firestore.Batch, error) {
	batches, err := h.BatchStore.GetBatchesByProjectID(h.Ctx, projectID)
	if err != nil {
		return nil, err
	}
	var completed []*firestore.Batch
	for i := range batches {
		if batches[i].IsComplete {
			completed = append(completed, &batches[i])
		}
	}
	return completed, nil
}

func (h *ExportHandler) getProjectImages(batches []*firestore.Batch) ([]firestore.Image, error) {
	var images []firestore.Image
	for _, b := range batches {
		imgs, err := h.ImageStore.GetImagesByBatchID(h.Ctx, b.BatchID)
		if err != nil {
			return nil, err
		}
		images = append(images, imgs...)
	}
	return images, nil
}

func ExportCOCOObjectDetection(ds coco.ObjectDetection) ([]byte, error) {
	// Step 1: Marshal your existing dataset
	raw, err := json.Marshal(ds)
	if err != nil {
		return nil, err
	}

	// Step 2: Unmarshal to a generic map
	var m map[string]interface{}
	if err := json.Unmarshal(raw, &m); err != nil {
		return nil, err
	}

	// Step 3: Inject "iscrowd":0 wherever missing
	if anns, ok := m["annotations"].([]interface{}); ok {
		for _, ann := range anns {
			a := ann.(map[string]interface{})
			if _, exists := a["iscrowd"]; !exists {
				a["iscrowd"] = 0
			}
		}
	}

	// Step 4: Marshal back to JSON
	finalJSON, err := json.MarshalIndent(m, "", "  ")
	if err != nil {
		return nil, err
	}

	return finalJSON, nil
}

func ExportCOCOKeypointDetection(ds CorrectKeypointDetection) ([]byte, error) {
	// Step 1: Marshal your existing dataset
	raw, err := json.Marshal(ds)
	if err != nil {
		return nil, err
	}

	// Step 2: Unmarshal to a generic map
	var m map[string]interface{}
	if err := json.Unmarshal(raw, &m); err != nil {
		return nil, err
	}

	// Step 3: Inject "iscrowd":0 wherever missing
	if anns, ok := m["annotations"].([]interface{}); ok {
		for _, ann := range anns {
			a := ann.(map[string]interface{})
			if _, exists := a["iscrowd"]; !exists {
				a["iscrowd"] = 0
			}
		}
	}

	// Step 4: Marshal back to JSON
	finalJSON, err := json.MarshalIndent(m, "", "  ")
	if err != nil {
		return nil, err
	}

	return finalJSON, nil
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

	completedBatches, err := h.getCompletedBatches(projectID)
	if err != nil || len(completedBatches) == 0 {
		http.Error(w, "No completed batches found", http.StatusNotFound)
		return
	}

	images, err := h.getProjectImages(completedBatches)
	if err != nil {
		http.Error(w, "Error getting images", http.StatusInternalServerError)
		log.Error().Err(err).Str("projectID", projectID).Msg("Failed to get images by batchID")
		return
	}

	boundingBoxLabels, err := h.BoundingBoxLabelStore.GetBoundingBoxLabelsByProjectID(h.Ctx, projectID)
	if err != nil {
		http.Error(w, "Error getting bounding box labels", http.StatusInternalServerError)
		log.Error().Err(err).Str("projectID", projectID).Msg("Failed to get bounding box labels by projectID")
		return
	}

	keypointLabels, err := h.KeypointLabelStore.GetKeypointLabelsByProjectID(h.Ctx, projectID)
	if err != nil {
		http.Error(w, "Error getting keypoint labels", http.StatusInternalServerError)
		log.Error().Err(err).Str("projectID", projectID).Msg("Failed to get keypoint labels by projectID")
		return
	}

	bbLabelNames := make([]string, len(boundingBoxLabels))
	bbLabelIDs := make([]string, len(boundingBoxLabels))
	for i, bb := range boundingBoxLabels {
		bbLabelNames[i] = bb.BoundingBoxLabel
		bbLabelIDs[i] = bb.BoundingBoxLabelID
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
	defer func() {
		if err := zipWriter.Close(); err != nil {
			log.Error().Err(err).Msg("Error closing zip writer")
		}
	}()

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

	for i, bbLabelNames := range bbLabelNames {
		cocoDS.Categories = append(cocoDS.Categories, coco.KPCategories{
			ID:            i + 2,
			Name:          bbLabelNames,
			Supercategory: "none",
			Keypoints:     kpLabelNames,
			Skeleton:      []coco.Edge{},
		})
	}

	current_annotation_idx := 1

	for i, img := range images {
		// write image to zip
		rc, err := h.ImageBucket.StreamImage(h.Ctx, img.ImageName)
		if err != nil {
			http.Error(w, "Error downloading image", http.StatusInternalServerError)
			log.Error().Err(err).Str("projectID", projectID).Str("batchID", img.BatchID).Str("filename", img.ImageName).Msg("Failed to download image")
			return
		}
		defer func() {
			if err := rc.Close(); err != nil {
				log.Error().Err(err).Str("projectID", projectID).Str("batchID", img.BatchID).Str("filename", img.ImageName).Msg("Failed to close image reader")
			}
		}()

		img_path := fmt.Sprintf("images/%d.jpg", i+1)
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
			FileName:     fmt.Sprintf("%d.jpg", i+1),
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
				CategoryID:   idx + 2,
				Bbox:         [4]float32{float32(bbox.Box.X), float32(bbox.Box.Y), float32(bbox.Box.Width), float32(bbox.Box.Height)},
				Area:         float32(bbox.Box.Width * bbox.Box.Height),
				Segmentation: []coco.Segment{},
				Keypoints:    kp,
				NumKeypoints: len(keypoints),
				Iscrowd:      0,
			})
			current_annotation_idx++
		}

		// get all keypoints by image id
		keypoints, err := h.KeypointStore.GetKeypointsByImageID(h.Ctx, img.ImageID)
		if err != nil {
			http.Error(w, "Error getting keypoints", http.StatusInternalServerError)
			log.Error().Err(err).Str("projectID", projectID).Str("imageID", img.ImageID).Msg("Failed to get keypoints")
			return
		}
		keypoints = lo.Filter(keypoints, func(k firestore.Keypoint, _ int) bool {
			return k.BoundingBoxID == ""
		})

		kp := make([]float32, len(kpLabelIDs)*3)
		for _, k := range keypoints {
			idx := slices.IndexFunc(kpLabelIDs, func(s string) bool { return s == k.KeypointLabelID })
			if idx == -1 {
				http.Error(w, "Error keypoint label ID not found", http.StatusInternalServerError)
				log.Error().Str("projectID", projectID).Str("imageID", img.ImageID).Str("keypointLabelID", k.KeypointLabelID).Msg("Failed to get keypoint label ID index")
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
			Bbox:         [4]float32{float32(0), float32(0), float32(img.Width), float32(img.Height)},
			Area:         float32(img.Width * img.Height),
			Segmentation: []coco.Segment{},
			Keypoints:    kp,
			NumKeypoints: len(keypoints),
			Iscrowd:      0,
		})
		current_annotation_idx++

	}

	// save coco json to zip
	// cocoBytes, err := json.MarshalIndent(cocoDS, "", "  ")
	cocoBytes, err := ExportCOCOKeypointDetection(cocoDS)

	if err != nil {
		http.Error(w, "Error marshaling COCO JSON", http.StatusInternalServerError)
		log.Error().Err(err).Str("projectID", projectID).Msg("Failed to marshal coco JSON")
		return
	}

	fw, err := zipWriter.Create("annotations/instances.json")
	if err != nil {
		http.Error(w, "Error creating coco JSON in zip", http.StatusInternalServerError)
		log.Error().Err(err).Msg("Failed to create annotations/instances.json in zip")
		return
	}

	_, err = fw.Write(cocoBytes)
	if err != nil {
		http.Error(w, "Error writing coco JSON to zip", http.StatusInternalServerError)
		log.Error().Err(err).Msg("Failed to write annotations/instances.json in zip")
		return
	}

	log.Info().Str("projectID", projectID).Msg("Successfully exported project keypoint datset to COCO format")

}

func (h *ExportHandler) exportBoundingBoxCOCOHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	projectID := vars["projectID"]

	// project, err := h.ProjectStore.GetProject(h.Ctx, projectID)
	// if err != nil {
	// 	http.Error(w, "Error getting project", http.StatusInternalServerError)
	// 	log.Error().Err(err).Str("projectID", projectID).Msg("Failed to get project by ID")
	// 	return
	// }

	completedBatches, err := h.getCompletedBatches(projectID)
	if err != nil || len(completedBatches) == 0 {
		http.Error(w, "No completed batches found", http.StatusNotFound)
		return
	}

	images, err := h.getProjectImages(completedBatches)
	if err != nil {
		http.Error(w, "Error getting images", http.StatusInternalServerError)
		log.Error().Err(err).Str("projectID", projectID).Msg("Failed to get images by batchID")
		return
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
	defer func() {
		if err := zipWriter.Close(); err != nil {
			log.Error().Err(err).Msg("Error closing zip writer")
		}
	}()

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
		Categories:  make([]coco.ODCategories, 0),
		Images:      make([]coco.Image, 0),
		Annotations: make([]coco.ODAnnotation, 0),
	}

	for i, bbLabelNames := range bbLabelNames {
		cocoDS.Categories = append(cocoDS.Categories, coco.ODCategories{
			ID:   i + 1,
			Name: bbLabelNames,
		})
	}

	current_annotation_idx := 1

	for i, img := range images {
		// write image to zip
		rc, err := h.ImageBucket.StreamImage(h.Ctx, img.ImageName)
		if err != nil {
			http.Error(w, "Error downloading image", http.StatusInternalServerError)
			log.Error().Err(err).Str("projectID", projectID).Str("batchID", img.BatchID).Str("filename", img.ImageName).Msg("Failed to download image")
			return
		}
		defer func() {
			if err := rc.Close(); err != nil {
				log.Error().Err(err).Str("projectID", projectID).Str("batchID", img.BatchID).Str("filename", img.ImageName).Msg("Failed to close image reader")
			}
		}()
		img_path := fmt.Sprintf("images/%d.jpg", i+1)
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
			FileName:     fmt.Sprintf("%d.jpg", i+1),
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
				CategoryID:   idx + 1,
				Bbox:         [4]float32{float32(bbox.Box.X), float32(bbox.Box.Y), float32(bbox.Box.Width), float32(bbox.Box.Height)},
				Area:         float32(bbox.Box.Width * bbox.Box.Height),
				Segmentation: []float32{},
				Iscrowd:      0,
			})
			current_annotation_idx++
		}
	}

	// save coco json to zip
	// cocoBytes, err := json.MarshalIndent(cocoDS, "", "  ")
	cocoBytes, err := ExportCOCOObjectDetection(cocoDS)
	if err != nil {
		http.Error(w, "Error marshaling COCO JSON", http.StatusInternalServerError)
		log.Error().Err(err).Str("projectID", projectID).Msg("Failed to marshal coco JSON")
		return
	}

	fw, err := zipWriter.Create("annotations/instances.json")
	if err != nil {
		http.Error(w, "Error creating coco JSON in zip", http.StatusInternalServerError)
		log.Error().Err(err).Msg("Failed to create annotations/instances.json in zip")
		return
	}

	_, err = fw.Write(cocoBytes)
	if err != nil {
		http.Error(w, "Error writing coco JSON to zip", http.StatusInternalServerError)
		log.Error().Err(err).Msg("Failed to write annotations/instances.json in zip")
		return
	}

	log.Info().Str("projectID", projectID).Msg("Successfully exported project bounding box datset to COCO format")

}

func (h *ExportHandler) exportBoundingBoxPascalVOCHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	projectID := vars["projectID"]

	// project, err := h.ProjectStore.GetProject(h.Ctx, projectID)
	// if err != nil {
	// 	http.Error(w, "Error getting project", http.StatusInternalServerError)
	// 	log.Error().Err(err).Str("projectID", projectID).Msg("Failed to get project by ID")
	// 	return
	// }

	completedBatches, err := h.getCompletedBatches(projectID)
	if err != nil || len(completedBatches) == 0 {
		http.Error(w, "No completed batches found", http.StatusNotFound)
		return
	}

	images, err := h.getProjectImages(completedBatches)
	if err != nil {
		http.Error(w, "Error getting images", http.StatusInternalServerError)
		log.Error().Err(err).Str("projectID", projectID).Msg("Failed to get images by batchID")
		return
	}

	boundingBoxLabels, err := h.BoundingBoxLabelStore.GetBoundingBoxLabelsByProjectID(h.Ctx, projectID)
	if err != nil {
		http.Error(w, "Error getting bounding box labels", http.StatusInternalServerError)
		log.Error().Err(err).Str("projectID", projectID).Msg("Failed to get bounding box labels by projectID")
		return
	}

	bbLabelMap := make(map[string]string, len(boundingBoxLabels))
	for _, bb := range boundingBoxLabels {
		bbLabelMap[bb.BoundingBoxLabelID] = bb.BoundingBoxLabel
	}

	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", "attachment; filename=bounding_boxes.zip")
	zipWriter := zip.NewWriter(w)
	defer func() {
		if err := zipWriter.Close(); err != nil {
			log.Error().Err(err).Msg("Error closing zip writer")
		}
	}()

	for i, img := range images {
		err := h.exportImage(zipWriter, i+1, img, bbLabelMap)
		if err != nil {
			http.Error(w, "Error exporting image", http.StatusInternalServerError)
			log.Error().Err(err).Str("projectID", projectID).Str("imageID", img.ImageID).Msg("Failed to export image")
			return
		}
	}

	fw, err := zipWriter.Create("labelmap.txt")
	if err != nil {
		http.Error(w, "Error creating labelmap.txt in zip", http.StatusInternalServerError)
		log.Error().Err(err).Msg("Failed to create labelmap.txt in zip")
		return
	}

	for _, labelName := range bbLabelMap {
		_, err := fw.Write([]byte(labelName + "\n"))
		if err != nil {
			http.Error(w, "Error writing labelmap.txt to zip", http.StatusInternalServerError)
			log.Error().Err(err).Msg("Failed to write labelmap.txt in zip")
			return
		}
	}

	fw, err = zipWriter.Create("ImageSets/Main/default.txt")
	if err != nil {
		http.Error(w, "Error creating default.txt in zip", http.StatusInternalServerError)
		log.Error().Err(err).Msg("Failed to create default.txt in zip")
		return
	}

	for i := range images {
		line := fmt.Sprintf("%d\n", i+1) // image ID without extension
		_, err := fw.Write([]byte(line))
		if err != nil {
			http.Error(w, "Error writing default.txt to zip", http.StatusInternalServerError)
			log.Error().Err(err).Msg("Failed to write default.txt in zip")
			return
		}
	}

	log.Info().Str("projectID", projectID).Msg("Successfully exported project bounding box datset to Pascal VOC format")

}

func (h *ExportHandler) exportImage(zipWriter *zip.Writer, i int, img firestore.Image, bbLabelMap map[string]string) error {
	// write image to zip
	rc, err := h.ImageBucket.StreamImage(h.Ctx, img.ImageName)
	if err != nil {
		return err
	}
	defer func() {
		if err := rc.Close(); err != nil {
			log.Error().Err(err).Str("batchID", img.BatchID).Str("imageID", img.ImageID).Msg("Failed to close image reader")
		}
	}()

	img_path := fmt.Sprintf("JPEGImages/%d.jpg", i)
	fw, err := zipWriter.Create(img_path)
	if err != nil {
		return err
	}

	_, err = io.Copy(fw, rc)
	if err != nil {
		return err
	}

	imgAnnotation := PascalVOCAnnotation{
		Folder:   "",
		Filename: fmt.Sprintf("%d.jpg", i),
		Path:     fmt.Sprintf("%d.jpg", i),
		Source: Source{
			Database: "Unknown",
		},
		Size: Size{
			Width:  int(img.Width),
			Height: int(img.Height),
			Depth:  3,
		},
		Segmented: 0,
		Objects:   []PascalObject{},
	}

	bbox, err := h.BoundingBoxStore.GetBoundingBoxesByImageID(h.Ctx, img.ImageID)
	if err != nil {
		return err
	}

	for _, bbox := range bbox {
		bbLabel := bbLabelMap[bbox.BoundingBoxLabelID]

		xmin := int(bbox.Box.X)
		ymin := int(bbox.Box.Y)
		xmax := int(bbox.Box.X + bbox.Box.Width)
		ymax := int(bbox.Box.Y + bbox.Box.Height)

		imgAnnotation.Objects = append(imgAnnotation.Objects, PascalObject{
			Name:      bbLabel,
			Pose:      "Unspecified",
			Truncated: 0,
			Difficult: 0,
			Occluded:  0,
			BndBox: BndBox{
				XMin: xmin,
				YMin: ymin,
				XMax: xmax,
				YMax: ymax,
			},
		})
	}

	annotation_path := fmt.Sprintf("Annotations/%d.xml", i)
	fw, err = zipWriter.Create(annotation_path)
	if err != nil {
		return err
	}

	encoder := xml.NewEncoder(fw)
	encoder.Indent("", "  ")
	err = encoder.Encode(imgAnnotation)
	if err != nil {
		return err
	}

	err = encoder.Flush()
	if err != nil {
		return err
	}

	return nil

}
