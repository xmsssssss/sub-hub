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

# Download Mihomo Linux amd64 binary
RUN curl -sL https://github.com/MetaCubeX/mihomo/releases/download/v1.19.0/mihomo-linux-amd64-v1.19.0.gz -o /app/mihomo.gz \
    && gzip -d /app/mihomo.gz \
    && chmod +x /app/mihomo

COPY package*.json ./
RUN npm install --omit=dev

# Copy built frontend & backend files
COPY --from=builder /app/dist ./dist
COPY backend ./backend

EXPOSE 3580

VOLUME ["/app/data"]

CMD ["node", "backend/server.js"]
