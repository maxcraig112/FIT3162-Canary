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
		// {"GET", "/projects/{projectID}/keypointlabels", klh.LoadKeypointLabelsHandler},
		// {"GET", "/projects/{projectID}/keypointlabels", klh.LoadKeypointLabelsHandler},
		// // Get all projects owned by a user
		// {"GET", "/projects/{userID}", ph.LoadKeypointLabelsHandler},
		// // Create a project
		// {"POST", "/projects", ph.CreateKeypointLabelHandler},
		// // Update the name of the project
		// {"PUT", "/projects/{projectID}", ph.RenameKeypointLabelHandler},
		// // Delete a project
		// {"DELETE", "/projects/{projectID}", ph.DeleteKeypointLabelHandler},
		// // Increment the number of files a project has
		// {"PATCH", "/projects/{projectID}/numberoffiles", ph.UpdateNumberOfFilesHandler},
		// // Update project settings
		// {"PATCH", "/projects/{projectID}/settings", ph.UpdateSettingsHandler},
	}

	for _, rt := range routes {
		r.Handle(rt.pattern, h.AuthMw(http.HandlerFunc(rt.handlerFunc))).Methods(rt.method)
	}
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
