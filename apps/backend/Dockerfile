# ===========================================================================
# Mehfil Backend (NestJS + Prisma) — production image.
# Build context MUST be the repo root (npm workspaces monorepo):
#   docker build -f apps/backend/Dockerfile -t mehfil-backend .
# On Railway: set Root Directory = "/" and Dockerfile Path = "apps/backend/Dockerfile".
# ===========================================================================

# ---- deps: install only the workspaces the backend needs -------------------
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/backend/package.json apps/backend/package.json
# Present so npm can resolve the workspace glob, but not installed:
COPY apps/web/package.json apps/web/package.json
COPY apps/mobile/package.json apps/mobile/package.json
RUN npm ci --workspace @mehfil/shared --workspace @mehfil/backend

# ---- build: compile shared + backend, generate Prisma client --------------
FROM node:20-alpine AS build
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build --workspace @mehfil/shared \
  && npm run prisma:generate --workspace @mehfil/backend \
  && npm run build --workspace @mehfil/backend

# ---- runtime: lean production image ---------------------------------------
FROM node:20-alpine AS runtime
RUN apk add --no-cache openssl curl
WORKDIR /app
ENV NODE_ENV=production
# node_modules from build (includes the generated Prisma client + prisma CLI
# used for `migrate deploy` on boot).
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/apps/backend ./apps/backend

# Media volume mount point (set UPLOAD_DIR=/data/uploads and attach a Railway
# volume mounted at /data/uploads so uploads persist across deploys).
RUN mkdir -p /data/uploads
VOLUME ["/data/uploads"]

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s \
  CMD curl -fsS "http://127.0.0.1:${PORT:-4000}/health" || exit 1

# Apply migrations, then start. (Seed is a separate one-off: see runbook.)
CMD ["sh", "-c", "npm run prisma:deploy --workspace @mehfil/backend && npm run start:prod --workspace @mehfil/backend"]
