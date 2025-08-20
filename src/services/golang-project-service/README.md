# Project Requests

| Method | Endpoint                            | Description                                   | JSON/Form Data                                                            |
| ------ | ----------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------- |
| GET    | /projects                           | Returns all projects owned by a user as JSON. | None                                                                      |
| GET    | /projects/{projectID}               | Returns a specific owned by a user as JSON.   | None                                                                      |
| POST   | /projects                           | Creates a new project.                        | { "userID": "string", "projectName": "string" }                           |
| PUT    | /projects/{projectID}               | Renames a project.                            | { "newProjectName": "string" }                                            |
| DELETE | /projects/{projectID}               | Deletes a project.                            | None                                                                      |
| PATCH  | /projects/{projectID}/numberoffiles | Increments the number of files in a project.  | { "quantity": int }                                                       |
| PATCH   | /projects/{projectID}/settings      | Updates project settings.                     | { "tagLabels": { "keyPoints": ["string"], "boundingBoxes": ["string"] } } |

# Batch Requests

| Method | Endpoint                                | Description                                            | JSON/Form Data                                   |
| ------ | --------------------------------------- | ------------------------------------------------------ | ------------------------------------------------ |
| POST   | /batch                                  | Creates a new batch.                                   | { "projectID": "string", "batchName": "string" } |
| PUT    | /batch/{batchID}                        | Renames a batch.                                       | { "newBatchName": "string" }                     |
| DELETE | /batch/{batchID}                        | Deletes a batch.                                       | None                                             |
| GET    | /projects/{projectID}/batches           | Returns all batches associated with a project as JSON. | None                                             |
| PATCH  | /batch/{batchID}/numberofTotalFiles     | Increments the number of total files in a batch.       | { "quantity": int }                              |
| PATCH  | /batch/{batchID}/numberofAnnotatedFiles | Increments the number of annotated files in a batch.   | { "quantity": int }                              |

# Image Requests

| Method | Endpoint                | Description                                                                                                                                           | JSON/Form Data      |
| ------ | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| GET    | /batch/{batchID}/images | Returns all image metadata for a batch as JSON.                                                                                                       | None                |
| POST   | /batch/{batchID}/images | Uploads multiple images to a batch. Multipart form-data field (files). Images are saved to the bucket and metadata is created in Firestore. | Multipart form-data |
