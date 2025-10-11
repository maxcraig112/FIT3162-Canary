package api

import (
	"context"
	"net/http"
	"pkg/jwt"

	"github.com/gorilla/mux"
	"github.com/rs/zerolog/log"
)

// Resolver looks up a projectID given some other ID
type Resolver func(ctx context.Context, id string, stores Stores) (string, error)

// matches the key in the URL with a function that returns the projectID associated with it
var resolvers = map[string]Resolver{
	"projectID": func(ctx context.Context, id string, stores Stores) (string, error) {
		return id, nil
	},
	"batchID": func(ctx context.Context, id string, stores Stores) (string, error) {
		batch, err := stores.BatchStore.GetBatch(ctx, id)
		if err != nil {
			return "", err
		}
		return batch.ProjectID, nil
	},
	"imageID": func(ctx context.Context, id string, stores Stores) (string, error) {
		image, err := stores.ImageStore.GetImage(ctx, id)
		if err != nil {
			return "", err
		}
		batch, err := stores.BatchStore.GetBatch(ctx, image.BatchID)
		if err != nil {
			return "", err
		}
		return batch.ProjectID, nil
	},
}

// ValidateOwnershipMiddleware runs before the API routes and validates that the resource
// trying to be access is owned by the userID specified in the JWT
func ValidateOwnershipMiddleware(next http.Handler, stores Stores) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Begin ownership validation
		vars := mux.Vars(r)

		userID, err := jwt.GetUserIDFromJWT(r)
		if err != nil {
			log.Warn().Err(err).Msg("ValidateOwnershipMiddleware: unauthorized - invalid/missing JWT")
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		for key, resolver := range resolvers {
			if id, ok := vars[key]; ok && id != "*" {
				projectID, err := resolver(r.Context(), id, stores)
				if err != nil {
					log.Error().Err(err).Str("key", key).Str("id", id).Msg("ValidateOwnershipMiddleware: failed to resolve projectID")
					http.Error(w, "Forbidden", http.StatusForbidden)
					return
				}

				project, err := stores.ProjectStore.GetProject(r.Context(), projectID)
				if err != nil || project.UserID != userID {
					if err != nil {
						log.Warn().Err(err).Str("projectID", projectID).Msg("ValidateOwnershipMiddleware: ownership fetch failed; attempting session fallback")
					}

					if r.Method == http.MethodGet || r.Method == http.MethodHead {
						// Use only X-Session-Id header for collaborative access.
						sessionID := r.Header.Get("X-Session-Id")
						if sessionID != "" {
							session, sErr := stores.SessionStore.GetSession(r.Context(), sessionID)
							if sErr == nil && session != nil {
								// Validate project match and check if user is owner or member
								if session.ProjectID == projectID {
									// Check if user is the session owner
									if session.Owner.ID == userID {
										log.Info().Str("userID", userID).Str("projectID", projectID).Str("sessionID", sessionID).Msg("ValidateOwnershipMiddleware: authorized via session ownership")
										break
									}
									// Check if user is a session member
									for _, member := range session.Members {
										if member.ID == userID {
											log.Info().Str("userID", userID).Str("projectID", projectID).Str("sessionID", sessionID).Msg("ValidateOwnershipMiddleware: authorized via session membership")
											// Set a flag or use goto to break out of the main resolver loop
											goto authorized
										}
									}
								}
							} else if sErr != nil {
								log.Debug().Err(sErr).Str("sessionID", sessionID).Msg("ValidateOwnershipMiddleware: session fetch failed")
							}
						}
					}

					if project == nil || project.UserID != userID {
						log.Warn().Str("userID", userID).Str("projectID", projectID).Msg("ValidateOwnershipMiddleware: user does not own project")
						http.Error(w, "Forbidden", http.StatusForbidden)
						return
					}
				}
			authorized:
				break
			}
		}
		next.ServeHTTP(w, r)
	})
}
