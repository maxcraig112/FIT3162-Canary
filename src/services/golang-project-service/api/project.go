package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"pkg/gcp"
	"project-service/firestore"

	"github.com/gorilla/mux"
)

func RegisterProjectRoutes(ctx context.Context, r *mux.Router, clients *gcp.Clients, authMw func(http.Handler) http.Handler) {
	routes := []route{
		{"GET", "/projects/{userID}", func(w http.ResponseWriter, r *http.Request) {
			LoadProjectsHandler(ctx, w, r, clients)
		}},
		{"POST", "/projects", func(w http.ResponseWriter, r *http.Request) {
			CreateProjectHandler(ctx, w, r, clients)
		}},
		{"PUT", "/projects/{projectID}", func(w http.ResponseWriter, r *http.Request) {
			RenameProjectHandler(ctx, w, r, clients)
		}},
		{"DELETE", "/projects/{projectID}", func(w http.ResponseWriter, r *http.Request) {
			DeleteProjectHandler(ctx, w, r, clients)
		}},
		{"PATCH", "/projects/{projectID}/numberoffiles", func(w http.ResponseWriter, r *http.Request) {
			UpdateNumberOfFilesHandler(ctx, w, r, clients)
		}},
		{"GET", "/projects/{projectID}/batches", func(w http.ResponseWriter, r *http.Request) {
			LoadBatchInfoHandler(ctx, w, r, clients)
		}},
	}

	for _, rt := range routes {
		r.Handle(rt.pattern, authMw(rt.handlerFunc)).Methods(rt.method)
	}
}

func LoadProjectsHandler(ctx context.Context, w http.ResponseWriter, r *http.Request, clients *gcp.Clients) {
	vars := mux.Vars(r)
	userID := vars["userID"]

	projectStore := firestore.NewProjectStore(clients.Firestore)
	projects, err := projectStore.GetProjectsByUserID(ctx, userID)
	if err != nil {
		http.Error(w, "Error getting projects", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(projects)
}

func CreateProjectHandler(ctx context.Context, w http.ResponseWriter, r *http.Request, clients *gcp.Clients) {
	var req firestore.CreateProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	projectStore := firestore.NewProjectStore(clients.Firestore)
	projectID, err := projectStore.CreateProject(ctx, req)
	if err != nil {
		http.Error(w, "Error creating project", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	w.Write([]byte(fmt.Sprintf("Project %s created", projectID)))
}

func RenameProjectHandler(ctx context.Context, w http.ResponseWriter, r *http.Request, clients *gcp.Clients) {
	vars := mux.Vars(r)
	projectID := vars["projectID"]

	var req firestore.RenameProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	projectStore := firestore.NewProjectStore(clients.Firestore)
	err := projectStore.RenameProject(ctx, projectID, req)

	if err != nil {
		http.Error(w, "Error renaming project", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(fmt.Sprintf("Project %s named to %s", projectID, req.NewProjectName)))
}

func DeleteProjectHandler(ctx context.Context, w http.ResponseWriter, r *http.Request, clients *gcp.Clients) {
	vars := mux.Vars(r)
	projectID := vars["projectID"]

	projectStore := firestore.NewProjectStore(clients.Firestore)
	err := projectStore.DeleteProject(ctx, projectID)

	if err != nil {
		http.Error(w, "Error deleting project", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(fmt.Sprintf("Project %s deleted", projectID)))
}

func UpdateNumberOfFilesHandler(ctx context.Context, w http.ResponseWriter, r *http.Request, clients *gcp.Clients) {
	vars := mux.Vars(r)
	projectID := vars["projectID"]

	var req firestore.UpdateNumberOfFilesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	projectStore := firestore.NewProjectStore(clients.Firestore)
	newVal, err := projectStore.IncrementNumberOfFiles(ctx, projectID, req)
	if err != nil {
		http.Error(w, fmt.Sprintf("Error updating number of files for project %s", projectID), http.StatusInternalServerError)
	}

	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, "Project: %s numberOfFiles: %d", projectID, newVal)
}
