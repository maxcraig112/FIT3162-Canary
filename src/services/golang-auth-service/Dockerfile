# syntax=docker/dockerfile:1

# -------- Build stage --------
FROM golang:1.23-alpine AS builder

# We'll mirror the repo's top-level layout under /workspace so that
# `replace pkg => ../../pkg` resolves correctly to /workspace/pkg
WORKDIR /workspace

# Install tools needed for go mod fetch
RUN apk add --no-cache ca-certificates git

# Copy the entire repository (no .dockerignore present per user)
COPY . .

# Move into the service directory to manage modules and build
WORKDIR /workspace/src/Services/golang-auth-service

# Cache deps and download modules
RUN --mount=type=cache,target=/go/pkg/mod \
	--mount=type=cache,target=/root/.cache/go-build \
	go mod download

# Build the service (static, linux/amd64)
RUN --mount=type=cache,target=/go/pkg/mod \
	--mount=type=cache,target=/root/.cache/go-build \
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/auth-service ./

# -------- Runtime stage --------
FROM gcr.io/distroless/base-debian12:nonroot AS runtime
WORKDIR /app

# Copy binary
COPY --from=builder /out/auth-service /app/auth-service

# Provide defaults/config via .env for godotenv (non-secret). This allows
# Cloud Run to pick defaults if env vars are not set.
# If you prefer managing env strictly in Cloud Run, you can remove this.
COPY --from=builder /workspace/src/Services/golang-auth-service/.env.cloudrun /app/.env

# Cloud Run listens on 8080 by convention
ENV PORT=8080
EXPOSE 8080

# Run as nonroot (distroless default user exists)
USER nonroot:nonroot

ENTRYPOINT ["/app/auth-service"]

