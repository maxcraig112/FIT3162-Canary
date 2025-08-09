package websocket

import (
	"context"
	"time"

	"github.com/rs/zerolog/log"
)

func (h *WebSocketHub) startWebhookWriter(ctx context.Context, c *Client, role, sessionID string) error {
	go func() {
		// The purpose of this ticker is to ensure that the websocket isn't closed by being idle.
		ticker := time.NewTicker(10 * time.Second)

		// defer occurs when a websocket connection is closed
		defer func() {
			ticker.Stop()
			_ = c.conn.Close()
			select {
			case <-c.out:
				// already closed
			default:
				close(c.out)
			}
			// Trigger leave hooks based on role
			switch role {
			case "owner":
				// mark session as terminating to avoid per-member removal spam
				h.markTerminating(sessionID)
				h.handlerOwnerLeft(sessionID)
				// after owner cleanup, clear terminating flag
				h.mu.Lock()
				delete(h.TerminatingSessions, sessionID)
				h.mu.Unlock()
			case "member":
				// if owner is currently terminating the session, skip member-left logic
				if h.isTerminating(sessionID) {
					break
				}
				h.handlerMemberLeft(sessionID, c.id)
			}
			log.Info().Str("sessionID", sessionID).Str("role", role).Str("userID", c.id).Msg("ws disconnected")
		}()

		log.Info().Str("sessionID", sessionID).Str("role", role).Str("userID", c.id).Msg("ws connected")

		for {
			select {
			case t := <-ticker.C:
				// periodic keepalive
				msg := map[string]any{"type": "keepalive", "role": role, "sessionID": sessionID, "time": t.UTC().Format(time.RFC3339)}
				if err := c.conn.WriteJSON(msg); err != nil {
					log.Info().Err(err).Str("sessionID", sessionID).Msg("write failed; closing")
					return
				}
			case msg, ok := <-c.out:
				if !ok {
					return
				}
				if err := c.conn.WriteJSON(msg); err != nil {
					log.Info().Err(err).Str("sessionID", sessionID).Msg("write failed; closing")
					return
				}
			}
		}
	}()
	return nil
}

// OwnerLeft is invoked when the session owner disconnects.
// TODO: implement owner cleanup, session teardown, and notifications as needed.
func (h *WebSocketHub) handlerOwnerLeft(sessionID string) {
	// Use background context to avoid cancellation from original ctx
	ctx := context.Background()

	session := h.Sessions[sessionID]
	// for each member, close their channel
	for member := range session.Members {
		member.Close()
	}

	// delete session from database
	err := h.SessionStore.DeleteSession(ctx, sessionID)
	if err != nil {
		log.Error().Err(err).Str("sessionID", sessionID).Msg("failed to delete session from Firestore")
		return
	}
	delete(h.Sessions, sessionID)
	log.Info().Str("sessionID", sessionID).Msg("session deleted from database")
}

// MemberLeft is invoked when a session member disconnects.
// TODO: implement member removal, persistence updates, and notifications as needed.
func (h *WebSocketHub) handlerMemberLeft(sessionID string, memberID string) {
	// Use background context to avoid cancellation from original ctx
	ctx := context.Background()

	err := h.SessionStore.RemoveMemberFromSession(ctx, sessionID, memberID)
	if err != nil {
		log.Error().Err(err).Str("sessionID", sessionID).Str("memberID", memberID).Msg("failed to remove member from session in Firestore")
		return
	}
	log.Info().Str("sessionID", sessionID).Str("memberID", memberID).Msg("member removed from session database")
	return
}

func (h *WebSocketHub) notifyMemberJoined(s *Session, newMemberID, sessionID string) {
	s.Mu.RLock()
	defer s.Mu.RUnlock()

	notification := map[string]any{
		"type":      "member_joined",
		"sessionID": sessionID,
		"memberID":  newMemberID,
		"time":      time.Now().UTC().Format(time.RFC3339),
	}

	// Notify owner
	if s.Owner != nil {
		select {
		case s.Owner.out <- notification:
		default:
			log.Warn().Str("sessionID", sessionID).Msg("owner out channel full, dropping member_joined notification")
		}
	}

	// Notify all members except the new member itself
	for member := range s.Members {
		if member.id == newMemberID {
			continue
		}
		select {
		case member.out <- notification:
		default:
			log.Warn().Str("sessionID", sessionID).Str("memberID", member.id).Msg("member out channel full, dropping member_joined notification")
		}
	}
}
