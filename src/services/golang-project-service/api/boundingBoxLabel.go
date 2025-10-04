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

type BoundingBoxLabelHandler struct {
	*handler.Handler
	// These are embedded fields so you don't need to call .Stores to get the inner fields
	Stores
	Buckets
}

func newBoundingBoxLabelHandler(h *handler.Handler) *BoundingBoxLabelHandler {
	return &BoundingBoxLabelHandler{
		Handler: h,
		Stores:  InitialiseStores(h),
		Buckets: InitialiseBuckets(h),
	}
}

func RegisterBoundingBoxLabelRoutes(r *mux.Router, h *handler.Handler) {
	bblh := newBoundingBoxLabelHandler(h)

	routes := []Route{
		{"POST", "/projects/{projectID}/boundingboxlabels", bblh.CreateBoundingBoxLabelHandler},
		{"GET", "/projects/{projectID}/boundingboxlabels", bblh.LoadBoundingBoxLabelsHandler},
		{"DELETE", "/projects/{projectID}/boundingboxlabel/{boundingBoxLabelID}", bblh.DeleteBoundingBoxLabelHandler},
		{"PATCH", "/projects/{projectID}/boundingboxlabel/{boundingBoxLabelID}", bblh.UpdateBoundingBoxLabelHandler},
	}

	for _, rt := range routes {
		r.Handle(rt.pattern, h.AuthMw(http.HandlerFunc(rt.handlerFunc))).Methods(rt.method)
	}
}

func (h *BoundingBoxLabelHandler) UpdateBoundingBoxLabelHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	projectID := vars["projectID"]
	boundingBoxLabelID := vars["boundingBoxLabelID"]

	var req firestore.UpdateBoundingBoxLabelRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		log.Error().Err(err).Str("projectID", projectID).Msg("Invalid update bounding box label request")
		return
	}
	req.BoundingBoxLabelID = boundingBoxLabelID

	boundingBoxLabel, err := h.BoundingBoxLabelStore.GetBoundingBoxLabel(h.Ctx, req.BoundingBoxLabelID)
	if err != nil {
		http.Error(w, "Error getting bounding box label", http.StatusInternalServerError)
		log.Error().Err(err).Str("projectID", projectID).Msg("Error getting bounding box label")
		return
	}

	if boundingBoxLabel.ProjectID != projectID {
		http.Error(w, "Bounding Box Label not part of project", http.StatusBadRequest)
		log.Error().Err(err).Str("projectID", projectID).Msg("Bounding Box Label not part of project")
		return
	}

	err = h.BoundingBoxLabelStore.UpdateBoundingBoxLabelName(h.Ctx, req)
	if err != nil {
		http.Error(w, "Error updating bounding box label", http.StatusInternalServerError)
		log.Error().Err(err).Str("projectID", projectID).Msg("Error updating bounding box label")
		return
	}

	w.WriteHeader(http.StatusOK)
	log.Info().Str("boundingBoxLabelID", boundingBoxLabelID).Msg("Bounding box label updated successfully")
	if _, err := fmt.Fprintf(w, "Bounding box label %s updated", req.BoundingBoxLabelID); err != nil {
		log.Error().Err(err).Str("boundingBoxLabelID", boundingBoxLabelID).Msg("Error writing update bounding box label response")
	}
}

func (h *BoundingBoxLabelHandler) DeleteBoundingBoxLabelHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	projectID := vars["projectID"]
	boundingBoxLabelID := vars["boundingBoxLabelID"]

	boundingBoxLabel, err := h.BoundingBoxLabelStore.GetBoundingBoxLabel(h.Ctx, boundingBoxLabelID)
	if err != nil {
		http.Error(w, "Error getting bounding box label", http.StatusInternalServerError)
		log.Error().Err(err).Str("projectID", projectID).Msg("Error getting bounding box label")
		return
	}

	if boundingBoxLabel.ProjectID != projectID {
		http.Error(w, "Bounding Box Label not part of project", http.StatusBadRequest)
		log.Error().Err(err).Str("projectID", projectID).Msg("Bounding Box Label not part of project")
		return
	}

	err = h.BoundingBoxLabelStore.DeleteBoundingBoxLabel(h.Ctx, boundingBoxLabelID)
	if err != nil {
		http.Error(w, "Error deleting bounding box label", http.StatusInternalServerError)
		log.Error().Err(err).Str("projectID", projectID).Msg("Error deleting bounding box label")
		return
	}

	w.WriteHeader(http.StatusOK)
	log.Info().Str("boundingBoxLabelID", boundingBoxLabelID).Msg("Bounding box label deleted successfully")
	if _, err := fmt.Fprintf(w, "Bounding box label %s deleted", boundingBoxLabelID); err != nil {
		log.Error().Err(err).Str("boundingBoxLabelID", boundingBoxLabelID).Msg("Error writing delete bounding box label response")
	}
}

func (h *BoundingBoxLabelHandler) CreateBoundingBoxLabelHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	projectID := vars["projectID"]

	var req firestore.CreateBoundingBoxLabelRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		log.Error().Err(err).Str("projectID", projectID).Msg("Invalid create bounding box label request")
		return
	}

	// add projectID to request
	req.ProjectID = projectID
	boundingBoxLabelID, err := h.BoundingBoxLabelStore.CreateBoundingBoxLabel(h.Ctx, req)
	if err != nil {
		http.Error(w, "Error creating bounding box label", http.StatusInternalServerError)
		log.Error().Err(err).Str("projectID", projectID).Msg("Error creating bounding box label")
		return
	}

	w.WriteHeader(http.StatusCreated)
	log.Info().Str("boundingBoxLabelID", boundingBoxLabelID).Msg("Bounding box label created successfully")
	if _, err := fmt.Fprintf(w, "Bounding box label %s created", boundingBoxLabelID); err != nil {
		log.Error().Err(err).Str("boundingBoxLabelID", boundingBoxLabelID).Msg("Error writing create bounding box label response")
	}
}

func (h *BoundingBoxLabelHandler) LoadBoundingBoxLabelsHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	projectID := vars["projectID"]

	boundingBoxLabels, err := h.BoundingBoxLabelStore.GetBoundingBoxLabelsByProjectID(h.Ctx, projectID)
	if err != nil {
		http.Error(w, "Error loading bounding box labels", http.StatusInternalServerError)
		log.Error().Err(err).Str("projectID", projectID).Msg("Error loading bounding box labels")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	log.Info().Str("projectID", projectID).Msg("Loaded bounding box labels successfully")
	if err := json.NewEncoder(w).Encode(boundingBoxLabels); err != nil {
		log.Error().Err(err).Str("projectID", projectID).Msg("Error writing bounding box labels response")
	}
}
