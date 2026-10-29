# ==============================================================================
# FFMS Production Dockerfile - Node.js 22 Express + PostgreSQL Backend
# ==============================================================================
FROM node:22-alpine AS runtime
WORKDIR /app

# Run as non-root user
RUN addgroup -S ffmsgroup && adduser -S ffmsuser -G ffmsgroup

# Create persistent storage mount directory
RUN mkdir -p /var/data/uploads /var/data/logos && chown -R ffmsuser:ffmsgroup /var/data

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy backend source and frontend built assets
COPY backend ./backend
COPY frontend/dist ./frontend/dist

# Ensure proper ownership
RUN chown -R ffmsuser:ffmsgroup /app

USER ffmsuser

ENV NODE_ENV=production \
    PORT=5000 \
    STORAGE_PROVIDER=local \
    STORAGE_LOCAL_DIR=/var/data \
    STORAGE_UPLOAD_DIR=/var/data/uploads \
    STORAGE_LOGO_DIR=/var/data/logos

EXPOSE 5000

CMD ["node", "backend/src/server.js"]
