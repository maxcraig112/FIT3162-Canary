

# Project & Batch API Reference

| Method | API Prefix                                    | Description                                    | Raw JSON Input Example                                                      | RequiredAuth |
| ------ | --------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------- | ------------ |
| GET    | /projects/{userID}                           | List all projects for a user                   | None                                                                        | Yes          |
| POST   | /projects                                    | Create a new project                           | { "userID": "string", "projectName": "string" }                          | Yes          |
| PUT    | /projects/{projectID}                        | Rename a project                               | { "newProjectName": "string" }                                            | Yes          |
| DELETE | /projects/{projectID}                        | Delete a project                               | None                                                                        | Yes          |
| PATCH  | /projects/{projectID}/numberoffiles          | Increment number of files in a project         | { "quantity": int }                                                        | Yes          |
| PATH   | /projects/{projectID}/settings               | Update project settings                        | { "tagLabels": { "keyPoints": ["string"], "boundingBoxes": ["string"] } } | Yes          |
| POST   | /batch                                       | Create a new batch                             | { "projectID": "string", "batchName": "string" }                          | Yes          |
| PUT    | /batch/{batchID}                             | Rename a batch                                 | { "newBatchName": "string" }                                              | Yes          |
| DELETE | /batch/{batchID}                             | Delete a batch                                 | None                                                                        | Yes          |
| GET    | /projects/{projectID}/batches                | List all batches for a project                 | None                                                                        | Yes          |
| PATCH  | /batch/{batchID}/numberofTotalFiles          | Increment number of total files in a batch     | { "quantity": int }                                                        | Yes          |
| PATCH  | /batch/{batchID}/numberofAnnotatedFiles      | Increment number of annotated files in a batch | { "quantity": int }                                                        | Yes          |

All endpoints require authentication (AuthMw is applied).
