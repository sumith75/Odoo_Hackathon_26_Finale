# DealFlow360 Production Backend Dockerfile
FROM node:18-alpine AS runner

WORKDIR /app

# Install production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source code and config
COPY . .

ENV PORT=5000
ENV NODE_ENV=production

EXPOSE 5000

CMD ["node", "src/server.js"]
