# Multi-stage Dockerfile optimized for low memory usage (< 512MB RAM)
FROM node:20-alpine AS builder

WORKDIR /app

# Enable low memory overhead for node operations
ENV NODE_OPTIONS="--max-old-space-size=460"
ENV CI=true

# Install dependencies with clean cache
COPY package.json package-lock.json ./
RUN npm install --prefer-offline --no-audit

# Copy source files
COPY . .

# Build client and server bundles
RUN npm run build

# Production runner stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=460"
ENV PORT=3000

# Copy node_modules and built dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/client ./client
COPY --from=builder /app/vite.config.ts ./vite.config.ts

EXPOSE 3000

CMD ["npx", "vite", "preview", "--host", "0.0.0.0", "--port", "3000"]
