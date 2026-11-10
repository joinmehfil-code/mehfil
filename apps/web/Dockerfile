# ===========================================================================
# Mehfil Web (Next.js 14, standalone output) — production image.
# Build context MUST be the repo root (npm workspaces monorepo):
#   docker build -f apps/web/Dockerfile \
#     --build-arg NEXT_PUBLIC_API_URL=https://api.joinmehfil.co/api \
#     --build-arg NEXT_PUBLIC_SOCKET_URL=https://api.joinmehfil.co/rt \
#     -t mehfil-web .
# On Railway: Root Directory = "/", Dockerfile Path = "apps/web/Dockerfile",
# and set the NEXT_PUBLIC_* variables (they are inlined at BUILD time).
# ===========================================================================

# ---- deps -----------------------------------------------------------------
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/backend/package.json apps/backend/package.json
COPY apps/mobile/package.json apps/mobile/package.json
RUN npm ci --workspace @mehfil/shared --workspace @mehfil/web

# ---- build ----------------------------------------------------------------
FROM node:20-alpine AS build
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* must be present at build time (Next inlines them into the bundle).
ARG NEXT_PUBLIC_APP_NAME=Mehfil
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SOCKET_URL
ARG NEXT_PUBLIC_WEB_URL
ARG NEXT_PUBLIC_API_PROXY_TARGET
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME \
  NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
  NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL \
  NEXT_PUBLIC_WEB_URL=$NEXT_PUBLIC_WEB_URL \
  NEXT_PUBLIC_API_PROXY_TARGET=$NEXT_PUBLIC_API_PROXY_TARGET \
  NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace @mehfil/shared \
  && npm run build --workspace @mehfil/web

# ---- runtime --------------------------------------------------------------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
  NEXT_TELEMETRY_DISABLED=1 \
  PORT=3000 \
  HOSTNAME=0.0.0.0
# Standalone output mirrors the monorepo layout (server.js at apps/web/server.js).
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
