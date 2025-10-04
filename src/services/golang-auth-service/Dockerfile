# syntax=docker/dockerfile:1

# -------- Build stage --------
FROM golang:1.23-alpine AS builder

WORKDIR /workspace

# Install gcc, musl-dev (libc headers), and git/ca-certificates for fetching modules
RUN apk add --no-cache ca-certificates git build-base

COPY . .

WORKDIR /workspace/src/services/golang-auth-service

RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go mod download

RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o /out/auth-service ./

# -------- Runtime stage --------
FROM gcr.io/distroless/base-debian12:nonroot AS runtime
WORKDIR /app

COPY --from=builder /out/auth-service /app/auth-service
COPY --from=builder /workspace/src/services/golang-auth-service/.env.cloudrun /app/.env

ENV PORT=8080
EXPOSE 8080

USER nonroot:nonroot

ENTRYPOINT ["/app/auth-service"]
