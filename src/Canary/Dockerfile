# syntax=docker/dockerfile:1

# ---------- Builder: build Vite app ----------
FROM node:20-alpine AS builder
WORKDIR /app

# Install deps first (better layer cache)
COPY package*.json ./
# Install dependencies (use install to tolerate out-of-sync lockfiles in CI)
RUN npm install

# Copy source
COPY . .

# Build with the 'cloudrun' mode so Vite loads .env.cloudrun
ENV NODE_ENV=production
RUN npm run build -- --mode cloudrun

# ---------- Runtime: serve static via NGINX ----------
FROM nginx:alpine AS runtime

# Listen on Cloud Run default port and enable SPA fallback
COPY nginx.conf /etc/nginx/nginx.conf

# Static assets
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
