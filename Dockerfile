# CineCards game server (Colyseus). Build from the repository root:
#   docker build -t cinecards-server .
FROM node:24-alpine
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages ./packages
COPY apps/server ./apps/server
COPY content/sets ./content/sets
RUN pnpm install --frozen-lockfile --filter @cinecards/server... --prod=false
ENV NODE_ENV=production PORT=2567 CONTENT_DIR=/app/content/sets DATA_DIR=/app/data
# accounts database and its daily copies (story 8.1); mounted as a named volume in deploy/docker-compose.yml
RUN mkdir -p /app/data
EXPOSE 2567
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:2567/health || exit 1
CMD ["node", "--experimental-transform-types", "--no-warnings", "apps/server/src/main.ts"]
