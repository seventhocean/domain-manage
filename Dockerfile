# ---- Build Stage ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- Run Stage ----
FROM node:22-alpine

# Install nginx
RUN apk add --no-cache nginx

WORKDIR /app

# Copy backend
COPY --from=builder /app/node_modules ./node_modules
COPY package.json server.js store.js ./

# Copy frontend
COPY public/ ./public/

# Copy nginx config
COPY nginx.conf /etc/nginx/http.d/default.conf

# Create data dir
RUN mkdir -p /app/data/screenshots && \
    mkdir -p /run/nginx && \
    chown -R node:node /app

USER node

EXPOSE 80

# Start nginx + node in one container
CMD nginx && node server.js
