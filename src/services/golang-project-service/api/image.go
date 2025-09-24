package api

import (
	"bytes"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"pkg/gcp/bucket"
	"pkg/handler"
	fs "project-service/firestore"
	"strings"
	"time"

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
	// These are embedded fields so you don't need to call .Stores to get the inner fields
	Stores
	Buckets
}

func newImageHandler(h *handler.Handler) *ImageHandler {
	return &ImageHandler{
		Handler: h,
		Stores:  InitialiseStores(h),
		Buckets: InitialiseBuckets(h),
	}
}

func RegisterImageRoutes(r *mux.Router, h *handler.Handler) {
	ih := newImageHandler(h)

	routes := []Route{
		// Get all images from a batch
		{"GET", "/batch/{batchID}/images", ih.LoadImagesHandler},
		// Upload images/video
		{"POST", "/batch/{batchID}/images", ih.UploadImagesHandler},
		// Delete all images from a batch
		{"DELETE", "/batch/{batchID}/images", ih.DeleteImagesHandler},
	}

	for _, rt := range routes {
		wrapped := h.AuthMw(ValidateOwnershipMiddleware(http.HandlerFunc(rt.handlerFunc), ih.Stores))
		r.Handle(rt.pattern, wrapped).Methods(rt.method)
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

	videoFrameObjects, cleanupVideo, err := generateVideoData(batchID, r.MultipartForm)
	// Ensure any temp files/dirs from video processing are cleaned up at the very end of this handler
	if cleanupVideo != nil {
		defer cleanupVideo()
	}
	if err == ErrNoMediaFound && noImagesUploaded {
		http.Error(w, "No images or videos found in the request", http.StatusBadRequest)
		log.Error().Msg("No images or videos found in the request for UploadImagesHandler")
		return
	} else if err != nil && err != ErrNoMediaFound {
		http.Error(w, "Failed to generate video data", http.StatusInternalServerError)
		log.Error().Err(err).Msg("Failed to generate video data in UploadImagesHandler")
		return
	}

	var imageData bucket.ObjectList
	imgUpStart := time.Now()
	if imageData, err = h.ImageBucket.CreateImages(ctx, batchID, imageObjects); err != nil {
		http.Error(w, "Failed to upload images", http.StatusInternalServerError)
		log.Error().Err(err).Str("batchID", batchID).Msg("Failed to upload images to bucket")
		return
	}
	log.Info().
		Str("batchID", batchID).
		Int("count", len(imageData)).
		Dur("took", time.Since(imgUpStart)).
		Msg("Uploaded images to bucket")

	imgMetaStart := time.Now()
	var createdImages []fs.Image
	if len(imageData) > 0 {
		imgs, err := h.ImageStore.CreateImageMetadata(ctx, batchID, imageData, false)
		if err != nil {
			http.Error(w, "Failed to create image metadata", http.StatusInternalServerError)
			log.Error().Err(err).Str("batchID", batchID).Msg("Failed to create image metadata in Firestore")
			return
		}
		createdImages = imgs
		for _, im := range createdImages {
			log.Info().Str("batchID", batchID).Str("imageID", im.ImageID).Str("fileName", im.ImageName).Msg("Created image metadata")
		}
		log.Info().
			Str("batchID", batchID).
			Int("count", len(createdImages)).
			Dur("took", time.Since(imgMetaStart)).
			Msg("Created image metadata in Firestore (batch)")
	}

	var videoData bucket.ObjectList
	vidUpStart := time.Now()
	if videoData, err = h.ImageBucket.CreateImages(ctx, batchID, videoFrameObjects); err != nil {
		http.Error(w, "Failed to upload videos", http.StatusInternalServerError)
		log.Error().Err(err).Str("batchID", batchID).Msg("Failed to upload videos to bucket")
		return
	}
	if len(videoData) > 0 {
		log.Info().
			Str("batchID", batchID).
			Int("count", len(videoData)).
			Dur("took", time.Since(vidUpStart)).
			Msg("Uploaded video frames to bucket")
	}

	vidMetaStart := time.Now()
	var createdVideoFrames []fs.Image
	if len(videoData) > 0 {
		frames, err := h.ImageStore.CreateImageMetadata(ctx, batchID, videoData, true)
		if err != nil {
			http.Error(w, "Failed to create video metadata", http.StatusInternalServerError)
			log.Error().Err(err).Str("batchID", batchID).Msg("Failed to create video metadata in Firestore")
			return
		}
		createdVideoFrames = frames

		for _, vf := range createdVideoFrames {
			log.Info().Str("batchID", batchID).Str("videoFrameID", vf.ImageID).Str("frameFile", vf.ImageName).Msg("Created video frame metadata")
		}
		log.Info().
			Str("batchID", batchID).
			Int("count", len(createdVideoFrames)).
			Dur("took", time.Since(vidMetaStart)).
			Msg("Created video frame metadata in Firestore (batch)")
	}
	w.WriteHeader(http.StatusOK)

	summaryParts := []string{}
	if len(createdImages) > 0 {
		summaryParts = append(summaryParts, fmt.Sprintf("%d images", len(createdImages)))
	}
	if len(createdVideoFrames) > 0 {
		summaryParts = append(summaryParts, fmt.Sprintf("%d video frames", len(createdVideoFrames)))
	}
	if len(summaryParts) == 0 {
		log.Warn().Str("batchID", batchID).Msg("Upload handler completed with no media persisted")
		w.Write([]byte("No media uploaded"))
		return
	}
	log.Info().Str("batchID", batchID).Msg(fmt.Sprintf("Uploaded and stored metadata for %s", strings.Join(summaryParts, " and ")))
	w.Write([]byte("Upload successful"))
}

func generateImageData(batchID string, form *multipart.Form) (bucket.ObjectList, error) {
	files := form.File["images"]
	if len(files) == 0 {
		return nil, ErrNoMediaFound
	}

	objects := make(bucket.ObjectList, len(files))

	for i, fileHeader := range files {
		f, err := fileHeader.Open()
		if err != nil {
			return nil, ErrOpeningFile(fileHeader.Filename)
		}

		data, err := io.ReadAll(f)
		_ = f.Close()
		if err != nil {
			return nil, fmt.Errorf("failed to read image %s: %w", fileHeader.Filename, err)
		}

		cfg, format, err := image.DecodeConfig(bytes.NewReader(data))
		if err != nil {
			return nil, fmt.Errorf("failed to decode image config for %s: %w", fileHeader.Filename, err)
		}
		width, height := cfg.Width, cfg.Height
		log.Debug().Str("file", fileHeader.Filename).Str("format", format).Int("w", width).Int("h", height).Msg("decoded image dimensions")

		uuid := GenerateUUID()
		objectName := fmt.Sprintf("%s/%s_%s", batchID, fileHeader.Filename, uuid)
		objects[i] = bucket.ObjectData{
			ImageName: objectName,
			ImageData: bucket.ImageData{
				Width:        int64(width),
				Height:       int64(height),
				ObjectReader: io.NopCloser(bytes.NewReader(data)),
			},
		}
	}

	return objects, nil

}

func generateVideoData(batchID string, form *multipart.Form) (bucket.ObjectList, func(), error) {
	files := form.File["videos"]
	if len(files) == 0 {
		return nil, nil, ErrNoMediaFound
	}

	objects := bucket.ObjectList{}
	// Track resources for cleanup outside this function
	var closers []io.Closer
	var tempDirs []string
	var tempVideoPaths []string
	cleanup := func() {
		for _, c := range closers {
			_ = c.Close()
		}
		for _, p := range tempVideoPaths {
			_ = os.Remove(p)
		}
		for _, d := range tempDirs {
			_ = os.RemoveAll(d)
		}
	}

	for _, fileHeader := range files {
		// Validate .mp4 extension
		if !strings.HasSuffix(strings.ToLower(fileHeader.Filename), ".mp4") {
			return nil, cleanup, fmt.Errorf("file %s is not an .mp4", fileHeader.Filename)
		}

		file, err := fileHeader.Open()
		if err != nil {
			return nil, cleanup, ErrOpeningFile(fileHeader.Filename)
		}
		// Defer file close via cleanup to ensure readers remain valid until upload finishes
		closers = append(closers, file)

		// Read the entire video into memory
		var videoBuf bytes.Buffer
		if _, err := io.Copy(&videoBuf, file); err != nil {
			return nil, cleanup, fmt.Errorf("failed to read video into memory: %w", err)
		}

		// make a temporary directory where ffmpeg will save the frames
		dname, err := os.MkdirTemp("", fmt.Sprintf("frames_%s_*", batchID))
		if err != nil {
			return nil, cleanup, fmt.Errorf("failed to create temporary directory for frames: %w", err)
		}

		log.Info().Str("tempDir", dname).Msg("Temporary directory created for video frames")
		tempDirs = append(tempDirs, dname)

		// Write the uploaded video to a temporary file to avoid stdin/pipe issues on Windows
		tmpVid, err := os.CreateTemp(dname, "video_*.mp4")
		if err != nil {
			return nil, cleanup, fmt.Errorf("failed to create temp video file: %w", err)
		}
		if _, err := io.Copy(tmpVid, bytes.NewReader(videoBuf.Bytes())); err != nil {
			_ = tmpVid.Close()
			return nil, cleanup, fmt.Errorf("failed to write temp video file: %w", err)
		}
		if err := tmpVid.Close(); err != nil {
			return nil, cleanup, fmt.Errorf("failed to close temp video file: %w", err)
		}
		videoPath := tmpVid.Name()
		tempVideoPaths = append(tempVideoPaths, videoPath)

		// Save frames as PNG files in the temporary directory using ffmpeg
		outPattern := filepath.Join(dname, "frame_%04d.png")
		err = ffmpeg.Input(videoPath).
			Output(outPattern, ffmpeg.KwArgs{
				"vsync": "0",
				"f":     "image2",
			}).
			OverWriteOutput().
			Run()
		if err != nil {
			return nil, cleanup, fmt.Errorf("failed to extract frames using ffmpeg-go: %w", err)
		}

		// Read all PNG files from the temp directory and add to objects
		files, err := os.ReadDir(dname)
		if err != nil {
			return nil, cleanup, fmt.Errorf("failed to read frames directory: %w", err)
		}

		uuid := GenerateUUID()
		for i, f := range files {
			if !strings.HasSuffix(f.Name(), ".png") {
				continue
			}
			framePath := filepath.Join(dname, f.Name())
			frameFile, err := os.Open(framePath)
			if err != nil {
				return nil, cleanup, fmt.Errorf("failed to open frame file: %w", err)
			}

			cfg, _, err := image.DecodeConfig(frameFile)
			if err != nil {
				frameFile.Close()
				return nil, cleanup, fmt.Errorf("failed to decode frame config: %w", err)
			}
			width, height := cfg.Width, cfg.Height
			_, err = frameFile.Seek(0, 0)
			if err != nil {
				frameFile.Close()
				return nil, cleanup, fmt.Errorf("failed to reset frame file: %w", err)
			}

			closers = append(closers, frameFile)
			frameName := fmt.Sprintf("%s/%s/%s_frame_%04d_w%d_h%d.png",
				batchID, uuid, fileHeader.Filename, i+1, width, height)
			objects = append(objects, bucket.ObjectData{
				ImageName: frameName,
				ImageData: bucket.ImageData{
					ObjectReader: frameFile,
					Width:        int64(width),
					Height:       int64(height),
				},
			})
		}
	}

	return objects, cleanup, nil
}

func GenerateUUID() string {
	const chars = "0123456789abcdef"
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	for i := range b {
		b[i] = chars[b[i]%16]
	}
	return string(b)
}

func (h *ImageHandler) DeleteImagesHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	vars := mux.Vars(r)
	batchID := vars["batchID"]
	if batchID == "" {
		http.Error(w, "Missing batchID in URL", http.StatusBadRequest)
		log.Error().Msg("Missing batchID in URL for DeleteImagesHandler")
		return
	}

	// List images first to know their IDs for annotation deletes
	images, err := h.ImageStore.GetImagesByBatchID(ctx, batchID)
	if err != nil {
		http.Error(w, "Failed to list images for deletion", http.StatusInternalServerError)
		log.Error().Err(err).Str("batchID", batchID).Msg("Failed to list images before delete")
		return
	}

	// Delete images from the bucket
	if err := h.ImageBucket.DeleteImagesByBatchID(ctx, batchID); err != nil {
		http.Error(w, "Failed to delete images from bucket", http.StatusInternalServerError)
		log.Error().Err(err).Str("batchID", batchID).Msg("Failed to delete images from bucket")
		return
	}

	// Delete image metadata from Firestore
	if err := h.ImageStore.DeleteImagesByBatchID(ctx, batchID); err != nil {
		http.Error(w, "Failed to delete image metadata", http.StatusInternalServerError)
		log.Error().Err(err).Str("batchID", batchID).Msg("Failed to delete image metadata from Firestore")
		return
	}

	// Cascade delete annotations for these images
	imageIDs := make([]string, 0, len(images))
	for _, img := range images {
		imageIDs = append(imageIDs, img.ImageID)
	}
	if err := h.KeypointStore.DeleteKeypointsByImageIDs(ctx, imageIDs); err != nil {
		http.Error(w, "Failed to delete keypoints for images", http.StatusInternalServerError)
		log.Error().Err(err).Str("batchID", batchID).Msg("Failed to delete keypoints for images")
		return
	}
	if err := h.BoundingBoxStore.DeleteBoundingBoxesByImageIDs(ctx, imageIDs); err != nil {
		http.Error(w, "Failed to delete bounding boxes for images", http.StatusInternalServerError)
		log.Error().Err(err).Str("batchID", batchID).Msg("Failed to delete bounding boxes for images")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	log.Info().Str("batchID", batchID).Msg("All images and annotations deleted successfully")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"batchID": batchID,
		"deleted": true,
		"message": "All images and annotations deleted",
	})
}
