package websocket

import (
	"encoding/json"
	"os"
	"strconv"
	"time"

	"github.com/gorilla/websocket"
	"github.com/rs/zerolog/log"
)

type MessageType string

const (
	SetImageID MessageType = "setImageID"
	Ping       MessageType = "ping"
)

type IncomingMessage struct {
	Type    MessageType     `json:"type"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

type ChangeImageIDMessage struct {
	ImageID string `json:"imageID"`
}

func (h *WebSocketHub) startWebhookReader(c *Client, sessionID string) {
	timeoutSec := 60 // default timeout in seconds (lower for quicker disconnect detection)
	if envTimeout := os.Getenv("WEBSOCKET_CONNECTION_TIMEOUT_SECONDS"); envTimeout != "" {
		if t, err := strconv.Atoi(envTimeout); err == nil {
			timeoutSec = t
		}
	}
	timeout := time.Duration(timeoutSec)

	c.conn.SetReadLimit(1 << 20) // 1MB
	_ = c.conn.SetReadDeadline(time.Now().Add(timeout * time.Second))
	c.conn.SetPongHandler(func(string) error {
		_ = c.conn.SetReadDeadline(time.Now().Add(timeout * time.Second))
		return nil
	})

	go func() {
		for {
			mt, data, err := c.conn.ReadMessage()
			if err != nil {
				log.Debug().Err(err).Str("sessionID", sessionID).Str("userID", c.id).Msg("read error; closing client to expedite disconnect handling")
				c.Close()
				return
			}
			if mt == websocket.CloseMessage {
				log.Debug().Str("sessionID", sessionID).Str("userID", c.id).Msg("received close frame; closing client")
				c.Close()
				return
			}
			if mt != websocket.TextMessage {
				// Ignore other non-text messages (binary, etc.)
				continue
			}

			var msg IncomingMessage
			if err := json.Unmarshal(data, &msg); err != nil {
				log.Warn().Err(err).Str("sessionID", sessionID).Str("userID", c.id).Msg("invalid client message")
				continue
			}

			// Dispatch by type
			switch msg.Type {
			case SetImageID:
				// we know the payload will be of type ChangeImageIDMessage
				var payload ChangeImageIDMessage
				if err := json.Unmarshal(msg.Payload, &payload); err != nil {
					log.Warn().Err(err).Str("sessionID", sessionID).Str("userID", c.id).Msg("invalid setImageID payload")
					continue
				}

				log.Info().Str("sessionID", sessionID).Str("userID", c.id).Msgf("setImageID to %s", payload.ImageID)
				// set the new ImageID
				c.imageID = payload.ImageID

				// Set a watch for this new imageID
				// this will stop any existing watches so we're not watching the same image twice
				h.stopLabelsWatch(c)
				h.startLabelsWatch(c, sessionID)

			case Ping:
				// Light reply example (enqueue to this client)
				_ = h.safeEnqueue(c, map[string]any{"type": "pong", "time": time.Now().UTC().Format(time.RFC3339)})
			default:
				log.Warn().Interface("type", msg.Type).Str("sessionID", sessionID).Msg("unhandled client message type")
			}
		}
	}()
}
