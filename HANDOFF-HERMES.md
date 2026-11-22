# Handoff → Hermes: deploy CineCards (temporary file, delete after deploy)

Hi Hermes. Root asked you to put CineCards online. Everything is already built and tested;
your job is **deployment only**. Talk to Root in French.

## What CineCards is
A browser card game (movies, "grimoire" theme), mobile first. Two pieces:

| Piece | Where | Tech |
|---|---|---|
| Client (the game) | **GitHub Pages** | React + Vite, static files in `apps/client/dist` |
| Game server (online duels) | **Root's VPS** (Docker) | Node 24 + Colyseus, port 2567, WebSocket |

Local modes (hot-seat, vs bot) work without the server. Only the "En ligne" tab needs it.

## 0. Ask Root first
- The subdomain to use, e.g. `cinecards.<his-domain>` (he has a domain; subdomain is not chosen yet).
- Confirm the repo can be **public** if his GitHub plan is free (Pages on private repos needs a paid plan).
  The repo holds 12 Matrix screenshots in `content/art/matrix/` (private use between friends).

## 1. DNS
Create an **A record** `cinecards.<domain>` → VPS public IP. Ports **80 and 443** must be open
(Caddy gets the HTTPS certificate automatically). If something already listens on 80/443 on the VPS
(nginx, another Caddy, Traefik), do **not** start the bundled Caddy: see "Existing reverse proxy" below.

## 2. Server on the VPS
Requires Docker + Docker Compose v2.

```bash
git clone <this repo> cinecards
cd cinecards/deploy
DOMAIN=cinecards.<domain> docker compose up -d --build
curl -fsS https://cinecards.<domain>/health      # → ok
docker compose logs -f server                     # banner + "CineCards server on :2567 — 51 cards"
```

Files: `Dockerfile` (repo root, build context = root), `deploy/docker-compose.yml`, `deploy/Caddyfile`.
The image runs `node --experimental-transform-types apps/server/src/main.ts` (no build step).
Env: `PORT` (2567), `CONTENT_DIR` (`/app/content/sets`).

Note: the Docker image was **never built** in the dev sandbox (no Docker there). If `pnpm install`
fails in the image, check that `pnpm-lock.yaml` is committed and that corepack picks pnpm 10.28
(`packageManager` field in `package.json`). The server itself is covered by tests over real WebSockets.

### Existing reverse proxy
Run only the `server` service (`docker compose up -d --build server`), publish 2567 on localhost
(add `ports: ["127.0.0.1:2567:2567"]`), and proxy the subdomain to it with WebSocket upgrade enabled.
nginx example:

```nginx
location / {
  proxy_pass http://127.0.0.1:2567;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_set_header Host $host;
  proxy_read_timeout 3600s;
}
```

### Updates
`git pull && DOMAIN=... docker compose up -d --build`

## 3. Client on GitHub Pages
1. Repo → **Settings → Pages → Source: GitHub Actions**.
2. Repo → **Settings → Secrets and variables → Actions → Variables** → new variable
   `CINECARDS_SERVER_URL` = `wss://cinecards.<domain>` (no trailing slash).
3. Push to `main` (or run the "Deploy client to GitHub Pages" workflow manually). Workflow:
   `.github/workflows/pages.yml`. Vite uses `base: './'`, so the project sub-path works as-is.
4. The page URL is `https://<owner>.github.io/<repo>/`.

`.github/workflows/ci.yml` also runs typecheck, unit tests and a Playwright e2e on each push.

## 4. Smoke test (do it, then tell Root)
1. Open the Pages URL on a phone → "Sur cet appareil → S'entraîner contre le Grimoire" plays.
2. Tab "En ligne" is enabled (if it says the server is not configured, the variable was missing at build time → re-run the workflow).
3. Create a duel in one browser, open the invite link (`?salle=CODE`) in another (private window) → both see the table; ending a turn switches sides.

## 5. Troubleshooting
- "Connexion au serveur impossible": check `/health`, the `wss://` URL in the variable, and that the proxy forwards WebSocket upgrades.
- Mixed content: Pages is HTTPS, so the server **must** be `wss://` (not `ws://`).
- Rules/timers live in `packages/engine/src/rules.ts` (75 s turn, 5 s reaction, 90 s reconnection).
- More detail (in French, for Root): `docs/deploy.md`.

## When done
Send Root the Pages URL and the server URL, then delete this file (`git rm HANDOFF-HERMES.md`).
