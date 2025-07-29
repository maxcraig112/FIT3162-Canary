package handler

import (
	"context"
	"net/http"
	"pkg/gcp"
)

type Handler struct {
	Ctx     context.Context
	Clients *gcp.Clients
	AuthMw  func(http.Handler) http.Handler
}

func NewHandler(ctx context.Context, clients *gcp.Clients, authMW func(http.Handler) http.Handler) *Handler {
	return &Handler{Ctx: ctx, Clients: clients, AuthMw: authMW}
}
