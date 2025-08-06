package api

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"pkg/gcp/bucket"
	"pkg/handler"
	bk "project-service/bucket"
	"project-service/firestore"
	"strings"

	"github.com/gorilla/mux"
	"github.com/rs/zerolog/log"
	ffmpeg "github.com/u2takey/ffmpeg-go"
)

// custom error for no media found
var ErrNoMediaFound = errors.New("no media found")

func ErrOpeningFile(filename string) error {
	return fmt.Errorf("error opening file: %s", filename)
}

type ImageHandler struct {
	*handler.Handler
	ImageStore  *firestore.ImageStore
	ImageBucket *bk.ImageBucket
}

func newImageHandler(h *handler.Handler) *ImageHandler {
	return &ImageHandler{
		Handler:     h,
		ImageStore:  firestore.NewImageStore(h.Clients.Firestore),
		ImageBucket: bk.NewImageBucket(h.Clients.Bucket),
	}
}

func RegisterImageRoutes(r *mux.Router, h *handler.Handler) {
	ih := newImageHandler(h)

	routes := []Route{
		// Get all images from a batch
		{"GET", "/batch/{batchID}/images", ih.LoadImagesHandler},
		// Upload images/video
		{"POST", "/batch/{batchID}/images", ih.UploadImagesHandler},
	}

	for _, rt := range routes {
		r.Handle(rt.pattern, h.AuthMw(http.HandlerFunc(rt.handlerFunc))).Methods(rt.method)
	}
}

func (h *ImageHandler) LoadImagesHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	vars := mux.Vars(r)
	batchID := vars["batchID"]
	if batchID == "" {
		http.Error(w, "Missing batchID in URL", http.StatusBadRequest)
		log.Error().Msg("Missing batchID in URL for LoadImagesHandler")
		return
	}

	// Retrieve image metadata from Firestore
	images, err := h.ImageStore.GetImagesByBatchID(ctx, batchID)
	if err != nil {
		http.Error(w, "Failed to load image metadata", http.StatusInternalServerError)
		log.Error().Err(err).Str("batchID", batchID).Msg("Failed to load image metadata")
		return
	}

	// Respond with image metadata as JSON
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(images); err != nil {
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
		log.Error().Err(err).Str("batchID", batchID).Msg("Failed to encode image metadata response")
		return
	}
	log.Info().Str("batchID", batchID).Msg("Successfully returned images by batchID")
}

func (h *ImageHandler) UploadImagesHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	err := r.ParseMultipartForm(10 << 20)
	if err != nil {
		http.Error(w, "Could not parse multipart form", http.StatusBadRequest)
		log.Error().Err(err).Msg("Could not parse multipart form in UploadImagesHandler")
		return
	}

	vars := mux.Vars(r)
	batchID := vars["batchID"]
	if batchID == "" {
		http.Error(w, "Missing batchID in URL", http.StatusBadRequest)
		log.Error().Msg("Missing batchID in URL for UploadImagesHandler")
		return
	}

	noImagesUploaded := false
	imageObjects, err := generateImageData(batchID, r.MultipartForm)
	if err == ErrNoMediaFound {
		noImagesUploaded = true
	} else if err != nil {
		http.Error(w, "Failed to generate image data", http.StatusInternalServerError)
		log.Error().Err(err).Msg("Failed to generate image data in UploadImagesHandler")
		return
	}
	// Upload the images to google bucket

	videoFrameObjects, err := generateVideoData(batchID, r.MultipartForm)
	if err == ErrNoMediaFound && noImagesUploaded {
		http.Error(w, "No images or videos found in the request", http.StatusBadRequest)
		log.Error().Msg("No images or videos found in the request for UploadImagesHandler")
		return
	} else if err != nil && err != ErrNoMediaFound {
		http.Error(w, "Failed to generate video data", http.StatusInternalServerError)
		log.Error().Err(err).Msg("Failed to generate video data in UploadImagesHandler")
		return
	}

	var imageData map[string]string
	if imageData, err = h.ImageBucket.CreateImages(ctx, batchID, imageObjects); err != nil {
		http.Error(w, "Failed to upload images", http.StatusInternalServerError)
		log.Error().Err(err).Str("batchID", batchID).Msg("Failed to upload images to bucket")
		return
	}

	// Once the images have been uploaded, we now want to create the image metadata in firestore
	if err := h.ImageStore.CreateImageMetadata(ctx, batchID, imageData); err != nil {
		http.Error(w, "Failed to create image metadata", http.StatusInternalServerError)
		log.Error().Err(err).Str("batchID", batchID).Msg("Failed to create image metadata in Firestore")
		return
	}

	var videoData map[string]string
	if videoData, err = h.ImageBucket.CreateImages(ctx, batchID, videoFrameObjects); err != nil {
		http.Error(w, "Failed to upload videos", http.StatusInternalServerError)
		log.Error().Err(err).Str("batchID", batchID).Msg("Failed to upload videos to bucket")
		return
	}

	// Once the videos have been uploaded, we now want to create the video metadata in firestore
	if err := h.ImageStore.CreateImageMetadata(ctx, batchID, videoData); err != nil {
		http.Error(w, "Failed to create video metadata", http.StatusInternalServerError)
		log.Error().Err(err).Str("batchID", batchID).Msg("Failed to create video metadata in Firestore")
		return
	}
	w.WriteHeader(http.StatusOK)
	log.Info().Str("batchID", batchID).Int("numImages", len(imageData)+len(videoData)).Msg("Images and videos uploaded and metadata created successfully")
	w.Write([]byte("Images and videos uploaded successfully"))
}

