# golang-websocket-service

Real-time collaboration service for Canary. Provides WebSocket-based sessions where an owner and multiple members can connect to the same annotation context and receive live updates. Each client can independently watch Firestore label updates for the image they’re currently viewing without affecting other clients.

## What this service provides

- Session lifecycle over WebSockets

  - Owner creates a session from a batch; members join by sessionID.
  - Server tracks membership and persists it to Firestore.
  - Owner disconnect tears down the session; members are disconnected and the session is deleted.
  - Member disconnect removes the member from Firestore and notifies others.
- Per-client Firestore realtime watches

  - Each client selects an image to watch via a client message.
  - Only that client receives label/bounding-box notifications for the chosen image.
  - Changing the image stops the previous watch and starts a new one for that client.
- Safe messaging primitives

  - Non-blocking, panic-safe enqueue to client channels.
  - Writer goroutine per client handles keepalive and JSON writes to the socket.

## Environment & configuration

This service depends on the shared pkg stack for GCP clients and JWT.

- Required env vars (see main.go):
  - `PORT`: HTTP port to listen on.
  - `GCP_PROJECT_ID`: GCP project ID used to retrieve secrets.
  - `JWT_SECRET_NAME`: Secret Manager name for the JWT secret; value is loaded into `JWT_SECRET` at startup.
  - CORS (optional, with sensible fallbacks):
    - `CORS_ALLOW_ORIGIN` (default `*` in dev)
    - `CORS_ALLOW_METHODS`
    - `CORS_ALLOW_HEADERS`
    - `CORS_ALLOW_CREDENTIALS`

It also relies on Firestore collections used by the service layer (projects, batches, sessions, keypoints, bounding boxes) via the `websocket-service/firestore` stores.

## API reference

Base URL: `http://<host>:<PORT>`

- Health

  - GET `/health` → 200 OK, body: `OK`
- Sessions

  - POST `/sessions/{batchID}?userID=<ownerUserId>`

    - Upgrades to WebSocket and creates a session.
    - Body: none. Query params are used.
    - Path params:
      - `batchID` – Batch to create a session from.
    - Query params:
      - `userID` – Must match the project’s owner for the batch; otherwise 403.
    - On success: connection upgrades to WS and the owner is connected.
  - POST `/sessions/{sessionID}/join?userID=<memberUserId>`

    - Upgrades to WebSocket and joins the existing session.
    - Body: none. Query params are used.
    - Path params:
      - `sessionID` – Target session to join.
    - Query params:
      - `userID` – Added to the session if not already present.
    - On success: connection upgrades to WS and the member is connected.

### WebSocket messages (client → server)

All frames are JSON text.

- Set watched image for this client only

  - Type: `setImageID`
  - Payload: `{ "imageID": "<imageId>" }`
  - Effect: stops previous watches for this client; starts Firestore realtime watches for keypoints and bounding boxes on this image. Notifications are sent only to this client.
- Ping

  - Type: `ping`
  - Effect: server responds with `{ "type": "pong", "time": "<RFC3339>" }` to that client.

### WebSocket messages (server → client)

- Member status notifications (to all except the subject member):

  - `member_joined` and `member_left` with fields `{ type, sessionID, memberID, time }`.
- Per-client Firestore snapshots (to the client who set imageID):

  - `labels_snapshot` with `{ type, sessionID, time }` when keypoints change.
  - `bounding_boxes_snapshot` with `{ type, sessionID, time }` when bounding boxes change.
- Keepalive:

  - `keepalive` with `{ type, role, sessionID, time }` periodically.

## Validation and behavior

- Authorization

  - Create session: owner `userID` must match the project owner for the batch’s project; otherwise 403.
  - Join session: rejects if session does not exist (404) or user is already a member (409).
- Firestore consistency

  - On create: a session document is created with owner and initial members.
  - On join: member is added with lastUpdated timestamp.
  - On member disconnect: member is removed and `member_left` is broadcast.
  - On owner disconnect: all member connections are closed and the session document is deleted.
- Robustness

  - Channel sends use a panic-safe, non-blocking enqueue to avoid writes to closed channels.
  - Writer goroutine maintains keepalives and triggers cleanup on disconnect.
