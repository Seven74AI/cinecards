# CineCards: the game server (Colyseus) and the game itself, served by the server at / (story 8.6).
# Build from the repository root:
#   docker build -t cinecards-server .
FROM node:24-alpine
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages ./packages
COPY apps/server ./apps/server
COPY apps/client ./apps/client
COPY content ./content
# the client's keyword glossary (apps/client/src/game/glossary.ts)
COPY _bmad-output/planning-artifacts/glossaire-mots-cles.md ./_bmad-output/planning-artifacts/
RUN pnpm install --frozen-lockfile --filter @cinecards/server... --filter @cinecards/client... --prod=false
# same origin for the page, /api and the WebSocket; passkeys on (bound to this domain)
RUN VITE_SERVER_URL=same-origin pnpm --filter @cinecards/client build
ENV NODE_ENV=production PORT=2567 CONTENT_DIR=/app/content/sets DATA_DIR=/app/data CLIENT_DIR=/app/apps/client/dist
# accounts database and its daily copies (story 8.1); mounted as a named volume in deploy/docker-compose.yml
RUN mkdir -p /app/data
EXPOSE 2567
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:2567/health || exit 1
CMD ["node", "--experimental-transform-types", "--no-warnings", "apps/server/src/main.ts"]
