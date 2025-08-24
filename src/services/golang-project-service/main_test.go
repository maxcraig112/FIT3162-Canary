package main

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"math/rand"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"testing"
	"time"

	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"github.com/stretchr/testify/assert"

	"pkg/gcp"
	"pkg/handler"
	"pkg/jwt"
	api "project-service/api"
	psfs "project-service/firestore"
)

// Global test fixtures
var (
	testCtx     context.Context
	testClients *gcp.Clients
	testServer  *httptest.Server
	authHeader  string
	testUserID  string

	seededProjectID string
	seededBatchID   string
)

// setupRouter mirrors run.setupHandlers without relying on unexported functions
func setupRouter(ctx context.Context, clients *gcp.Clients) *mux.Router {
	r := mux.NewRouter()
	authMw := jwt.AuthMiddleware(clients)
	h := handler.NewHandler(ctx, clients, authMw)
	api.RegisterProjectRoutes(r, h)
	api.RegisterBatchRoutes(r, h)
	api.RegisterImageRoutes(r, h)
	api.RegisterKeypointLabelRoutes(r, h)
	api.RegisterKeypointRoutes(r, h)
	api.RegisterBoundingBoxLabelRoutes(r, h)
	api.RegisterBoundingBoxRoutes(r, h)
	return r
}

func TestMain(m *testing.M) {
	// Logger
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})
	rand.Seed(time.Now().UnixNano())

	_ = godotenv.Load()
	// Ensure boolean envs are set correctly (no quotes)
	_ = os.Setenv(gcp.USE_FIRESTORE_ENV, "true")
	_ = os.Setenv(gcp.USE_GSM_ENV, "true")
	_ = os.Setenv(gcp.USE_BUCKET_ENV, "true")

	testCtx = context.Background()

	// Initialize clients
	opts := gcp.ClientOptions{}
	opts.LoadClientOptions()
	var err error
	testClients, err = gcp.InitialiseClients(testCtx, opts)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to initialize clients for tests")
	}

	// Fetch JWT secret (prefer existing env, else GSM)
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		projectID := os.Getenv("GCP_PROJECT_ID")
		secretName := os.Getenv("JWT_SECRET_NAME")
		secret, err = testClients.GSM.GetSecret(testCtx, projectID, secretName)
		if err != nil {
			log.Fatal().Err(err).Msg("Failed to retrieve JWT Secret for tests")
		}
		_ = os.Setenv("JWT_SECRET", secret)
	}

	// Generate a token for a reusable test user
	testUserID = "test-user-" + strconv.Itoa(rand.Intn(1_000_000))
	token, err := jwt.GenerateJWT(testCtx, testClients, testUserID)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to generate test JWT")
	}
	authHeader = "Bearer " + token

	// Setup HTTP server
	r := setupRouter(testCtx, testClients)
	testServer = httptest.NewServer(r)

	// Seed a project and batch reusable across tests
	projName := "seed-project-" + strconv.Itoa(rand.Intn(1_000_000))
	seededProjectID = mustCreateProject(projName)
	seededBatchID = mustCreateBatch(seededProjectID, "seed-batch-"+strconv.Itoa(rand.Intn(1_000_000)))

	// Run tests
	code := m.Run()

	// Cleanup: delete seeded project (cascades batches/images/annotations)
	_ = deleteProject(seededProjectID)

	// Shutdown
	testServer.Close()
	_ = testClients.CloseClients()
	os.Exit(code)
}

// --- Helpers ---

func authReq(method, path string, body io.Reader) *http.Request {
	req, _ := http.NewRequest(method, testServer.URL+path, body)
	req.Header.Set("Authorization", authHeader)
	return req
}

func doJSON(method, path string, payload any, out any) (*http.Response, error) {
	var body io.Reader
	if payload != nil {
		b, _ := json.Marshal(payload)
		body = bytes.NewBuffer(b)
	}
	req := authReq(method, path, body)
	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	if out != nil {
		defer resp.Body.Close()
		_ = json.NewDecoder(resp.Body).Decode(out)
	}
	return resp, nil
}

func mustCreateProject(name string) string {
	var res map[string]any
	resp, err := doJSON(http.MethodPost, "/projects", map[string]any{
		"userID":      testUserID,
		"projectName": name,
	}, &res)
	if err != nil || resp.StatusCode != http.StatusCreated {
		log.Fatal().Err(err).Int("status", resp.StatusCode).Msg("failed to create project")
	}
	id, _ := res["projectID"].(string)
	return id
}

