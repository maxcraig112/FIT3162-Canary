package api

import (
	"net/http"
	"pkg/handler"

	"github.com/gorilla/mux"
)

type ExportHandler struct {
	*handler.Handler
	// These are embedded fields so you don't need to call .Stores to get the inner fields
	Stores
	Buckets
}

func newExportHandler(h *handler.Handler) *ExportHandler {
	return &ExportHandler{
		Handler: h,
		Stores:  InitialiseStores(h),
		Buckets: InitialiseBuckets(h),
	}
}

func RegisterExportRoutes(r *mux.Router, h *handler.Handler) {
	eh := newExportHandler(h)

	routes := []Route{
		// Get all images from a batch
		{"GET", "/project/{projectID}/keypoints/export/coco", eh.exportKeypointCOCOHandler},
	}

	for _, rt := range routes {
		wrapped := h.AuthMw(ValidateOwnershipMiddleware(http.HandlerFunc(rt.handlerFunc), eh.Stores))
		r.Handle(rt.pattern, wrapped).Methods(rt.method)
	}
}

func (h *ExportHandler) exportKeypointCOCOHandler(w http.ResponseWriter, r *http.Request) {

}
