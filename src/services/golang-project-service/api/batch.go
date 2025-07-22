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

func RegisterBatchRoutes(ctx context.Context, r *mux.Router, clients *gcp.Clients, authMw func(http.Handler) http.Handler) {
	routes := []route{
		{"POST", "/batch", func(w http.ResponseWriter, r *http.Request) {
			CreateBatchHandler(ctx, w, r, clients)
		}},
		{"PUT", "/batch/{batchID}", func(w http.ResponseWriter, r *http.Request) {
			RenameBatchHandler(ctx, w, r, clients)
		}},
		{"DELETE", "/batch/{batchID}", func(w http.ResponseWriter, r *http.Request) {
			DeleteBatchHandler(ctx, w, r, clients)
		}},
	}

	for _, rt := range routes {
		r.Handle(rt.pattern, authMw(rt.handlerFunc)).Methods(rt.method)
	}
}

func LoadBatchInfoHandler(ctx context.Context, w http.ResponseWriter, r *http.Request, clients *gcp.Clients) {
	vars := mux.Vars(r)
	projectID := vars["projectID"]

	batchStore := firestore.NewBatchStore(clients.Firestore)
	batches, err := batchStore.GetBatchesByProjectID(ctx, projectID)
	if err != nil {
		http.Error(w, "Error getting projects", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(batches)
}

func CreateBatchHandler(ctx context.Context, w http.ResponseWriter, r *http.Request, clients *gcp.Clients) {
	var req firestore.CreateBatchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	batchStore := firestore.NewBatchStore(clients.Firestore)
	batcheID, err := batchStore.CreateBatch(ctx, req)
	if err != nil {
		http.Error(w, "Error creating batch", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	w.Write([]byte(fmt.Sprintf("Batch %s created", batcheID)))
}

func RenameBatchHandler(ctx context.Context, w http.ResponseWriter, r *http.Request, clients *gcp.Clients) {
	vars := mux.Vars(r)
	batchID := vars["batchID"]

	var req firestore.RenameBatchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	batchStore := firestore.NewBatchStore(clients.Firestore)
	err := batchStore.RenameBatch(ctx, batchID, req)

	if err != nil {
		http.Error(w, "Error renaming batch", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(fmt.Sprintf("Batch %s named to %s", batchID, req.NewBatchName)))
}

func DeleteBatchHandler(ctx context.Context, w http.ResponseWriter, r *http.Request, clients *gcp.Clients) {
	vars := mux.Vars(r)
	batchID := vars["batchID"]

	batchStore := firestore.NewBatchStore(clients.Firestore)
	err := batchStore.DeleteBatch(ctx, batchID)

	if err != nil {
		http.Error(w, "Error deleting batch", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(fmt.Sprintf("Batch %s deleted", batchID)))
}