func generateImageData(batchID string, form *multipart.Form) (bucket.ObjectMap, error) {
	files := form.File["images"]
	if len(files) == 0 {
		return nil, ErrNoMediaFound
	}

	objects := make(bucket.ObjectMap, len(files))

	for _, fileHeader := range files {
		file, err := fileHeader.Open()
		if err != nil {
			return nil, ErrOpeningFile(fileHeader.Filename)
		}
		defer file.Close()

		// Construct object key, e.g. batchID/filename.png
		objectName := fmt.Sprintf("%s/%s", batchID, fileHeader.Filename)
		// Assign io.Reader to ObjectMap
		objects[objectName] = file
	}

	return objects, nil

}

func generateVideoData(batchID string, form *multipart.Form) (bucket.ObjectMap, error) {
	files := form.File["videos"]
	if len(files) == 0 {
		return nil, ErrNoMediaFound
	}

	objects := make(bucket.ObjectMap)

	for _, fileHeader := range files {
		// Validate .mp4 extension
		if !strings.HasSuffix(strings.ToLower(fileHeader.Filename), ".mp4") {
			return nil, fmt.Errorf("file %s is not an .mp4", fileHeader.Filename)
		}

		file, err := fileHeader.Open()
		if err != nil {
			return nil, ErrOpeningFile(fileHeader.Filename)
		}
		defer file.Close()

		// Read the entire video into memory
		var videoBuf bytes.Buffer
		if _, err := io.Copy(&videoBuf, file); err != nil {
			return nil, fmt.Errorf("failed to read video into memory: %w", err)
		}

		// PNG signature
		pngSig := []byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}

		// Run ffmpeg to output all frames as PNG to stdout
		outBuf := &bytes.Buffer{}
		err = ffmpeg.Input("pipe:0").
			Output("pipe:1", ffmpeg.KwArgs{
				"f":      "image2pipe",
				"vcodec": "png",
			}).
			WithInput(bytes.NewReader(videoBuf.Bytes())).
			WithOutput(outBuf).
			OverWriteOutput().
			Run()
		if err != nil {
			return nil, fmt.Errorf("failed to extract frames using ffmpeg-go: %w", err)
		}

		// Split outBuf into individual PNG images by searching for PNG signatures
		data := outBuf.Bytes()
		var indices []int
		for i := 0; i+8 <= len(data); i++ {
			if bytes.Equal(data[i:i+8], pngSig) {
				indices = append(indices, i)
			}
		}
		// Each PNG starts at indices[i], ends at indices[i+1] (or EOF)
		for i := 0; i < len(indices); i++ {
			start := indices[i]
			var end int
			if i+1 < len(indices) {
				end = indices[i+1]
			} else {
				end = len(data)
			}
			frameData := data[start:end]
			frameName := fmt.Sprintf("%s/%s_frame_%04d.png", batchID, fileHeader.Filename, i+1)
			objects[frameName] = bytes.NewReader(frameData)
		}
	}

	return objects, nil
}
