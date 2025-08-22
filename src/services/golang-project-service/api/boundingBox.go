package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"pkg/handler"
	"project-service/firestore"

	"github.com/gorilla/mux"
	"github.com/rs/zerolog/log"
)

type BoundingBoxHandler struct {
	*handler.Handler
	BoundingBoxStore *firestore.BoundingBoxStore
}

func newBoundingBoxHandler(h *handler.Handler) *BoundingBoxHandler {
	return &BoundingBoxHandler{
		Handler:          h,
		BoundingBoxStore: firestore.NewBoundingBoxStore(h.Clients.Firestore),
	}
}

func RegisterBoundingBoxRoutes(r *mux.Router, h *handler.Handler) {
	bbh := newBoundingBoxHandler(h)

	routes := []Route{
		{"POST", "/projects/{projectID}/images/{imageID}/boundingboxes", bbh.CreateBoundingBoxHandler},
		{"GET", "/projects/{projectID}/images/{imageID}/boundingboxes", bbh.GetBoundingBoxesByImageHandler},
		{"GET", "/projects/{projectID}/boundingboxes/{boundingBoxID}", bbh.GetBoundingBoxHandler},
		{"PATCH", "/projects/{projectID}/boundingboxes/{boundingBoxID}", bbh.UpdateBoundingBoxPositionHandler},
		{"DELETE", "/projects/{projectID}/boundingboxes/{boundingBoxID}", bbh.DeleteBoundingBoxHandler},
	}

	for _, rt := range routes {
		r.Handle(rt.pattern, h.AuthMw(http.HandlerFunc(rt.handlerFunc))).Methods(rt.method)
	}
}

func (h *BoundingBoxHandler) CreateBoundingBoxHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	imageID := vars["imageID"]

	var req firestore.CreateBoundingBoxRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		log.Error().Err(err).Msg("Invalid create bounding box request")
		return
	}

	req.ImageID = imageID

	id, err := h.BoundingBoxStore.CreateBoundingBox(h.Ctx, req)
	if err != nil {
		http.Error(w, "Error creating bounding box", http.StatusInternalServerError)
		log.Error().Err(err).Msg("Failed to create bounding box")
		return
	}

	w.WriteHeader(http.StatusCreated)
	log.Info().Str("boundingBoxID", id).Msg("Bounding box created successfully")
	w.Write([]byte(fmt.Sprintf("Bounding box %s created", id)))
}

func (h *BoundingBoxHandler) GetBoundingBoxesByImageHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	imageID := vars["imageID"]

	boundingBoxes, err := h.BoundingBoxStore.GetBoundingBoxesByImageID(h.Ctx, imageID)
	log.Info().Interface("boundingBoxes", boundingBoxes).Msg("Loaded bounding boxes")
	if err != nil {
		http.Error(w, "Error loading bounding boxes", http.StatusInternalServerError)
		log.Error().Err(err).Msg("Failed to load bounding boxes for image")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	log.Info().Str("imageID", imageID).Msg("Loaded bounding boxes successfully")
	json.NewEncoder(w).Encode(boundingBoxes)
}

func (h *BoundingBoxHandler) GetBoundingBoxHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	boundingBoxID := vars["boundingBoxID"]

	bb, err := h.BoundingBoxStore.GetBoundingBox(h.Ctx, boundingBoxID)
	if err != nil {
		http.Error(w, "Bounding box not found", http.StatusNotFound)
		log.Error().Err(err).Msg("Bounding box not found")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	log.Info().Str("boundingBoxID", boundingBoxID).Msg("Loaded bounding box successfully")
	json.NewEncoder(w).Encode(bb)
}

func (h *BoundingBoxHandler) UpdateBoundingBoxPositionHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	boundingBoxID := vars["boundingBoxID"]

	var req firestore.UpdateBoundingBoxPositionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		log.Error().Err(err).Msg("Invalid update bounding box request")
		return
	}
	req.BoundingBoxID = boundingBoxID

	if err := h.BoundingBoxStore.UpdateBoundingBoxPosition(h.Ctx, req); err != nil {
		http.Error(w, "Error updating bounding box", http.StatusInternalServerError)
		log.Error().Err(err).Msg("Failed to update bounding box position")
		return
	}

	w.WriteHeader(http.StatusOK)
	log.Info().Str("boundingBoxID", boundingBoxID).Msg("Bounding box position updated successfully")
	w.Write([]byte("Bounding box position updated"))
}

func (h *BoundingBoxHandler) DeleteBoundingBoxHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	boundingBoxID := vars["boundingBoxID"]

	if err := h.BoundingBoxStore.DeleteBoundingBox(h.Ctx, boundingBoxID); err != nil {
		http.Error(w, "Error deleting bounding box", http.StatusInternalServerError)
		log.Error().Err(err).Msg("Failed to delete bounding box")
		return
	}

	w.WriteHeader(http.StatusOK)
	log.Info().Str("boundingBoxID", boundingBoxID).Msg("Bounding box deleted successfully")
	w.Write([]byte("Bounding box deleted"))
}
