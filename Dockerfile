# Multi-stage build
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Runtime Stage
FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3580

# Install curl, ca-certificates, tzdata, libc6-compat
RUN apk add --no-cache curl ca-certificates tzdata gzip bash libc6-compat

# Download Mihomo Linux binary (auto-detect amd64 / arm64) to /usr/local/bin and /app
RUN ARCH=$(uname -m) && \
    if [ "$ARCH" = "x86_64" ]; then TARGET="amd64"; \
    elif [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then TARGET="arm64"; \
    else TARGET="amd64"; fi && \
    echo "Downloading Mihomo for architecture: $TARGET ($ARCH)..." && \
    (curl -sL "https://github.com/MetaCubeX/mihomo/releases/download/v1.19.0/mihomo-linux-${TARGET}-v1.19.0.gz" -o /tmp/mihomo.gz || \
     curl -sL "https://ghfast.top/https://github.com/MetaCubeX/mihomo/releases/download/v1.19.0/mihomo-linux-${TARGET}-v1.19.0.gz" -o /tmp/mihomo.gz) && \
    gzip -d /tmp/mihomo.gz && \
    chmod +x /tmp/mihomo && \
    mv /tmp/mihomo /usr/local/bin/mihomo && \
    cp /usr/local/bin/mihomo /app/mihomo

COPY package*.json ./
RUN npm install --omit=dev

# Copy built frontend & backend files
COPY --from=builder /app/dist ./dist
COPY backend ./backend

EXPOSE 3580

VOLUME ["/app/data"]

CMD ["node", "backend/server.js"]
