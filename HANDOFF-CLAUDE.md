# Handoff → next Claude session (2026-11-22)

Read this first, then `AGENTS.md` (how to work: autonomy rules, definition of done, shipping, e2e ports).
Talk to Root in **English**. Project documents stay in French, and code in English.

## Where we are
- **Live:**
  - Game: https://cinecards.sevend.io/ (served by the game server itself since story 8.6, same origin as
    `wss://cinecards.sevend.io` and `/api`; `/health` → `ok`)
  - Old site: https://seven74ai.github.io/cinecards/ (GitHub Pages, "CineCards a déménagé" banner, no passkeys)
- **Done:** epics 1–7, 8 (accounts, passkeys, friends, history, emotes, new address) and 10 (constructed decks), plus (MVP), 11 (playtest-1 fixes), 12 (per-action animations) and 13 (playtest-2 fixes, stories 13.1–13.12). `main` passes typecheck and 152 unit tests (including the 200-game simulation). The last full e2e run reported 38/38.
- **Deploy:**
  - **Game:** deployed with the server below (the Docker image builds the client with `VITE_SERVER_URL=same-origin`).
  - **Old site (Pages):** push to `main`, then start the Pages workflow yourself (GitHub MCP `actions_run_trigger`, `run_workflow`, `pages.yml`, ref `main`). Push-triggered Actions are broken on the GitHub account side, and Hermes and Root agreed not to chase it.
  - **Server:** the VPS pulls `main` and rebuilds within ~5 min (`deploy/autodeploy.sh`, systemd timer set up by Hermes). Keep protocol changes backward compatible for one release.
- **Tracking:** `_bmad-output/implementation-artifacts/sprint-status.yaml`. Plan: `_bmad-output/planning-artifacts/epics.md`. Rules: the GDD (`planning-artifacts/gdds/gdd-cinecards-2026-11-22/gdd.md`). History of decisions: `decision-log.md` next to it.

## Waiting on Root (go through these first)
- **Done 2026-11-22:** Root validated all of `a-valider-par-root.md` (batches 1-4b). Neo's doubling stays uncapped
  until a playtest between humans; the 3 s spotlight also stays on the bot's spells and arrival effects.
- **Fixed 2026-11-22:** after an automatic reconnection the client saved a stale seat token (the SDK fires
  `onReconnect` before storing the new one), so a later return was refused. See `watchSeatToken` in `apps/client/src/net/online.ts`.
- **Parked by Root (2026-11-22):** the iPhone `?fps` check and further performance tests. Do not bring them up until Root does.


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

## Next options (let Root choose)
- **Ideas on hold:** three animation ideas (see `epics.md`, "Idées en attente"): travel time based on distance, effect size relative to the card, shake scaled to the screen.
- **Playtest:** a full playtest with friends (`gds-playtest-plan` can prepare it).
- **Epic 9, importing Root's ~500 cards:** needs a sample of Root's current format first.
- **Epic 8:** accounts, friends, history, emotes.
- **Epic 10, constructed decks:** needs Root's deck rules (deck size, copies allowed).

## How we worked (keep doing it)
- **Process:** BMAD/GDS workflows. `gds-correct-course` for playtest feedback becomes stories in `epics.md` plus `sprint-status.yaml`, then dev agents implement them.
- **Dev agents:** run them in background worktrees with a precise brief (files, root causes, ACs, the commit trailer, and their own e2e ports `E2E_SERVER_PORT`/`E2E_CLIENT_PORT`). Each ships to `main` and starts Pages. Clean up the worktrees afterwards.
- **Verify before reporting:** re-run typecheck and tests, and look at the agent's screenshots. For animations, use the demo-vs-game contact sheets (`scripts/compare-demo.mjs`) before telling Root something is done. Root caught a mismatch once, when the phone animations were too small.
- **Visual changes:** mockup first, then Root picks, then build.
  - Card frames: D + E + F, in `docs/design/card-frames/`.
  - Phone layout: B (overview + zoom), in `docs/design/mobile-table/`.
  - Animations: `docs/design/animations/demo.html`, live at https://claude.ai/artifact/4FcvFHDxdeVDJY4gxQMkwN.
- **Phone tempo:** phone-only behaviour lives behind the portrait-phone layout. `PHONE_TEMPO` (1.25) and the easing palette are in `apps/client/src/game/motion.ts`. Desktop must not change unless Root asks.
