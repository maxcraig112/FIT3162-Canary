# syntax=docker/dockerfile:1

# -------- Build stage --------
FROM golang:1.23-alpine AS builder

WORKDIR /workspace

# Install gcc, musl-dev (headers), git, and certs for CGO + go mod
RUN apk add --no-cache ca-certificates git build-base

# Copy the entire repository
COPY . .

# Move into the service directory (case-sensitive on Linux)
WORKDIR /workspace/src/services/golang-project-service

# Cache deps and download modules
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go mod download

# Build the service with CGO enabled
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=1 GOOS=linux GOARCH=amd64 go build -o /out/project-service ./

# -------- Runtime stage --------
FROM gcr.io/distroless/base-debian12:nonroot AS runtime
WORKDIR /app

COPY --from=builder /out/project-service /app/project-service
COPY --from=builder /workspace/src/services/golang-project-service/.env.cloudrun /app/.env

ENV PORT=8080
EXPOSE 8080

USER nonroot:nonroot

ENTRYPOINT ["/app/project-service"]
