package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"pkg/handler"
	"pkg/jwt"
	bk "project-service/bucket"
	"project-service/firestore"

	"github.com/gorilla/mux"
	"github.com/rs/zerolog/log"
)

type ProjectHandler struct {
	*handler.Handler
	ProjectStore     *firestore.ProjectStore
	BatchStore       *firestore.BatchStore
	ImageStore       *firestore.ImageStore
	ImageBucket      *bk.ImageBucket
	KeypointStore    *firestore.KeypointStore
	BoundingBoxStore *firestore.BoundingBoxStore
}

func newProjectHandler(h *handler.Handler) *ProjectHandler {
	return &ProjectHandler{
		Handler:          h,
		ProjectStore:     firestore.NewProjectStore(h.Clients.Firestore),
		BatchStore:       firestore.NewBatchStore(h.Clients.Firestore),
		ImageStore:       firestore.NewImageStore(h.Clients.Firestore),
		ImageBucket:      bk.NewImageBucket(h.Clients.Bucket),
		KeypointStore:    firestore.NewKeypointStore(h.Clients.Firestore),
		BoundingBoxStore: firestore.NewBoundingBoxStore(h.Clients.Firestore),
	}
}

func RegisterProjectRoutes(r *mux.Router, h *handler.Handler) {
	ph := newProjectHandler(h)

	routes := []Route{
		// Get all projects owned by a user
		{"GET", "/projects/{projectID}", ph.LoadProjectsHandler},
		// Create a project
		{"POST", "/projects", ph.CreateProjectHandler},
		// Update the name of the project
		{"PUT", "/projects/{projectID}", ph.RenameProjectHandler},
		// Delete a project
		{"DELETE", "/projects/{projectID}", ph.DeleteProjectHandler},
		// Increment the number of files a project has
		{"PATCH", "/projects/{projectID}/numberoffiles", ph.UpdateNumberOfFilesHandler},
		// Update project settings
		{"PATCH", "/projects/{projectID}/settings", ph.UpdateSettingsHandler},
	}

	for _, rt := range routes {
		r.Handle(rt.pattern, h.AuthMw(http.HandlerFunc(rt.handlerFunc))).Methods(rt.method)
	}
}

func (h *ProjectHandler) LoadProjectsHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	projectID := vars["projectID"]
	userID, err := jwt.GetUserIDFromJWT(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		log.Error().Err(err).Msg("Failed to get userID from JWT")
		return
	}

	// if wildcard, return all projectID
	if projectID == "*" {
		projects, err := h.ProjectStore.GetProjectsByUserID(h.Ctx, userID)
		if err != nil {
			http.Error(w, "Error getting projects", http.StatusInternalServerError)
			log.Error().Str("projectID", projectID).Err(err).Msg("Failed to get projects by Project ID")
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		log.Info().Str("userID", userID).Msg("Successfully returned projects by User ID")
		json.NewEncoder(w).Encode(projects)
		return
	} else {
		project, err := h.ProjectStore.GetProject(h.Ctx, projectID, userID)
		if err != nil {
			http.Error(w, "Error getting project", http.StatusInternalServerError)
			log.Error().Str("projectID", projectID).Err(err).Msg("Failed to get project by Project ID")
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		log.Info().Str("projectID", projectID).Msg("Successfully returned project with Project ID")
		json.NewEncoder(w).Encode(project)
	}

}

func (h *ProjectHandler) CreateProjectHandler(w http.ResponseWriter, r *http.Request) {
	var req firestore.CreateProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		log.Error().Err(err).Msg("Invalid create project request")
		return
	}

	projectID, err := h.ProjectStore.CreateProject(h.Ctx, req)
	if err != nil {
		http.Error(w, "Error creating project", http.StatusInternalServerError)
		log.Error().Err(err).Msg("Error creating project")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	log.Info().Str("projectID", projectID).Msg("Project created successfully")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"projectID": projectID,
		"message":   "Project created",
		"created":   true,
	})
}

func (h *ProjectHandler) RenameProjectHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	projectID := vars["projectID"]

	var req firestore.RenameProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		log.Error().Err(err).Str("projectID", projectID).Msg("Invalid rename project request")
		return
	}

	err := h.ProjectStore.RenameProject(h.Ctx, projectID, req)
	if err != nil {
		http.Error(w, "Error renaming project", http.StatusInternalServerError)
		log.Error().Err(err).Str("projectID", projectID).Msg("Error renaming project")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	log.Info().Str("projectID", projectID).Str("newName", req.NewProjectName).Msg("Project renamed successfully")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"projectID": projectID,
		"newName":   req.NewProjectName,
		"message":   "Project renamed",
	})
}

