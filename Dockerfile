# Multi-stage Dockerfile for Kolo SME Backend
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache openssl libc6-compat

COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/

RUN npm ci --legacy-peer-deps
RUN npx prisma generate

COPY backend ./backend
COPY tests ./tests

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

RUN apk add --no-cache openssl curl

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 kolo

COPY --from=builder --chown=kolo:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=kolo:nodejs /app/package*.json ./
COPY --from=builder --chown=kolo:nodejs /app/prisma ./prisma
COPY --from=builder --chown=kolo:nodejs /app/backend ./backend
COPY --from=builder --chown=kolo:nodejs /app/tests ./tests
COPY --from=builder --chown=kolo:nodejs /app/tsconfig.json ./

USER kolo

EXPOSE 3000

CMD ["npx", "tsx", "backend/server.ts"]