func mustCreateBatch(projectID, name string) string {
	var res map[string]any
	resp, err := doJSON(http.MethodPost, "/batch", map[string]any{
		"projectID": projectID,
		"batchName": name,
	}, &res)
	if err != nil || resp.StatusCode != http.StatusCreated {
		log.Fatal().Err(err).Int("status", resp.StatusCode).Msg("failed to create batch")
	}
	id, _ := res["batchID"].(string)
	return id
}

func deleteProject(projectID string) error {
	req := authReq(http.MethodDelete, "/projects/"+projectID, nil)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	io.Copy(io.Discard, resp.Body)
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return assert.AnError
	}
	return nil
}

func uploadTestImages(batchID string, filenames []string) (*http.Response, error) {
	var b bytes.Buffer
	mw := multipart.NewWriter(&b)
	for _, name := range filenames {
		fw, err := mw.CreateFormFile("images", filepath.Base(name))
		if err != nil {
			return nil, err
		}
		// Write tiny content
		_, _ = fw.Write([]byte("test-" + name))
	}
	_ = mw.Close()

	req := authReq(http.MethodPost, "/batch/"+batchID+"/images", &b)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	return http.DefaultClient.Do(req)
}

// --- Tests ---

func TestProjectCRUD(t *testing.T) {
	// Create
	projName := "proj-" + strconv.Itoa(rand.Intn(1_000_000))
	var createRes map[string]any
	resp, err := doJSON(http.MethodPost, "/projects", map[string]any{
		"userID":      testUserID,
		"projectName": projName,
	}, &createRes)
	assert.NoError(t, err)
	assert.Equal(t, http.StatusCreated, resp.StatusCode)
	projectID, _ := createRes["projectID"].(string)
	t.Cleanup(func() { _ = deleteProject(projectID) })

	// Get by ID
	var got psfs.Project
	resp, err = doJSON(http.MethodGet, "/projects/"+projectID, nil, &got)
	assert.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	assert.Equal(t, projectID, got.ProjectID)
	assert.Equal(t, projName, got.ProjectName)

	// List by wildcard
	var list []psfs.Project
	resp, err = doJSON(http.MethodGet, "/projects/*", nil, &list)
	assert.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	found := false
	for _, p := range list {
		if p.ProjectID == projectID {
			found = true
			break
		}
	}
	assert.True(t, found)

	// Rename
	newName := projName + "-renamed"
	resp, err = doJSON(http.MethodPut, "/projects/"+projectID, map[string]any{"newProjectName": newName}, nil)
	assert.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	// Update settings
	resp, err = doJSON(http.MethodPatch, "/projects/"+projectID+"/settings", map[string]any{
		"tagLabels": map[string]any{
			"keyPoints":     []string{"kp1", "kp2"},
			"boundingBoxes": []string{"bb1"},
		},
	}, nil)
	assert.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	// Increment numberOfFiles
	var incRes map[string]any
	resp, err = doJSON(http.MethodPatch, "/projects/"+projectID+"/numberoffiles", map[string]any{"quantity": 3}, &incRes)
	assert.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

func TestBatchCRUD(t *testing.T) {
	batchName := "batch-" + strconv.Itoa(rand.Intn(1_000_000))
	batchID := mustCreateBatch(seededProjectID, batchName)
	// Cleanup: delete batch (ignore errors if project cleanup happens)
	t.Cleanup(func() {
		req := authReq(http.MethodDelete, "/batch/"+batchID, nil)
		resp, _ := http.DefaultClient.Do(req)
		if resp != nil {
			io.Copy(io.Discard, resp.Body)
			resp.Body.Close()
		}
	})

	// Get batch
	var got psfs.Batch
	resp, err := doJSON(http.MethodGet, "/batch/"+batchID, nil, &got)
	assert.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	assert.Equal(t, batchID, got.BatchID)

	// Rename
	newName := batchName + "-renamed"
	resp, err = doJSON(http.MethodPut, "/batch/"+batchID, map[string]any{"newBatchName": newName}, nil)
	assert.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	// Update totals
	resp, err = doJSON(http.MethodPatch, "/batch/"+batchID+"/numberofTotalFiles", map[string]any{"quantity": 2}, nil)
	assert.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	resp, err = doJSON(http.MethodPatch, "/batch/"+batchID+"/numberofAnnotatedFiles", map[string]any{"quantity": 1}, nil)
	assert.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	// Delete
	req := authReq(http.MethodDelete, "/batch/"+batchID, nil)
	resp, err = http.DefaultClient.Do(req)
	assert.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

func TestImageUploadListDelete(t *testing.T) {
	// Create an isolated batch
	batchID := mustCreateBatch(seededProjectID, "img-batch-"+strconv.Itoa(rand.Intn(1_000_000)))
	t.Cleanup(func() {
		req := authReq(http.MethodDelete, "/batch/"+batchID, nil)
		resp, _ := http.DefaultClient.Do(req)
		if resp != nil {
			io.Copy(io.Discard, resp.Body)
			resp.Body.Close()
		}
	})

	// Upload a couple of tiny files
	resp, err := uploadTestImages(batchID, []string{"a.png", "b.jpg"})
	assert.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	io.Copy(io.Discard, resp.Body)
	resp.Body.Close()

	// List images
	var images []psfs.Image
	resp, err = doJSON(http.MethodGet, "/batch/"+batchID+"/images", nil, &images)
	assert.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	assert.GreaterOrEqual(t, len(images), 2)

	// Delete images
	req := authReq(http.MethodDelete, "/batch/"+batchID+"/images", nil)
	resp, err = http.DefaultClient.Do(req)
	assert.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	io.Copy(io.Discard, resp.Body)
	resp.Body.Close()

	// List images again -> empty
	images = nil
	resp, err = doJSON(http.MethodGet, "/batch/"+batchID+"/images", nil, &images)
	assert.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	assert.Equal(t, 0, len(images))
}

func TestOwnershipForbidden(t *testing.T) {
	// Generate a different user's JWT
	otherUser := testUserID + "-other"
	token, err := jwt.GenerateJWT(testCtx, testClients, otherUser)
	assert.NoError(t, err)

	// Attempt to read a project owned by testUserID
	req, _ := http.NewRequest(http.MethodGet, testServer.URL+"/projects/"+seededProjectID, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := http.DefaultClient.Do(req)
	assert.NoError(t, err)
	// Ownership middleware should forbid
	assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	io.Copy(io.Discard, resp.Body)
	resp.Body.Close()
}

func TestCascadingDeleteProject(t *testing.T) {
	// Create project -> batch -> images -> annotations, then delete project
	projID := mustCreateProject("cascade-proj-" + strconv.Itoa(rand.Intn(1_000_000)))
	batchID := mustCreateBatch(projID, "cascade-batch")

	// Upload two tiny files
	resp, err := uploadTestImages(batchID, []string{"x.png", "y.jpg"})
	assert.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	io.Copy(io.Discard, resp.Body)
	resp.Body.Close()

	// List images and pick first
	var images []psfs.Image
	resp, err = doJSON(http.MethodGet, "/batch/"+batchID+"/images", nil, &images)
	assert.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	if len(images) == 0 {
		t.Fatalf("expected images to be uploaded")
	}
	imageID := images[0].ImageID

	// Create a bounding box and a keypoint on the image via API
	// Bounding box
	bbReq := map[string]any{
		"imageID":            imageID,
		"position":           map[string]any{"x": 1.0, "y": 2.0, "width": 10.0, "height": 5.0},
		"boundingBoxLabelID": "label-1",
	}
	// The API path requires projectID in the URL
	resp, err = doJSON(http.MethodPost, "/projects/"+projID+"/images/"+imageID+"/boundingboxes", bbReq, nil)
	assert.NoError(t, err)
	assert.Equal(t, http.StatusCreated, resp.StatusCode)

	// Keypoint
	kpReq := map[string]any{
		"imageID":         imageID,
		"position":        map[string]any{"x": 3.0, "y": 4.0},
		"keypointLabelID": "kpl-1",
		"boundingBoxID":   "", // optional
	}
	resp, err = doJSON(http.MethodPost, "/projects/"+projID+"/images/"+imageID+"/keypoints", kpReq, nil)
	assert.NoError(t, err)
	assert.Equal(t, http.StatusCreated, resp.StatusCode)

	// Delete project (should cascade)
	err = deleteProject(projID)
	assert.NoError(t, err)

	// Verify via stores that cascade occurred
	imgStore := psfs.NewImageStore(testClients.Firestore)
	imgs, err := imgStore.GetImagesByBatchID(testCtx, batchID)
	assert.NoError(t, err)
	assert.Equal(t, 0, len(imgs))

	// Keypoints by image should be empty set via API
	var kps []psfs.Keypoint
	resp, err = doJSON(http.MethodGet, "/projects/"+projID+"/images/"+imageID+"/keypoints", nil, &kps)
	// Even though project is gone, endpoint doesn't enforce ownership; it should return []
	// But it still requires a valid JWT
	assert.NoError(t, err)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	assert.Equal(t, 0, len(kps))

	// Batch should be gone; ownership resolver fails and middleware returns 403
	resp, err = doJSON(http.MethodGet, "/batch/"+batchID, nil, nil)
	assert.NoError(t, err)
	assert.Equal(t, http.StatusForbidden, resp.StatusCode)
}
