# CineCards — instructions for agents

Private web card duel (pnpm monorepo, TypeScript): `packages/engine` (pure rules), `packages/cards`
(schema + loader), `content/sets/*.json` (cards), `apps/client` (Vite + React, "Grimoire" UI),
`apps/server` (Colyseus). Code and comments in English; player-facing text in French.

## Source of truth
- Rules: `_bmad-output/planning-artifacts/gdds/gdd-cinecards-2026-11-22/gdd.md` (Root's paper rules win).
- Architecture: `_bmad-output/game-architecture.md`. Stories: `_bmad-output/planning-artifacts/epics.md`.
- Progress: `_bmad-output/implementation-artifacts/sprint-status.yaml`. Epics 1-8 and 10-13 are done (2026-11-23);
  epic 9 waits for Root's cards. Epic 12 = per-action visual feedback (spec `planning-artifacts/retours-visuels-actions.md`,
  approved animated demo `docs/design/animations/demo.html`); epic 13 = playtest-2 fixes.

## Working autonomously (decided by Root, 2026-11-22)
- **One story at a time, in order.** Create the story file with `gds-create-story`, implement it
  with `gds-dev-story`, then update the story file and `sprint-status.yaml`. Don't ask the user;
  choose sensible defaults.
- **Rule ambiguities:** pick the reading closest to the paper game, mark it `[ASSUMPTION]` in the
  GDD (and its index), add a line to `_bmad-output/implementation-artifacts/a-valider-par-root.md`,
  and keep going.
- **Card texts (story 11.6):** follow table 4.3 of the change proposal. Keep the movie quotes
  (ability names) unchanged. List every changed text in `a-valider-par-root.md`.
- **Definition of done:** `pnpm typecheck`, `pnpm test` and `pnpm e2e` green. For e2e here, run
  `PW_CHANNEL=chromium pnpm e2e -- --trace off`. When several agents work in parallel worktrees, give each its own ports
  (`E2E_SERVER_PORT` / `E2E_CLIENT_PORT`, e.g. 2667/5274) so their e2e servers don't collide. If the story touches the engine or the cards, the
  200-game simulation must also pass.
- **Agents in parallel (retrospective of epics 8 and 10, 2026-11-23):** stories may be built in parallel worktrees,
  but merge them into `main` **one at a time**: rebase, resolve, then rerun `pnpm typecheck`, `pnpm test` and the full
  e2e suite after *each* merge. Conflicts in stylesheets are resolved by keeping both blocks whole, never by gluing
  conflict halves (a lost `}` broke every page twice). Before e2e, make sure no stale server listens on the e2e ports.
  When two agents report the same problem as "out of scope", it becomes a task.
- **Ship:** commit and push straight to `main`. The game lives at https://cinecards.sevend.io/: the
  game server also serves the built client (story 8.6, `CLIENT_DIR` in the Docker image), so the VPS
  autodeploy below ships client and server together. GitHub Pages is now the old site (a "moved"
  banner, no passkeys); pushes don't start GitHub Actions (account-level issue), so to refresh the old
  site start the Pages workflow yourself with the GitHub MCP tool `actions_run_trigger`
  (`run_workflow`, workflow `pages.yml`, ref `main`) and check the run succeeds with `actions_list`.
- **Server:** the VPS pulls `main` and rebuilds within about 5 minutes
  (`deploy/autodeploy.sh`, systemd timer), client included. The old Pages site and pages already open
  in a browser still run an older client, so keep each protocol change backward compatible for one
  release: the new server accepts the old client's messages, and the new client tolerates the old
  server's view.
- **Commits:** end messages with the Co-Authored-By / Claude-Session lines given in the session.
  Never put model names in commits or code.

## Visual changes (Root, retrospective of epic 13, 2026-11-23)
- **Mockup first, then Root chooses, then build.** Any change to layout, sizes, timing or effects starts with a mockup
  (before/after when something already exists), Root picks an option, and only then the story is coded.
- **Desktop stays as it is unless Root asks.** Phone-only behaviour lives behind the portrait-phone layout. Root
  choosing a desktop change on a mockup counts as asking; nothing else does. Prove desktop is unchanged with
  `scripts/compare-desktop.mjs` when a story is meant to be phone-only.
- **Readability:** text (damage numbers, labels, names) may change size between desktop and phone, but information
  the player needs is never hidden and never goes below a readable size. Mockups that change a size show the
  smallest real case (a 45 px desktop table card, a 47 px card on a 360 px phone).
- **Definition of done for an animation story:** also regenerate the demo-vs-game contact sheets
  (`scripts/compare-demo.mjs`) and look at them before calling the story done.

## Commands
```bash
pnpm install --frozen-lockfile
pnpm typecheck && pnpm test
PW_CHANNEL=chromium pnpm e2e -- --trace off
pnpm dev:server   # ws://localhost:2567
pnpm dev:client   # http://localhost:5173
```
