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

	switch err {
	case nil:
		break
	case firestore.ErrSameProjectName:
		http.Error(w, firestore.ErrSameProjectName.Error(), http.StatusBadRequest)
		return
	case firestore.ErrProjectNotFound:
		http.Error(w, firestore.ErrSameProjectName.Error(), http.StatusBadRequest)
		return
	default:
		http.Error(w, "Error renaming project", http.StatusInternalServerError)
		return
	}

	if err != nil {
		http.Error(w, "Error renaming project", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	w.Write([]byte(fmt.Sprintf("Project %s named to %s", projectID, req.NewProjectName)))
}

func DeleteProjectHandler(ctx context.Context, w http.ResponseWriter, r *http.Request, clients *gcp.Clients) {
	vars := mux.Vars(r)
	projectID := vars["projectID"]

	projectStore := firestore.NewProjectStore(clients.Firestore)
	err := projectStore.DeleteProject(ctx, projectID)

	switch err {
	case nil:
		break
	case firestore.ErrProjectNotFound:
		http.Error(w, firestore.ErrSameProjectName.Error(), http.StatusBadRequest)
		return
	default:
		http.Error(w, "Error renaming project", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	w.Write([]byte(fmt.Sprintf("Project %s deleted", projectID)))
}
