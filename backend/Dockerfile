# DealFlow360 Production Backend Dockerfile
FROM node:18-alpine AS runner

WORKDIR /app

# Prisma schema must be present before install, so the client can be
# generated during the postinstall hook (or explicitly below).
COPY package*.json ./
COPY prisma ./prisma

# Install production dependencies
RUN npm ci --only=production

# Copy remaining source code and config
COPY . .

# Ensure the Prisma client is generated against the copied schema,
# regardless of whether the postinstall hook already did it.
RUN npx prisma generate

ENV PORT=5000
ENV NODE_ENV=production

EXPOSE 5000

CMD ["node", "src/server.js"]
