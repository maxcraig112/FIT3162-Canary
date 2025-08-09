package websocket

import (
	"time"

	"github.com/rs/zerolog/log"
)

func startWriter(c *Client, role, sessionID string) {
	go func() {
		ticker := time.NewTicker(10 * time.Second)
		defer func() {
			ticker.Stop()
			_ = c.conn.Close()
			close(c.out)
			log.Info().Str("sessionID", sessionID).Str("role", role).Str("userID", c.id).Msg("ws disconnected")
		}()
		log.Info().Str("sessionID", sessionID).Str("role", role).Str("userID", c.id).Msg("ws connected")
		for {
			select {
			case t := <-ticker.C:
				// periodic keepalive/hello
				msg := map[string]any{"type": "hello", "role": role, "sessionID": sessionID, "time": t.UTC().Format(time.RFC3339)}
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
