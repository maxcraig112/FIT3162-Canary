package function

import (
	"context"
	"encoding/json"
	"log"

	"cloud.google.com/go/firestore"
	"github.com/GoogleCloudPlatform/functions-framework-go/functions"
	cloudevents "github.com/cloudevents/sdk-go/v2"
)

const (
	PROJECT_ID = "canary-462412"
	// Match the Firestore database ID created via Terraform ("default").
	// If your project uses the legacy default DB, this would be "(default)".
	DATABASE_ID = "default"

	BATCH_COLLECTION_ID        = "batches"
	BATCH_TOTAL_FILES_FIELD_ID = "numberOfTotalFiles"
)

type Image struct {
	BatchID string `firestore:"batchID" json:"batchID"`
}

var client *firestore.Client
var err error

func init() {
	ctx := context.Background()
	client, err = firestore.NewClientWithDatabase(ctx, PROJECT_ID, DATABASE_ID)
	if err != nil {
		log.Fatalf("firestore.NewClientWithDatabase failed for database=%s: %v", DATABASE_ID, err)
	}
	log.Printf("Initialized Firestore client for database=%s", DATABASE_ID)
	functions.CloudEvent("ImageCreated", ImageCreated)
	functions.CloudEvent("ImageDeleted", ImageDeleted)
}

func ImageCreated(ctx context.Context, e cloudevents.Event) error {
	log.Printf("ImageCreated received: id=%s source=%s type=%s subject=%s", e.ID(), e.Source(), e.Type(), e.Subject())
	return updateBatchCount(ctx, e, 1)
}

func ImageDeleted(ctx context.Context, e cloudevents.Event) error {
	log.Printf("ImageDeleted received: id=%s source=%s type=%s subject=%s", e.ID(), e.Source(), e.Type(), e.Subject())
	return updateBatchCount(ctx, e, -1)
}

func updateBatchCount(ctx context.Context, e cloudevents.Event, delta int64) error {
	// Firestore CloudEvent payload shape is {"oldValue":{}, "value": {"fields": {...}}}
	// Extract batchID from value.fields.batchID.stringValue
	var payload map[string]any
	if err := e.DataAs(&payload); err != nil {
		log.Println("Failed to parse event data:", err)
		return nil
	}

	// Debug minimal payload info
	if dbg, err := json.Marshal(map[string]any{
		"hasValue": payload["value"] != nil,
	}); err == nil {
		log.Printf("Event payload summary: %s", dbg)
	}

	batchID := ""
	if v, ok := payload["value"].(map[string]any); ok {
		if fields, ok := v["fields"].(map[string]any); ok {
			if fld, ok := fields["batchID"].(map[string]any); ok {
				if s, ok := fld["stringValue"].(string); ok {
					batchID = s
				}
			}
		}
	}

	if batchID == "" {
		log.Println("No batchID found in event payload; skipping")
		return nil
	}

	_, err := client.Collection(BATCH_COLLECTION_ID).Doc(batchID).Update(ctx, []firestore.Update{
		{Path: BATCH_TOTAL_FILES_FIELD_ID, Value: firestore.Increment(delta)},
	})
	if err != nil {
		log.Println("Failed to update batch count:", err)
		return err
	}
	log.Printf("Updated batch %s: %s %+d", batchID, BATCH_TOTAL_FILES_FIELD_ID, delta)
	return nil
}
