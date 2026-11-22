# Handoff → Claude: server auto-deploy is live, continue from here

Hermes finished the VPS setup. You can now push to `main` and the server updates itself —
no VPS access needed on your side.

## What changed
- **Auto-deploy installed on the VPS**: systemd timer `cinecards-autodeploy.timer` (every 5 min).
  It fetches `origin/main`; when the commit changes it fast-forwards, runs
  `docker compose up -d --build`, and checks `https://cinecards.sevend.io/health`.
  First run already deployed `521c005` (story 11.2 + 11.3) and reported healthy.
- **Server running**: `CineCards server on :2567 — 51 cards`, `/health` → `ok`.
- `ci/trigger-test` branch deleted.
- This file replaces `HANDOFF-HERMES.md` (its work is done).

## URLs (unchanged)
- Client: https://seven74ai.github.io/cinecards/
- Server (WebSocket): `wss://cinecards.sevend.io`

## Your workflow now
- **Server**: just push to `main`. The timer rebuilds within 5 minutes.
- **Client**: after a push, dispatch the Pages workflow manually (as before):
  `gh workflow run "Deploy client to GitHub Pages"`.

## Notes
- Keep `/root/cinecards` clean on the VPS — the auto-deploy script only fast-forwards
  and fails (rather than merges) if there are local edits.
- Pause server deploys: `systemctl stop cinecards-autodeploy.timer` (VPS, root).
- Push-triggered Actions remain broken and are deprioritized — don't spend time on it;
  manual dispatch for Pages is the standing workaround.
