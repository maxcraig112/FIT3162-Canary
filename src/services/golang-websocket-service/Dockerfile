# syntax=docker/dockerfile:1

# -------- Build stage --------
FROM golang:1.24 AS builder

WORKDIR /workspace

# Install build tooling for CGO (gcc etc.), git, ca-certs
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        ca-certificates \
        git \
        pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Copy the entire repository
COPY . .

# Move into the service directory (case-sensitive on Linux)
WORKDIR /workspace/src/services/golang-websocket-service

# Cache deps and download modules
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go mod download

# Build the service with CGO enabled
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=1 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o /out/websocket-service ./

# -------- Runtime stage --------
FROM gcr.io/distroless/base-debian12:nonroot AS runtime
WORKDIR /app

COPY --from=builder /out/websocket-service /app/websocket-service
COPY --from=builder /workspace/src/services/golang-websocket-service/.env.cloudrun /app/.env

ENV PORT=8080
EXPOSE 8080

USER nonroot:nonroot

ENTRYPOINT ["/app/websocket-service"]
