# Project Requests

| Method | Endpoint                            | Description                                   | JSON/Form Data                                                            |
| ------ | ----------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------- |
| GET    | /projects/{userID}                  | Returns all projects owned by a user as JSON. | None                                                                      |
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

# Keypoint Label Requests

| Method | Endpoint                                                      | Description                                         | JSON/Form Data                                                   |
| ------ | ------------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------- |
| POST   | /projects/{projectID}/keypointlabels                          | Creates a new keypoint label.                       | { "keypointLabel": "string" }                                  |
| GET    | /projects/{projectID}/keypointlabels                          | Lists all keypoint labels for the project as JSON.  | None                                                             |
| PATCH  | /projects/{projectID}/keypointlabel/{keypointLabelID}         | Renames/updates a keypoint label.                   | { "keyPointLabelID": "string", "keypointLabel": "string" }    |
| DELETE | /projects/{projectID}/keypointlabel/{keypointLabelID}         | Deletes a keypoint label.                           | None                                                             |

Response model (GET):

- KeypointLabel: { "keyPointLabelID": "string", "keypointLabel": "string", "projectID": "string" }

# Keypoint Requests

| Method | Endpoint                                                              | Description                                             | JSON/Form Data                                                                 |
| ------ | --------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------ |
| POST   | /projects/{projectID}/images/{imageID}/keypoints                      | Creates a keypoint for an image.                        | { "position": { "x": number, "y": number }, "keypointLabelID": "string" } |
| GET    | /projects/{projectID}/images/{imageID}/keypoints                      | Lists keypoints for an image as JSON.                   | None                                                                             |
| GET    | /projects/{projectID}/keypoints/{keypointID}                          | Gets a single keypoint by ID as JSON.                   | None                                                                             |
| PATCH  | /projects/{projectID}/keypoints/{keypointID}                          | Updates keypoint position and/or label.                 | { "position": { "x": number, "y": number }, "keypointLabelID": "string" } |
| DELETE | /projects/{projectID}/keypoints/{keypointID}                          | Deletes a keypoint.                                     | None                                                                             |

Response model (GET):

- Keypoint: { "keypointID": "string", "imageID": "string", "position": { "x": number, "y": number }, "keypointLabelID": "string" }

Notes:

- For POST keypoints, imageID is taken from the URL path; you only need to provide position and keypointLabelID in the body.
- All routes are protected by JWT auth middleware; include Authorization: Bearer <token>.
