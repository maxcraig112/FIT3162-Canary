package main

import (
	"context"
	"net"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"cloud.google.com/go/firestore"
	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	"github.com/joho/godotenv"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// Image represents a document in the images collection
type Image struct {
	ImageURL  string `firestore:"imageURL" json:"imageURL"`
	ImageName string `firestore:"imageName" json:"imageName"`
	BatchID   string `firestore:"batchID" json:"batchID"`
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true }, // CORS: allow all origins (adjust in prod)
}

type Client struct {
	conn *websocket.Conn
	out  chan any
	id   string
}

type Hub struct {
	mu      sync.RWMutex
	clients map[*Client]struct{}
}

func NewHub() *Hub { return &Hub{clients: make(map[*Client]struct{})} }

// hub is the singleton connection hub used across handlers
var hub *Hub

func (h *Hub) Add(c *Client) {
	h.mu.Lock()
	h.clients[c] = struct{}{}
	h.mu.Unlock()
}

func (h *Hub) Remove(c *Client) {
	h.mu.Lock()
	delete(h.clients, c)
	h.mu.Unlock()
}

func (h *Hub) Broadcast(msg any) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.clients {
		select {
		case c.out <- msg:
		default:
			// drop if client is slow
		}
	}
}

func startWriter(c *Client, hub *Hub, path string) (done chan struct{}) {
	done = make(chan struct{})
	go func() {
		defer func() {
			close(done)
			hub.Remove(c)
			_ = c.conn.Close()
		}()
		for msg := range c.out {
			if err := c.conn.WriteJSON(msg); err != nil {
				log.Info().Err(err).Str("path", path).Str("id", c.id).Msg("write failed; disconnecting")
				return
			}
		}
	}()
	return done
}

func connInfo(r *http.Request) (remote, origin, ua string) {
	remote = r.RemoteAddr
	if host, _, err := net.SplitHostPort(remote); err == nil {
		remote = host
	}
	origin = r.Header.Get("Origin")
	ua = r.Header.Get("User-Agent")
	return
}

func wsHandler(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Error().Err(err).Msg("websocket upgrade failed")
		return
	}
	// client & writer
	client := &Client{conn: conn, out: make(chan any, 16)}
	hub.Add(client)
	remote, origin, ua := connInfo(r)
	log.Info().Str("path", r.URL.Path).Str("remote", remote).Str("origin", origin).Str("ua", ua).Msg("ws connected")
	conn.SetCloseHandler(func(code int, text string) error {
		log.Info().Int("code", code).Str("reason", text).Str("path", r.URL.Path).Msg("ws close received")
		return nil
	})
	done := startWriter(client, hub, r.URL.Path)
	defer log.Info().Str("path", r.URL.Path).Str("remote", remote).Msg("ws disconnected")

	// ticker to send HELLO every 10 seconds
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case t := <-ticker.C:
			msg := map[string]any{
				"type":    "notification",
				"message": "HELLO",
				"time":    t.UTC().Format(time.RFC3339),
			}
			select {
			case client.out <- msg:
			default:
			}
		case <-done:
			return
		}
	}
}

// wsIDHandler upgrades to a WebSocket at /ws/{id} and sends that ID every 10 seconds.
func wsIDHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]
	if id == "" {
		http.Error(w, "missing id", http.StatusBadRequest)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Error().Err(err).Msg("websocket upgrade failed")
		return
	}
	client := &Client{conn: conn, out: make(chan any, 16), id: id}
	hub.Add(client)
	remote, origin, ua := connInfo(r)
	log.Info().Str("id", id).Str("path", r.URL.Path).Str("remote", remote).Str("origin", origin).Str("ua", ua).Msg("ws connected")
	conn.SetCloseHandler(func(code int, text string) error {
		log.Info().Str("id", id).Int("code", code).Str("reason", text).Msg("ws close received")
		return nil
	})
	done := startWriter(client, hub, r.URL.Path)
	defer log.Info().Str("id", id).Str("remote", remote).Msg("ws disconnected")

	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case t := <-ticker.C:
			msg := map[string]any{
				"type": "notification",
				"id":   id,
				"time": t.UTC().Format(time.RFC3339),
			}
			select {
			case client.out <- msg:
			default:
			}
		case <-done:
			return
		}
	}
}

func watchImages(ctx context.Context, projectID string, hub *Hub) {
	if projectID == "" {
		log.Warn().Msg("watchImages disabled: missing projectID")
		return
	}
	client, err := firestore.NewClientWithDatabase(ctx, projectID, "default")
	if err != nil {
		log.Error().Err(err).Msg("failed to create firestore client")
		return
	}
	defer client.Close()

	iter := client.Collection("images").Snapshots(ctx)
	log.Info().Msg("watching Firestore collection 'images'")
	for {
		snap, err := iter.Next()
		if err != nil {
			if status.Code(err) == codes.Canceled || status.Code(err) == codes.DeadlineExceeded {
				log.Info().Msg("firestore watch stopped")
				return
			}
			log.Error().Err(err).Msg("firestore watch error; retrying in 2s")
			select {
			case <-time.After(2 * time.Second):
				continue
			case <-ctx.Done():
				return
			}
		}
		for _, ch := range snap.Changes {
			if ch.Kind == firestore.DocumentAdded {
				var img Image
				if err := ch.Doc.DataTo(&img); err != nil {
					log.Error().Err(err).Str("docID", ch.Doc.Ref.ID).Msg("failed to decode Image struct")
					continue
				}
				if img.BatchID == "123" {
					msg := map[string]any{
						"type": "image_added",
						"id":   ch.Doc.Ref.ID,
						"data": img,
						"time": time.Now().UTC().Format(time.RFC3339),
					}
					hub.Broadcast(msg)
				}
			}
		}
	}
}

func main() {
	// Setup logger
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})
	_ = godotenv.Load()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// Hub for broadcasting
	hub = NewHub()

	r := mux.NewRouter()
	r.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	}).Methods("GET")
	r.HandleFunc("/ws", wsHandler)
	r.HandleFunc("/ws/{id}", wsIDHandler)

	server := &http.Server{Addr: ":" + port, Handler: r}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	go func() {
		log.Info().Str("port", port).Msg("websocket service running")
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("ListenAndServe failed")
		}
	}()

	// Start Firestore watcher
	fsProject := os.Getenv("FIRESTORE_PROJECTID")
	if fsProject == "" {
		fsProject = os.Getenv("GCP_PROJECT_ID")
	}
	go watchImages(ctx, fsProject, hub)

	<-ctx.Done()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = server.Shutdown(shutdownCtx)
	log.Info().Msg("server exited")
}
