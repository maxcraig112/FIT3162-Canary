package firestore

import (
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// ErrNotFound is returned when a document is not found.
var ErrNotFound = status.Error(codes.NotFound, "document not found")

// ErrAlreadyExists is returned when a document already exists.
var ErrAlreadyExists = status.Error(codes.AlreadyExists, "document already exists")
