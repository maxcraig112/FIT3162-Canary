# syntax=docker/dockerfile:1

# -------- Build stage --------
FROM golang:1.23-alpine AS builder
WORKDIR /workspace

# Install CA certificates just in case modules download needs them
RUN apk add --no-cache ca-certificates git

# Copy the whole repo so local replace directives work (pkg => ../../pkg)
# Build context should be the repo root when building this image.
COPY . .

# Speed up builds with caches
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    cd src/Services/golang-auth-service \
    && CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/auth-service ./

# -------- Runtime stage --------
# Distroless base includes CA certs and runs as nonroot
FROM gcr.io/distroless/base-debian12:nonroot AS runtime
WORKDIR /app

# Copy binary
COPY --from=builder /out/auth-service /app/auth-service

# Optionally copy Cloud Run env file (not for secrets; keeps defaults/config)
# You can remove this if you prefer managing env vars strictly in Cloud Run.
COPY src/Services/golang-auth-service/.env.cloudrun /app/.env

# Cloud Run listens on 8080
ENV PORT=8080
EXPOSE 8080

# Run as nonroot (provided by distroless)
USER nonroot:nonroot

ENTRYPOINT ["/app/auth-service"]
