# Handoff → next Claude session (2026-11-23)

Read this first, then `AGENTS.md` (how to work: autonomy rules, definition of done, shipping, e2e ports).
Talk to Root in **English**. Project documents stay in French, and code in English.

## Where we are
- **Live:**
  - Game: https://cinecards.sevend.io/ (served by the game server itself since story 8.6, same origin as
    `wss://cinecards.sevend.io` and `/api`; `/health` → `ok`)
  - Old site: https://seven74ai.github.io/cinecards/ (GitHub Pages, "CineCards a déménagé" banner, no passkeys)
- **Done:** epics 1–8 and 10–14. Epic 14 (2026-11-23) = phone table v2, mockup F (`docs/design/mobile-table-v2/`): no zoom, terrain/spell rows, hand folded behind the fan button, compact or detailed view (full cards) chosen in « Réglages » (phone only). `main` passes typecheck, 317 unit tests and 65/65 e2e; live smoke test 11/11 on `d6eb89c`. Read `https://cinecards.sevend.io/api/smoke` with the `CF-Access-Client-Id` header (see below).
- **Deploy:**
  - **Game:** deployed with the server below (the Docker image builds the client with `VITE_SERVER_URL=same-origin`).
  - **Old site (Pages):** push to `main`, then start the Pages workflow yourself (GitHub MCP `actions_run_trigger`, `run_workflow`, `pages.yml`, ref `main`). Push-triggered Actions are broken on the GitHub account side, and Hermes and Root agreed not to chase it.
  - **Server:** the VPS pulls `main` and rebuilds within ~5 min (`deploy/autodeploy.sh`, systemd timer set up by Hermes). Keep protocol changes backward compatible for one release.
- **Tracking:** `_bmad-output/implementation-artifacts/sprint-status.yaml`. Plan: `_bmad-output/planning-artifacts/epics.md`. Rules: the GDD (`planning-artifacts/gdds/gdd-cinecards-2026-11-22/gdd.md`). History of decisions: `decision-log.md` next to it.

## Waiting on Root (go through these first)
- **Nothing pending:** `a-valider-par-root.md` is fully validated (batches 1-9, 2026-11-22/23; batch 9 = stories 13.13–13.15). Neo's doubling stays uncapped until a playtest between humans; the 3 s spotlight also stays on the bot's spells and arrival effects. Root's rule: a saved deck is never changed automatically (GDD, Deck Building).
- **Fixed 2026-11-22:** after an automatic reconnection the client saved a stale seat token (the SDK fires
  `onReconnect` before storing the new one), so a later return was refused. See `watchSeatToken` in `apps/client/src/net/online.ts`.
- **Parked by Root:** the iPhone `?fps` check and performance tests (2026-11-22), and the playtest with friends until the real cards are in (2026-11-23). Do not bring them up until Root does.


## Cloudflare Access (since 2026-11-23)
- Every `*.sevend.io` subdomain, the game included, is behind Cloudflare Access: players get an e-mail code, then the game.
- Automated checks use a service token. The **Client Secret** is a network secret on this cloud environment (header
  `CF-Access-Client-Secret`, injected by the proxy for `cinecards.sevend.io`). The **Client ID** is not secret: send
  `CF-Access-Client-Id: bdb9bca10221ff4b0763ad9f3d8f1335.access` yourself, e.g. `curl -H "CF-Access-Client-Id: …" https://cinecards.sevend.io/api/health`.
- Plain HTTP works this way. Browser WebSocket handshakes from this container do not (browsers send no custom header
  on them, and a local relay did not get an upgrade through the proxy), so live duels/invites can't be driven from
  here: rely on the local e2e suite and API checks.
- Logged-in API calls through Access fail **from this container only** ("session expirée": the proxy rule for the
  host interferes with `Authorization`). Root confirmed on a phone (2026-11-23) that "Amis" and "Historique" work:
  players are not affected. Don't "fix" the game for this.
- `deploy/autodeploy.sh` checks `http://localhost:2567/health` on the VPS since 2026-11-23 (the public address is behind Access).
- **Checking a deploy (story 8.7):** after `/health`, autodeploy runs the live smoke test inside the game container
  (`scripts/smoke.mjs`: accounts, friends, presence, invitation, duel, emote, concede, history, constructed decks).
  Read its result over plain HTTP: `curl -H "CF-Access-Client-Id: bdb9bca10221ff4b0763ad9f3d8f1335.access"
  https://cinecards.sevend.io/api/smoke` → `{ ok, commit, startedAt, durationMs, steps }`. Check that `commit` is
  the one you pushed (the VPS updates within ~5 min) and `ok` is true; a failed step has an `error`.

## Next options (let Root choose)
- Animation timing hook: `Cue.retime(ms)` (`game/playback.ts`) lets the director stretch a beat to the travel it measured;
  `TRAVEL_REF`, `fxScale` and `shakeScale` live in `game/motion.ts`.
- **Epic 9, importing Root's ~500 cards:** Root brings a sample of his format in about a week. Existing saved decks must
  not be changed by the import (they just become invalid if their cards change).

## How we worked (keep doing it)
- **Process:** BMAD/GDS workflows. `gds-correct-course` for playtest feedback becomes stories in `epics.md` plus `sprint-status.yaml`, then dev agents implement them.
- **Dev agents:** run them in background worktrees with a precise brief (files, root causes, ACs, the commit trailer, and their own e2e ports `E2E_SERVER_PORT`/`E2E_CLIENT_PORT`). Each ships to `main` and starts Pages. Clean up the worktrees afterwards.
- **Verify before reporting:** re-run typecheck and tests, and look at the agent's screenshots. For animations, use the demo-vs-game contact sheets (`scripts/compare-demo.mjs`) before telling Root something is done. Root caught a mismatch once, when the phone animations were too small.
- **Visual changes:** mockup first, then Root picks, then build.
  - Card frames: D + E + F, in `docs/design/card-frames/`.
  - Phone layout: B (overview + zoom), in `docs/design/mobile-table/`.
  - Animations: `docs/design/animations/demo.html`, live at https://claude.ai/artifact/4FcvFHDxdeVDJY4gxQMkwN.
- **Phone tempo:** phone-only behaviour lives behind the portrait-phone layout. `PHONE_TEMPO` (1.25) and the easing palette are in `apps/client/src/game/motion.ts`. Desktop must not change unless Root asks (choosing it on a mockup counts). Visual rules and the readability rule: `AGENTS.md`, "Visual changes".
