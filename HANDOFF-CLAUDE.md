# Handoff → Claude: CineCards is deployed (read this first)

Hermes deployed CineCards. It is live. **One issue is left for you** (bottom).

## Deployed URLs
- Client: https://seven74ai.github.io/cinecards/
- Server (WebSocket): `wss://cinecards.sevend.io`
- Health: https://cinecards.sevend.io/health → `ok`

## Architecture (differs from the original handoff)
The original plan (A record + bundled Caddy on ports 80/443) is **not possible** on the VPS:
UFW only allows SSH (22) + Tailscale. Everything on sevend.io runs through the Cloudflare
Tunnel `sevend-io-stream`.

- **Server**: Docker (`deploy/docker-compose.yml`), Colyseus. Binds host loopback
  `127.0.0.1:2567` only. **No Caddy** — client is on Pages, nothing to serve;
  HTTPS/WSS terminate at the Cloudflare edge.
- **Tunnel route**: `cinecards.sevend.io` → `http://localhost:2567`
  (added to `sevend-io-stream`, config version 10).
- **DNS**: CNAME `cinecards.sevend.io` → `d7845cc0-00f8-49e9-ae7f-c97f48699303.cfargotunnel.com`
  (proxied).
- **Client**: GitHub Pages. Actions variable `CINECARDS_SERVER_URL = wss://cinecards.sevend.io`
  (baked into the bundle via `VITE_SERVER_URL` at build time).

## Repo changes (already committed + pushed to `main`)
- `deploy/docker-compose.yml` — server only, `ports: ["127.0.0.1:2567:2567"]` (was server + Caddy on 80/443)
- `deploy/Caddyfile` — deleted
- `docs/deploy.md` — rewritten to the tunnel flow
- `HANDOFF-HERMES.md` — deleted

## OPEN ISSUE — for you
**Pushes to `main` do not trigger GitHub Actions** (neither `ci.yml` nor `pages.yml`).
Verified repeatedly. What *does* work: `gh workflow run "Deploy client to GitHub Pages"`
(`workflow_dispatch`).

Already ruled out:
- Token has `workflow` scope (`X-OAuth-Scopes: ... repo, workflow`)
- Actions `enabled: true`, `allowed_actions: all`
- Workflow files valid and on `main` (both registered `active`)
- Not a fork, no branch protection, default branch = `main`
- GitHub status: Actions + Git operational

So the site is live, but a future `git push` to `main` will **not** rebuild/redeploy
automatically. Diagnose + fix. Candidates to check: how the push events arrive vs the
workflow `on: push: branches: [main]` (a PushEvent was recorded but no run was created),
any org/user-level Actions policy, or a `.github` config subtlety. Until fixed, run the
Pages workflow manually after each push.

## Deploy / update commands (VPS)
```bash
cd /root/cinecards && git pull
cd deploy && docker compose up -d --build
curl https://cinecards.sevend.io/health   # → ok
```
Client: push to `main`, then run the Pages workflow manually (until push-trigger is fixed).
