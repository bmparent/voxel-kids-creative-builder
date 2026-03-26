# Multi-stage build for Cloud Run
# Stage 1: Build frontend
FROM node:20-slim AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Production runtime
FROM node:20-slim AS runtime

WORKDIR /app

# Install only production deps + tsx for running TypeScript
COPY package*.json ./
RUN npm ci --omit=dev && npm install tsx

# Copy built frontend + server source
COPY --from=builder /app/dist ./dist
COPY shared/ ./shared/
COPY services/ ./services/

ENV NODE_ENV=production
ENV PORT=8080

# Cloud Run expects the container to listen on $PORT
EXPOSE 8080

CMD ["npx", "tsx", "services/gateway/index.ts"]
