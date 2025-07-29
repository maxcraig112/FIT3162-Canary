package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"pkg/handler"
	"project-service/firestore"

	"github.com/gorilla/mux"
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
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(projects)
}

func (h *ProjectHandler) CreateProjectHandler(w http.ResponseWriter, r *http.Request) {
	var req firestore.CreateProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	projectID, err := h.ProjectStore.CreateProject(h.Ctx, req)
	if err != nil {
		http.Error(w, "Error creating project", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	w.Write([]byte(fmt.Sprintf("Project %s created", projectID)))
}

func (h *ProjectHandler) RenameProjectHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	projectID := vars["projectID"]

	var req firestore.RenameProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	err := h.ProjectStore.RenameProject(h.Ctx, projectID, req)
	if err != nil {
		http.Error(w, "Error renaming project", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(fmt.Sprintf("Project %s named to %s", projectID, req.NewProjectName)))
}

func (h *ProjectHandler) DeleteProjectHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	projectID := vars["projectID"]

	err := h.ProjectStore.DeleteProject(h.Ctx, projectID)
	if err != nil {
		http.Error(w, "Error deleting project", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(fmt.Sprintf("Project %s deleted", projectID)))
}

func (h *ProjectHandler) UpdateNumberOfFilesHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	projectID := vars["projectID"]

	var req firestore.IncrementQuantityRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	newVal, err := h.ProjectStore.IncrementNumberOfFiles(h.Ctx, projectID, req)
	if err != nil {
		http.Error(w, fmt.Sprintf("Error updating number of files for project %s", projectID), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, "Project: %s numberOfFiles: %d", projectID, newVal)
}

func (h *ProjectHandler) UpdateSettingsHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	projectID := vars["projectID"]

	var req firestore.ProjectSettings
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	settings, err := h.ProjectStore.UpdateProjectSettings(h.Ctx, projectID, req)
	if err != nil {
		http.Error(w, fmt.Sprintf("Error updating project %s settings", projectID), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(settings)
}
