# Implementation notes — epics 3 to 7 (MVP)

Date: 2026-11-22 · Status: implemented, self-reviewed, all automated checks green.

| Check | Result |
|---|---|
| `pnpm typecheck` | ok |
| `pnpm test` (Vitest) | 77 tests passing (engine 66, cards 3, server 5, client/protocol 3) |
| Simulation 200 random games (story 4.5) | 200/200 finished, 105/95 wins, 0 crash — `docs/simulation-report.md` |
| `pnpm e2e` (Playwright, 2 browsers + real server) | passing |
| `pnpm build:client` | ok (main chunk 478 kB, online SDK lazy-loaded 174 kB) |

## Epic 3 — effect system
Engine files: `packages/engine/src/{ctx.ts,effects/*,play/*,combat/combat.ts,turn/turn.ts}`.
Tests: `effects.test.ts` (generic DSL: chain, auras, statuses, cycles, reaction window) and
`cards.test.ts` (each card's effects). Simplifications agreed earlier: Switch's cancel-death and
Arthur's return-on-death trigger automatically; Néo's counter-attack uses a reaction window.

## Epic 4 — the 51 MVP cards
`content/sets/*.json` encode every ability with the DSL; `support.ts` reports any unknown op
(none left). `cards.test.ts` has at least one scenario per card. `bot.ts` (random legal policy)
drives the simulation and the in-app "S'entraîner contre le Grimoire" mode.

## Epic 5 — Grimoire table UI (`apps/client/src`)
- 5.1 `ui/CardView.tsx`, `styles.css` (gold frame, parchment, rarity gem, status icons, cycle countdown)
- 5.2 mobile portrait table, 2×5 rune-circle slots, 5 terrain seals + 5 spell runes per player (`ui/Table.tsx`)
- 5.3 tap a hand card → glowing free slots or "Jouer"; target picking for effects
- 5.4 tap a ready character → glowing targets (cards or protected hero)
- 5.5 `ui/CardSheet.tsx` bottom sheet / docked inspector with stat provenance and ability buttons
- 5.6 journal (`game/describe.ts`, French lines), drawer on mobile, left column on desktop
- 5.7 refusals → French toast (`i18n/fr.ts`, every ErrorCode)
- 5.8 ≥1100 px: 3 columns (journal / table with 10-wide rows / inspector); landscape phones: 10-wide rows
- 5.9 hot-seat with a "pass the device" screen hiding the next player's hand; bonus: bot mode

## Epic 6 — online
- 6.1 `apps/server/src/room.ts` (Colyseus `DuelRoom`), `duel.ts` (network-free controller)
- 6.2 5-letter codes without look-alikes (`codes.ts`), link `?salle=CODE`, share sheet (`ui/Lobby.tsx`)
- 6.3 `redact.ts`: opponent hand, piles and RNG hidden; draw events anonymised
- 6.4 75 s turn timer (auto-resolves pending, then ends the turn); 6.5 5 s reaction auto-pass
- 6.6 90 s reconnection (`allowReconnection`), "opponent away" banner, reload resume via session token
- 6.7 `Dockerfile`, `deploy/docker-compose.yml` + `Caddyfile`, `.github/workflows/pages.yml`, `docs/deploy.md`
- 6.8 `e2e/online-duel.spec.ts`

## Epic 7 — juice
- 7.1 embers, flickering candle light, slowly spinning rune circles, floating home cards
- 7.2 `game/fx.ts` turns each event batch into timed beats (damage/heal numbers, shake, death burst)
- 7.3 legendary card entrance overlay; 7.4 synthesized Web Audio sounds with a mute toggle (`audio/sfx.ts`)
- 7.5 tumbling die that lands on the engine's value (`ui/Dice.tsx`)
- `prefers-reduced-motion` disables motion everywhere

## Self code review — fixed during review
- Overlay timers (dice, legendary) restarted on every re-render → callbacks held in refs.
- Animation timers were cancelled by the next event batch, leaving numbers stuck → timers now live until unmount.
- Inner board components were re-created each render (remounting cards) → plain render functions.
- `/health` route collided with Colyseus' HTTP router → answered before it.

## Known limits / to validate with Root
- Balance not tuned by humans yet (random-bot data only); games may run long.
- Matrix has 12 illustrations; other cards use set/role emblems until art arrives (epic 9).
- Docker image not built in this sandbox (no Docker); the server itself is tested over real WebSockets.
