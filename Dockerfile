# Multi-stage build
FROM node:20-slim AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Runtime Stage (Debian Bookworm slim with native glibc, fully compatible with Mihomo Linux binaries)
FROM node:20-slim

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3580

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates tzdata gzip bash \
    && rm -rf /var/lib/apt/lists/*

# Download Mihomo Linux binary (compatible with v1/v2/v3 AMD64 microarchitecture & ARM64)
RUN ARCH=$(uname -m) && \
    if [ "$ARCH" = "x86_64" ]; then TARGET="amd64-compatible"; \
    elif [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then TARGET="arm64"; \
    else TARGET="amd64-compatible"; fi && \
    echo "Downloading Mihomo for architecture: $TARGET ($ARCH)..." && \
    (curl -sL "https://github.com/MetaCubeX/mihomo/releases/download/v1.19.0/mihomo-linux-${TARGET}-v1.19.0.gz" -o /tmp/mihomo.gz || \
     curl -sL "https://ghfast.top/https://github.com/MetaCubeX/mihomo/releases/download/v1.19.0/mihomo-linux-${TARGET}-v1.19.0.gz" -o /tmp/mihomo.gz) && \
    gzip -d /tmp/mihomo.gz && \
    chmod 755 /tmp/mihomo && \
    mv /tmp/mihomo /usr/local/bin/mihomo && \
    cp /usr/local/bin/mihomo /app/mihomo && \
    chmod 755 /app/mihomo && \
    /usr/local/bin/mihomo -v

COPY package*.json ./
RUN npm install --omit=dev

# Copy built frontend & backend files
COPY --from=builder /app/dist ./dist
COPY backend ./backend

EXPOSE 3580

VOLUME ["/app/data"]

CMD ["node", "backend/server.js"]
