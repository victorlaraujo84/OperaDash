# syntax=docker/dockerfile:1

FROM node:24-alpine AS build
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.25.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM node:24-alpine AS runtime
WORKDIR /app

RUN mkdir /data && chown node:node /data
COPY server/portal.mjs server/start.mjs ./server/
COPY --from=build /app/dist ./dist
ENV OPERADASH_DATA_DIR=/data
USER node

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1/healthz || exit 1

CMD ["node", "server/start.mjs"]
