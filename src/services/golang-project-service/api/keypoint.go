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

type KeypointHandler struct {
	*handler.Handler
	KeypointStore *firestore.KeypointStore
}

func newKeypointHandler(h *handler.Handler) *KeypointHandler {
	return &KeypointHandler{
		Handler:       h,
		KeypointStore: firestore.NewKeypointStore(h.Clients.Firestore),
	}
}

func RegisterKeypointRoutes(r *mux.Router, h *handler.Handler) {
	kh := newKeypointHandler(h)

	routes := []Route{
		{"POST", "/projects/{projectID}/images/{imageID}/keypoints", kh.CreateKeypointHandler},
		{"GET", "/projects/{projectID}/images/{imageID}/keypoints", kh.GetKeypointsByImageHandler},
		{"GET", "/projects/{projectID}/keypoints/{keypointID}", kh.GetKeypointHandler},
		{"PATCH", "/projects/{projectID}/keypoints/{keypointID}", kh.UpdateKeypointPositionHandler},
		{"DELETE", "/projects/{projectID}/keypoints/{keypointID}", kh.DeleteKeypointHandler},
	}

	for _, rt := range routes {
		r.Handle(rt.pattern, h.AuthMw(http.HandlerFunc(rt.handlerFunc))).Methods(rt.method)
	}
}

func (h *KeypointHandler) CreateKeypointHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	imageID := vars["imageID"]

	var req firestore.CreateKeypointRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		log.Error().Err(err).Msg("Invalid create keypoint request")
		return
	}

	req.ImageID = imageID

	id, err := h.KeypointStore.CreateKeypoint(h.Ctx, req)
	if err != nil {
		http.Error(w, "Error creating keypoint", http.StatusInternalServerError)
		log.Error().Err(err).Msg("Failed to create keypoint")
		return
	}

	w.WriteHeader(http.StatusCreated)
	log.Info().Str("keypointID", id).Msg("Keypoint created successfully")
	w.Write([]byte(fmt.Sprintf("Keypoint %s created", id)))
}

func (h *KeypointHandler) GetKeypointsByImageHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	imageID := vars["imageID"]

	keypoints, err := h.KeypointStore.GetKeypointsByImageID(h.Ctx, imageID)
	if err != nil {
		http.Error(w, "Error loading keypoints", http.StatusInternalServerError)
		log.Error().Err(err).Msg("Failed to load keypoints for image")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	log.Info().Str("imageID", imageID).Msg("Loaded keypoints successfully")
	json.NewEncoder(w).Encode(keypoints)
}

func (h *KeypointHandler) GetKeypointHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	keypointID := vars["keypointID"]

	kp, err := h.KeypointStore.GetKeypoint(h.Ctx, keypointID)
	if err != nil {
		http.Error(w, "Keypoint not found", http.StatusNotFound)
		log.Error().Err(err).Msg("Keypoint not found")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	log.Info().Str("keypointID", keypointID).Msg("Loaded keypoint successfully")
	json.NewEncoder(w).Encode(kp)
}

func (h *KeypointHandler) UpdateKeypointPositionHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	keypointID := vars["keypointID"]

	var req firestore.UpdateKeypointPositionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		log.Error().Err(err).Msg("Invalid update keypoint request")
		return
	}
	req.KeypointID = keypointID

	if err := h.KeypointStore.UpdateKeypointPosition(h.Ctx, req); err != nil {
		http.Error(w, "Error updating keypoint", http.StatusInternalServerError)
		log.Error().Err(err).Msg("Failed to update keypoint position")
		return
	}

	w.WriteHeader(http.StatusOK)
	log.Info().Str("keypointID", keypointID).Msg("Keypoint position updated successfully")
	w.Write([]byte("Keypoint position updated"))
}

func (h *KeypointHandler) DeleteKeypointHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	keypointID := vars["keypointID"]

	if err := h.KeypointStore.DeleteKeypoint(h.Ctx, keypointID); err != nil {
		http.Error(w, "Error deleting keypoint", http.StatusInternalServerError)
		log.Error().Err(err).Msg("Failed to delete keypoint")
		return
	}

	w.WriteHeader(http.StatusOK)
	log.Info().Str("keypointID", keypointID).Msg("Keypoint deleted successfully")
	w.Write([]byte("Keypoint deleted"))
}
