# ---- deps ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
# ---- build ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build
# ---- run ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3100
ENV DB_PATH=/data/academy.db
RUN addgroup -S app && adduser -S app -G app && mkdir -p /data && chown app:app /data
COPY --from=builder /app/public ./public
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
# server sources (db/auth/seed run outside the Next bundle)
COPY --from=builder --chown=app:app /app/src/server ./src/server
COPY --from=builder --chown=app:app /app/package.json ./package.json
USER app
EXPOSE 3100
VOLUME ["/data"]
CMD ["sh", "-c", "node src/server/seed.js && node server.js"]
