package websocket

import (
	"os"
	"strconv"
	"time"

	"github.com/gorilla/websocket"
	"github.com/rs/zerolog/log"
)

func (h *WebSocketHub) startWebhookWriter(c *Client, role, sessionID string) error {
	go func() {
		// The purpose of this ticker is to ensure that the websocket isn't closed by being idle.
		ticker := time.NewTicker(30 * time.Second)

		// Short-interval ping ticker to detect disconnects quickly via missing pong
		pingIntervalSec := 3
		if env := os.Getenv("WEBSOCKET_PING_INTERVAL_SECONDS"); env != "" {
			if v, err := strconv.Atoi(env); err == nil && v > 0 {
				pingIntervalSec = v
			}
		}
		pingTicker := time.NewTicker(time.Duration(pingIntervalSec) * time.Second)

		// defer occurs when a websocket connection is closed
		defer func() {
			ticker.Stop()
			pingTicker.Stop()
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
				h.handlerOwnerLeft(sessionID)
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
			case <-pingTicker.C:
				// send a websocket ping frame; browser clients will auto-respond with pong
				// Use a short write deadline so we don't hang here
				_ = c.conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
				if err := c.conn.WriteControl(websocket.PingMessage, []byte("ping"), time.Now().Add(5*time.Second)); err != nil {
					log.Debug().Err(err).Str("sessionID", sessionID).Msg("ping write failed; closing")
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
