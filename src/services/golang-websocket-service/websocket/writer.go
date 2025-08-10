package websocket

import (
	"time"

	"github.com/rs/zerolog/log"
)

func (h *WebSocketHub) startWebhookWriter(c *Client, role, sessionID string) error {
	go func() {
		// The purpose of this ticker is to ensure that the websocket isn't closed by being idle.
		ticker := time.NewTicker(30 * time.Second)

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
			h.stopLabelsWatch(c)
			switch role {
			case "owner":
				// mark session as terminating to avoid per-member removal spam
				h.markTerminating(sessionID)
				// stop any active labels watch for this session

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
