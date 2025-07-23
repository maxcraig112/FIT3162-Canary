package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"pkg/handler"
	"project-service/firestore"

	"github.com/gorilla/mux"
)

type BatchHandler struct {
	*handler.Handler
	BatchStore *firestore.BatchStore
}

func newBatchHandler(h *handler.Handler) *BatchHandler {
	return &BatchHandler{
		Handler:    h,
		BatchStore: firestore.NewBatchStore(h.Clients.Firestore),
	}
}

func RegisterBatchRoutes(r *mux.Router, h *handler.Handler) {
	bh := newBatchHandler(h)

	routes := []route{
		{"POST", "/batch", bh.CreateBatchHandler},
		{"PUT", "/batch/{batchID}", bh.RenameBatchHandler},
		{"DELETE", "/batch/{batchID}", bh.DeleteBatchHandler},
		{"GET", "/projects/{projectID}/batches", bh.LoadBatchInfoHandler},
	}

	for _, rt := range routes {
		r.Handle(rt.pattern, h.AuthMw(http.HandlerFunc(rt.handlerFunc))).Methods(rt.method)
	}
}

func (h *BatchHandler) LoadBatchInfoHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	projectID := vars["projectID"]

	batches, err := h.BatchStore.GetBatchesByProjectID(h.Ctx, projectID)
	if err != nil {
		http.Error(w, "Error getting batches", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(batches)
}

func (h *BatchHandler) CreateBatchHandler(w http.ResponseWriter, r *http.Request) {
	var req firestore.CreateBatchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	batchID, err := h.BatchStore.CreateBatch(h.Ctx, req)
	if err != nil {
		http.Error(w, "Error creating batch", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	w.Write([]byte(fmt.Sprintf("Batch %s created", batchID)))
}

func (h *BatchHandler) RenameBatchHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	batchID := vars["batchID"]

	var req firestore.RenameBatchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	err := h.BatchStore.RenameBatch(h.Ctx, batchID, req)
	if err != nil {
		http.Error(w, "Error renaming batch", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(fmt.Sprintf("Batch %s named to %s", batchID, req.NewBatchName)))
}

func (h *BatchHandler) DeleteBatchHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	batchID := vars["batchID"]

	err := h.BatchStore.DeleteBatch(h.Ctx, batchID)
	if err != nil {
		http.Error(w, "Error deleting batch", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(fmt.Sprintf("Batch %s deleted", batchID)))
}