func (h *ProjectHandler) DeleteProjectHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	projectID := vars["projectID"]
	// 1) Get batches under this project
	batches, err := h.BatchStore.GetBatchesByProjectID(h.Ctx, projectID)
	if err != nil {
		http.Error(w, "Error deleting project", http.StatusInternalServerError)
		log.Error().Err(err).Str("projectID", projectID).Msg("Error listing batches during project delete")
		return
	}

	// 2) For each batch, delete images (bucket + firestore), and any annotations
	allImageIDs := make([]string, 0, 64)
	for _, b := range batches {
		// list images for annotation deletion later
		imgs, err := h.ImageStore.GetImagesByBatchID(h.Ctx, b.BatchID)
		if err != nil {
			http.Error(w, "Error deleting project: list images", http.StatusInternalServerError)
			log.Error().Err(err).Str("projectID", projectID).Str("batchID", b.BatchID).Msg("Error listing images for batch during project delete")
			return
		}
		for _, img := range imgs {
			allImageIDs = append(allImageIDs, img.ImageID)
		}
		// delete images in bucket
		if err := h.ImageBucket.DeleteImagesByBatchID(h.Ctx, b.BatchID); err != nil {
			http.Error(w, "Error deleting project images", http.StatusInternalServerError)
			log.Error().Err(err).Str("projectID", projectID).Str("batchID", b.BatchID).Msg("Error deleting images in bucket for batch")
			return
		}
		// delete image metadata in firestore
		if err := h.ImageStore.DeleteImagesByBatchID(h.Ctx, b.BatchID); err != nil {
			http.Error(w, "Error deleting project images metadata", http.StatusInternalServerError)
			log.Error().Err(err).Str("projectID", projectID).Str("batchID", b.BatchID).Msg("Error deleting images metadata for batch")
			return
		}
	}

	// 2b) Delete annotations associated with those images (keypoints, bounding boxes)
	if len(allImageIDs) > 0 {
		if err := h.KeypointStore.DeleteKeypointsByImageIDs(h.Ctx, allImageIDs); err != nil {
			http.Error(w, "Error deleting project keypoints", http.StatusInternalServerError)
			log.Error().Err(err).Str("projectID", projectID).Msg("Error deleting keypoints for project images")
			return
		}
		if err := h.BoundingBoxStore.DeleteBoundingBoxesByImageIDs(h.Ctx, allImageIDs); err != nil {
			http.Error(w, "Error deleting project bounding boxes", http.StatusInternalServerError)
			log.Error().Err(err).Str("projectID", projectID).Msg("Error deleting bounding boxes for project images")
			return
		}
	}

	// 3) Delete all batches for this project
	if err := h.BatchStore.DeleteAllBatches(h.Ctx, projectID); err != nil {
		http.Error(w, "Error deleting project batches", http.StatusInternalServerError)
		log.Error().Err(err).Str("projectID", projectID).Msg("Error deleting batches for project")
		return
	}

	// 4) Delete the project itself
	err = h.ProjectStore.DeleteProject(h.Ctx, projectID)
	if err != nil {
		http.Error(w, "Error deleting project", http.StatusInternalServerError)
		log.Error().Err(err).Str("projectID", projectID).Msg("Error deleting project")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	log.Info().Str("projectID", projectID).Msg("Project deleted successfully")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"projectID": projectID,
		"deleted":   true,
		"message":   "Project deleted",
	})
}

func (h *ProjectHandler) UpdateNumberOfFilesHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	projectID := vars["projectID"]

	var req firestore.IncrementQuantityRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		log.Error().Err(err).Str("projectID", projectID).Msg("Invalid update number of files request")
		return
	}

	newVal, err := h.ProjectStore.IncrementNumberOfFiles(h.Ctx, projectID, req)
	if err != nil {
		http.Error(w, fmt.Sprintf("Error updating number of files for project %s", projectID), http.StatusInternalServerError)
		log.Error().Err(err).Str("projectID", projectID).Msg("Error updating number of files")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	log.Info().Str("projectID", projectID).Int64("newNumberOfFiles", newVal).Msg("Updated number of files successfully")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"projectID":     projectID,
		"numberOfFiles": newVal,
		"message":       "Updated numberOfFiles",
	})
}

func (h *ProjectHandler) UpdateSettingsHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	projectID := vars["projectID"]

	var req firestore.ProjectSettings
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		log.Error().Err(err).Str("projectID", projectID).Msg("Invalid update settings request")
		return
	}

	settings, err := h.ProjectStore.UpdateProjectSettings(h.Ctx, projectID, req)
	if err != nil {
		http.Error(w, fmt.Sprintf("Error updating project %s settings", projectID), http.StatusInternalServerError)
		log.Error().Err(err).Str("projectID", projectID).Msg("Error updating project settings")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	log.Info().Str("projectID", projectID).Msg("Updated project settings successfully")
	json.NewEncoder(w).Encode(settings)
}
