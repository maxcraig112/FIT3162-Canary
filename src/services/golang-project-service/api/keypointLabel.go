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

type KeypointLabelHandler struct {
	*handler.Handler
	KeypointLabelStore *firestore.KeypointLabelStore
}

func newKeypointLabelHandler(h *handler.Handler) *KeypointLabelHandler {
	return &KeypointLabelHandler{
		Handler:            h,
		KeypointLabelStore: firestore.NewKeypointLabelStore(h.Clients.Firestore),
	}
}

func RegisterKeypointLabelRoutes(r *mux.Router, h *handler.Handler) {
	klh := newKeypointLabelHandler(h)

	routes := []Route{
		{"POST", "/projects/{projectID}/keypointlabels", klh.CreateKeypointLabelHandler},
		{"GET", "/projects/{projectID}/keypointlabels", klh.LoadKeypointLabelsHandler},
		{"DELETE", "/projects/{projectID}/keypointlabel/{keypointLabelID}", klh.DeleteKeypointLabelHandler},
		{"PATCH", "/projects/{projectID}/keypointlabel/{keypointLabelID}", klh.UpdateKeypointLabelHandler},
	}

	for _, rt := range routes {
		r.Handle(rt.pattern, h.AuthMw(http.HandlerFunc(rt.handlerFunc))).Methods(rt.method)
	}
}

func (h *KeypointLabelHandler) UpdateKeypointLabelHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	projectID := vars["projectID"]
	keypointLabelID := vars["keypointLabelID"]

	var req firestore.UpdateKeypointLabelRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		log.Error().Err(err).Str("projectID", projectID).Msg("Invalid update keypoint label request")
		return
	}
	req.KeypointLabelID = keypointLabelID

	keypointLabel, err := h.KeypointLabelStore.GetKeypointLabel(h.Ctx, req.KeypointLabelID)
	if err != nil {
		http.Error(w, "Error getting keypoint label", http.StatusInternalServerError)
		log.Error().Err(err).Str("projectID", projectID).Msg("Error getting keypoint label")
		return
	}

	if keypointLabel.ProjectID != projectID {
		http.Error(w, "Keypoint Label not part of project", http.StatusBadRequest)
		log.Error().Err(err).Str("projectID", projectID).Msg("Keypoint Label not part of project")
		return
	}

	err = h.KeypointLabelStore.UpdateKeypointLabelName(h.Ctx, req)
	if err != nil {
		http.Error(w, "Error updating keypoint label", http.StatusInternalServerError)
		log.Error().Err(err).Str("projectID", projectID).Msg("Error updating keypoint label")
		return
	}

	w.WriteHeader(http.StatusOK)
	log.Info().Str("keypointLabelID", keypointLabelID).Msg("Keypoint label updated successfully")
	w.Write([]byte(fmt.Sprintf("Keypoint label %s updated", req.KeypointLabelID)))

}

func (h *KeypointLabelHandler) DeleteKeypointLabelHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	projectID := vars["projectID"]
	keypointLabelID := vars["keypointLabelID"]

	keypointLabel, err := h.KeypointLabelStore.GetKeypointLabel(h.Ctx, keypointLabelID)
	if err != nil {
		http.Error(w, "Error getting keypoint label", http.StatusInternalServerError)
		log.Error().Err(err).Str("projectID", projectID).Msg("Error getting keypoint label")
		return
	}

	if keypointLabel.ProjectID != projectID {
		http.Error(w, "Keypoint Label not part of project", http.StatusBadRequest)
		log.Error().Err(err).Str("projectID", projectID).Msg("Keypoint Label not part of project")
		return
	}

	err = h.KeypointLabelStore.DeleteKeypointLabel(h.Ctx, keypointLabelID)
	if err != nil {
		http.Error(w, "Error deleting keypoint label", http.StatusInternalServerError)
		log.Error().Err(err).Str("projectID", projectID).Msg("Error deleting keypoint label")
		return
	}

	w.WriteHeader(http.StatusOK)
	log.Info().Str("keypointLabelID", keypointLabelID).Msg("Keypoint label deleted successfully")
	w.Write([]byte(fmt.Sprintf("Keypoint label %s deleted", keypointLabelID)))
}

func (h *KeypointLabelHandler) CreateKeypointLabelHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	projectID := vars["projectID"]

	var req firestore.CreateKeypointLabelRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		log.Error().Err(err).Str("projectID", projectID).Msg("Invalid create keypoint label request")
		return
	}

	// add projectID to request
	req.ProjectID = projectID
	keypointLabelID, err := h.KeypointLabelStore.CreateKeypointLabel(h.Ctx, req)
	if err != nil {
		http.Error(w, "Error creating keypoint label", http.StatusInternalServerError)
		log.Error().Err(err).Str("projectID", projectID).Msg("Error creating keypoint label")
		return
	}

	w.WriteHeader(http.StatusCreated)
	log.Info().Str("keypointLabelID", keypointLabelID).Msg("Keypoint label created successfully")
	w.Write([]byte(fmt.Sprintf("Keypoint label %s created", keypointLabelID)))
}

func (h *KeypointLabelHandler) LoadKeypointLabelsHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	projectID := vars["projectID"]

	keypointLabels, err := h.KeypointLabelStore.GetKeypointLabelsByProjectID(h.Ctx, projectID)
	if err != nil {
		http.Error(w, "Error loading keypoint labels", http.StatusInternalServerError)
		log.Error().Err(err).Str("projectID", projectID).Msg("Error loading keypoint labels")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	log.Info().Str("projectID", projectID).Msg("Loaded keypoint labels successfully")
	json.NewEncoder(w).Encode(keypointLabels)
}
