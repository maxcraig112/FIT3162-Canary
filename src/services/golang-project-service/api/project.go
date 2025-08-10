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

type ProjectHandler struct {
	*handler.Handler
	ProjectStore *firestore.ProjectStore
}

func newProjectHandler(h *handler.Handler) *ProjectHandler {
	return &ProjectHandler{
		Handler:      h,
		ProjectStore: firestore.NewProjectStore(h.Clients.Firestore),
	}
}

func RegisterProjectRoutes(r *mux.Router, h *handler.Handler) {
	ph := newProjectHandler(h)

	routes := []Route{
		// Get all projects owned by a user
		{"GET", "/projects/{userID}", ph.LoadProjectsHandler},
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
	userID := vars["userID"]

	projects, err := h.ProjectStore.GetProjectsByUserID(h.Ctx, userID)
	if err != nil {
		http.Error(w, "Error getting projects", http.StatusInternalServerError)
		log.Error().Str("userID", userID).Err(err).Msg("Failed to get projects by User ID")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	log.Info().Str("userID", userID).Msg("Successfully returned projects by User ID")
	json.NewEncoder(w).Encode(projects)
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

	w.WriteHeader(http.StatusCreated)
	log.Info().Str("projectID", projectID).Msg("Project created successfully")
	fmt.Fprintf(w, "Project %s created", projectID)
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

	w.WriteHeader(http.StatusOK)
	log.Info().Str("projectID", projectID).Str("newName", req.NewProjectName).Msg("Project renamed successfully")
	fmt.Fprintf(w, "Project %s renamed to %s", projectID, req.NewProjectName)
}

func (h *ProjectHandler) DeleteProjectHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	projectID := vars["projectID"]

	err := h.ProjectStore.DeleteProject(h.Ctx, projectID)
	if err != nil {
		http.Error(w, "Error deleting project", http.StatusInternalServerError)
		log.Error().Err(err).Str("projectID", projectID).Msg("Error deleting project")
		return
	}

	w.WriteHeader(http.StatusOK)
	log.Info().Str("projectID", projectID).Msg("Project deleted successfully")
	fmt.Fprintf(w, "Project %s deleted", projectID)
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

	w.WriteHeader(http.StatusOK)
	log.Info().Str("projectID", projectID).Int64("newNumberOfFiles", newVal).Msg("Updated number of files successfully")
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
