# Production Dockerfile for PrisonGuard Core Server
FROM node:20-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=5000

# Install dependencies (only production dependencies)
COPY package*.json ./
RUN npm ci --only=production

# Copy source code and data directory
COPY src/ ./src/
RUN mkdir -p data

# Expose server port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/health || exit 1

# Start server
CMD ["node", "src/index.js"]
