---
title: 'Game Architecture'
project: 'cinecards'
date: '2026-11-22'
author: 'Root'
version: '1.0'
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9]
status: 'complete'

# Source Documents
gdd: '_bmad-output/planning-artifacts/gdds/gdd-cinecards-2026-11-22/gdd.md'
epics: '_bmad-output/planning-artifacts/gdds/gdd-cinecards-2026-11-22/epics.md'
brief: '_bmad-output/planning-artifacts/briefs/brief-cinecards-2026-11-21/brief.md'
---

# Game Architecture — CineCards

> Written by Claude in autonomous mode at Root's request ("je te fais confiance"). Code and identifiers are in English; player-facing text is in French.

## Executive Summary

CineCards is a turn-based, two-player online card duel played in the browser, mobile first. The architecture separates three concerns that must never leak into each other:

1. **A pure, deterministic rules engine** (`@cinecards/engine`) — TypeScript, no I/O, no framework. It turns `(state, action)` into `(newState, events)`. Every rule of the GDD lives here and nowhere else.
2. **An authoritative game server** (Colyseus 0.18 on Node.js 24 LTS, hosted on Root's VPS) that owns the only real game state, validates every action through the engine, rolls the dice, runs the turn timer and reaction windows, and sends each player a **redacted view** (no peeking at the opponent's hand or the deck).
3. **A thin client** (React 19 + Vite 8, static files on GitHub Pages) that renders the Grimoire table, sends player intents, and plays the engine's events as animations.

Cards are **data**, not code: each card's text is paired with a structured effect description written in a small effect language (DSL) that the engine interprets. Adding Root's ~500 cards means adding JSON files, not touching the engine.

**Key decisions:** no game engine (DOM + CSS UI) · pure engine with seeded RNG · Colyseus authoritative rooms · redacted per-player views over messages · data-driven effect DSL · derived stats with modifier provenance · pnpm monorepo · GitHub Pages + VPS.

**Ready for:** epics and stories (`gds-create-epics-and-stories`), then implementation.

## Project Context

### Game Overview

**CineCards** (working title) — online adaptation of Root's paper card game: two friends duel with cards drawn from 1990s–2000s films; the computer acts as an automatic referee.

### Technical Scope

- **Platform:** web browser; phone portrait first (390 px reference), then landscape, tablet, desktop.
- **Genre:** card game (medium complexity).
- **Project level:** small team (Claude implements, Root validates), private use, no monetization.

### Core Systems

| System | Complexity | GDD reference |
| --- | --- | --- |
| Rules engine (turn, coins, draw, play, combat, victory) | High | Game Mechanics, Turn Structure |
| Effect system (22 keywords, triggers, auras, cycles, dice, choices) | High | Card Types and Effects |
| Resolution chain + anti-infinite-loop | Medium | Card Types and Effects |
| Reaction windows (out-of-turn plays) | Medium | Turn Structure |
| Online duel (private room, sync, timer, reconnection) | Medium | Game Modes, Win/Loss |
| Deck modes (shared / random personal) | Low | Deck Building |
| Table UI, mobile first, Grimoire look | Medium | Art Style, Controls |
| Animation/event playback, audio | Medium | Art and Audio Direction |
| Card data pipeline (51 → ~500 cards) | Medium | Asset Requirements |

### Technical Requirements

60 FPS on a 2022 mid-range phone · first playable screen < 3 s on 4G · action latency < 300 ms player-to-player in-country · 90 s reconnection window · 75 s turn timer · 5 s reaction window · server-side dice.

### Complexity Drivers

- **Rules breadth:** many interacting effects (absorb, copy, auras by family, every-N-turns cycles, lethal damage, multi-attack, revive/summon from graveyard).
- **Out-of-turn interaction:** reactions interrupt the active player's flow and pause the timer.
- **Hidden information online:** hands and decks must stay secret.
- **Content scale:** ~500 cards authored by a non-programmer.

### Technical Risks

| Risk | Mitigation |
| --- | --- |
| Card texts that the DSL cannot express | DSL designed from all 51 MVP cards; an `unsupported` effect flag blocks a card from the deck until handled; one test per card |
| Desync between players | Single authoritative state on the server; clients never compute outcomes |
| Infinite effect loops | Once-per-chain guard + 50-effect chain cap (GDD) |
| Brand-new tool versions (TypeScript 7, Vite 8) | Pin exact versions; fall back to TypeScript 5.9 if a tool breaks |
| TLS for WebSocket from an HTTPS page | Caddy reverse proxy with automatic certificates on the VPS (needs a domain or subdomain) |

## Engine & Framework

### Selected Stack

No game engine. A card game is a UI of panels, text and CSS animations — exactly what the browser DOM does best, and what the Grimoire mockups are already built with. Canvas engines (Phaser, PixiJS) would add weight without benefit.

| Layer | Choice | Version (verified 2026-11-22) |
| --- | --- | --- |
| Language | TypeScript | 7.0.x |
| Client UI | React | 19.3.x |
| Client build | Vite | 8.3.x |
| Multiplayer server | Colyseus (`colyseus`, `@colyseus/core`) | 0.18.x |
| Client SDK | `@colyseus/sdk` | 0.18.x |
| Runtime (server, tooling) | Node.js | 24 LTS |
| Package manager | pnpm (workspaces) | 12.x |
| Data validation | Zod | 4.x |
| Unit / integration tests | Vitest | 5.x |
| End-to-end tests | Playwright | 1.65.x |

Colyseus 0.18 is the current release; it adds request/response messaging and builds reconnection resync on Schema 5. It supports private rooms joinable by ID for invite links, and holding a player's seat with `allowReconnection()` so they can rejoin. Node 24 "Krypton" is an LTS line with end-of-life planned for 2028-04-30.

### Project Initialization

```bash
pnpm init && pnpm add -Dw typescript@7 vitest@5
mkdir -p apps/client apps/server packages/engine packages/cards packages/protocol
pnpm create vite apps/client --template react-ts
pnpm --filter server add colyseus @colyseus/core @colyseus/schema
pnpm --filter client add @colyseus/sdk
```

### Provided by the Stack

| Component | Solution | Notes |
| --- | --- | --- |
| Rendering | DOM + CSS | Grimoire visuals from the design canvas |
| Animation | CSS keyframes + Web Animations API | Respect `prefers-reduced-motion` |
| Input | Pointer events (touch + mouse) | Drag-and-drop and tap-tap |
| Transport | Colyseus WebSocket | wss through Caddy |
| Rooms, seats, reconnection | Colyseus Room | `allowReconnection(client, 90)` |
| Build / dev server | Vite | Static output for GitHub Pages |

### Remaining Decisions

Covered in the Decision Summary below: state ownership, view redaction, effect DSL, RNG, timers, data pipeline, persistence, hosting, audio.

## Decision Summary

| Category | Decision | Version | Affects epics | Rationale |
| --- | --- | --- | --- | --- |
| Engine | No game engine; DOM/CSS UI | — | E3, E5 | Card UI = panels and text; mockups already DOM/CSS |
| Language | TypeScript everywhere, shared types | 7.0 | All | One language for engine, server, client |
| Rules | Pure deterministic engine package | — | E1, E2 | Testable, shared, no desync |
| Randomness | Seeded PRNG stored in game state (mulberry32) | — | E1, E4 | Server-side dice; reproducible tests and bug reports |
| State model | Reducer: `apply(state, action) → {state, events}` | — | E1 | Simple, replayable, event list drives animations |
| Derived stats | Stats computed from base + modifier list with source | — | E1, E3 | Never drift; UI shows bonus origin (pillar 2) |
| Effects | Data-driven DSL interpreted by engine | — | E1, E2, E7 | ~500 cards without new code |
| Card data | One JSON file per set, Zod schema, validated at build | Zod 4 | E2, E7 | Non-programmer authoring, early errors |
| Multiplayer | Colyseus authoritative room `duel` | 0.18 | E4 | Rooms, reconnection, clock built in |
| Sync | Messages carrying redacted `PlayerView` + events; Colyseus Schema only for room metadata | Schema 5 | E4 | Hidden info is simple to guarantee |
| Room codes | 6-char code (unambiguous alphabet) mapped to room ID | — | E4 | Shareable link `…/#/join/NEO4K7` |
| Timers | Server clock online (75 s turn, 5 s reaction, 90 s reconnection); local session runs the same 75 s clock in solo and hot seat; views carry remaining ms, not an absolute time | — | E4, E11 | Authoritative online, immune to client clock skew, paused during reactions |
| Client state | Zustand store fed by server messages | 5.x | E3 | Small, React-friendly |
| Animation | Sequential event queue in client | — | E3, E5 | Events from engine play one after another |
| Audio | Web Audio API micro-service, ~10 sound files | — | E5 | No dependency needed |
| Persistence (MVP) | None — rooms in memory | — | E4 | No accounts in MVP |
| Persistence (post-MVP) | `node:sqlite` (built into Node 24), one file `DATA_DIR/cinecards.db` on a Docker volume, repository module `apps/server/src/db`, numbered migrations, daily copy on the VPS | Node 24 | E6, E8 | Accounts, friends, history, decks; no extra service (ADR-008, amended 2026-11-22) |
| Authentication (post-MVP) | Passwords: `node:crypto` scrypt with random salt. Passkeys: WebAuthn via `@simplewebauthn/server` + `@simplewebauthn/browser`, relying party = client host (`seven74ai.github.io`, `localhost` in dev). Opaque random session token stored hashed, sent as `Authorization: Bearer` to `/api/*` and in room join options; no cookies (cross-site, Safari) | — | E6 | Root's choice: passkey + recovery code, and nickname + password |
| HTTP API (post-MVP) | `/api/*` on the game server's port, JSON, CORS limited to the client origin | — | E6, E8 | Accounts, friends, history, decks |
| Presence (post-MVP) | Colyseus room `hub` joined by logged-in players: friends online, live invitations | 0.18 | E6 | Invitation without sharing a code |
| Client hosting | GitHub Pages via GitHub Actions | — | All | Free, Root's preference |
| Server hosting | Root's VPS, Docker + Caddy (auto TLS) | Node 24 | E4 | Always-on process needed |
| Monorepo | pnpm workspaces | 12 | All | Shared packages, one install |
| i18n | French UI strings in one module; card text in data | — | E3 | Code English, text French |
| Testing | Vitest (engine, server), Playwright (2-browser E2E) | 5 / 1.65 | All | One rules test per card |

## Novel Pattern Designs

### P1 — Effect DSL and resolution chain

**Challenge:** card texts are free French prose with many interacting effects; the engine must execute them exactly and stay extensible.

**Shape:** each ability in card JSON keeps its human `text` and gains machine `effects`:

```json
{
  "name": "Le p'tit derrière toi c'est l'Mulo",
  "kind": "active",
  "text": "TOUTES les cartes du monde de « MATRIX » gagnent +40 ATQ / +50 PV.",
  "effects": [
    { "op": "modify", "target": { "side": "any", "family": "matrix", "category": "character" },
      "atk": 40, "hp": 50, "duration": "permanent" }
  ]
}
```

- **Triggers (revised after playtest 1, see `planning-artifacts/sprint-change-proposal-2026-11-22.md`):** three families.
  - *Triggered effects* (default for strong effects): `onPlay`, `onAllyPlayed(filter)`, `onEnemyPlayed(filter)`, `onDeath`, `startOfTurn`, `endOfTurn`, `onAttack`, `onAttacked`, `onKill`, `reaction`, `cycle(n)`. An **event registry** maps each engine event to subscribed abilities; adding an event never touches existing cards. Choices (targets, options) are asked when the trigger fires.
  - *Attack abilities* (`attackAbility`): used **instead of** the character's normal attack, once per turn, sharing the `usedAttack` flag and attack eligibility (haste included). Reserved for modest repeatable effects.
  - *Passives* (auras).
  - Modifiers `oncePerGame` and `cooldown {every:N}` still apply. `choice` is an option shape usable by any trigger. A repeatable ability never draws more than 1 card, grants stacking permanent buffs to several cards, or controls several enemy cards.
- **Ops (initial set):** `damage`, `heal`, `modify`, `setStats`, `copyStats`, `absorb`, `shield`, `status` (silence, poison, immune, insensible), `cleanse`, `draw`, `lookAndPick`, `returnToHand`, `summonFrom`, `destroyWhere`, `extraAttacks`, `ranged`, `lethal`, `noRetaliation`, `coinBonus`, `coinCapBonus`, `revive`, `cancelDeath`, `dice` (branches by roll range), `chooseOne`, `playFree`.
- **Targets:** `self`, `chosen` (player picks, with filter; `count` and `min`, `min = 0` by default — "choose N" means up to N, `min = count` only for "exactly N"; the engine never fills an incomplete pick at random), `all`, `adjacent`, `random`, filters by `side`, `family`, `role`, `category`, `name`.
- **Resolution chain:** effects push onto a queue; triggered effects append; a guard prevents the same ability from firing twice in one chain; hard cap of 50 effects (GDD). The chain emits one event per resolved effect.
- **Unsupported text:** an ability may carry `"effects": [{ "op": "unsupported", "note": "…" }]`; such cards are excluded from decks and listed by a CI report.

### P2 — Derived stats with provenance

Characters store only `baseHp`, `baseAtk`, `damage` taken, and a list of `modifiers` (`{source: cardInstanceId, ability, atk, hp, until}`). Current ATK/HP are computed on demand by `computeStats()`, which also returns the list of contributing sources. Auras (passive bonuses, terrains) are not stored: they are recomputed from the board each time, so removing a card removes its bonus automatically. The UI's "origine des bonus" panel reads this list.

### P3 — Reaction windows

After an opponent's spell or attack is declared, the engine returns `pendingReaction: { playerId, options, expiresAt }` if the non-active player has a legal reaction; otherwise the action resolves immediately. The server pauses the turn timer, opens a 5 s window, and resolves with the chosen reaction or "pass". The engine stays pure: the window is just a state the reducer can be in.

### P4 — Cycles ("tous les N tours")

Every card instance records `playedOnOwnerTurn`. A cycle effect is active when `(ownerTurn − playedOnOwnerTurn) % N === N − 1` `[ASSUMPTION: first activation on the N-th turn after play]`. The UI shows a countdown from the same function.

## Implementation Patterns

These patterns ensure consistent implementation across all AI agents:

- **Engine purity:** `packages/engine` imports nothing from `apps/*`, Colyseus, React, DOM or Node APIs. No `Date.now()`, no `Math.random()` — time and randomness come from the state/RNG.
- **Actions and events:** actions are a discriminated union `{ type: 'playCard' | 'attack' | 'useAbility' | 'react' | 'pass' | 'endTurn' | 'concede', … }`; events are past-tense `{ type: 'cardPlayed' | 'damageDealt' | 'cardDestroyed' | 'diceRolled' | … }`. Every state change produces at least one event.
- **Validation first:** `apply()` returns `{ ok: false, error: { code, params } }` for illegal actions (e.g. `NOT_ENOUGH_COINS`); the client maps codes to French messages. Never throw for rule violations.
- **Immutability:** the reducer returns new state objects (structural sharing via plain spreads); tests compare states.
- **Redaction:** the server alone calls `viewFor(state, playerId)`; it hides the opponent's hand (count only) and all decks (count only).
- **Component communication (client):** components read from the Zustand store and dispatch intents through one `gameClient` service; no component talks to Colyseus directly.
- **Entity creation:** card instances are created only by the engine's `instantiate(cardId)` factory (unique `instanceId`, base stats from data).
- **State transitions:** game phase is an explicit state machine `lobby → mulligan(none) → turnStart → main → (reactionWindow) → turnEnd → … → finished`.

## Consistency Rules

### Naming Conventions

| Element | Convention | Example |
| --- | --- | --- |
| Files | kebab-case | `compute-stats.ts`, `duel-room.ts` |
| React components | PascalCase file and name | `CardTile.tsx` |
| Types / interfaces | PascalCase | `GameState`, `PlayerView` |
| Functions / variables | camelCase | `applyAction`, `coinCap` |
| Constants | UPPER_SNAKE | `MAX_HAND_SIZE = 10` |
| Card IDs | `{set}-{slug}` | `mx-neo`, `hg-black-knight` |
| Set IDs | kebab-case | `holy-grail` |
| Action / event types | camelCase strings | `playCard` / `cardPlayed` |
| Error codes | UPPER_SNAKE | `TARGET_NOT_ALLOWED` |
| CSS | CSS Modules, kebab-case classes | `card-tile.module.css` |

### Code Organization

Feature folders inside each package (`engine/src/combat`, `engine/src/effects`, `client/src/table`, `client/src/card-sheet`). Game constants from the GDD live in `engine/src/rules.ts` (single source: hand size, slots, coin caps, timers).

### Error Handling

- Rule violations: typed results, never exceptions (see above).
- Programming errors in the engine: throw; the server catches, logs, ends the room with a "partie interrompue" message and keeps the state dump for debugging.
- Network errors: Colyseus auto-reconnect on the client; UI shows a "reconnexion…" banner; after 90 s the server ends the game.
- Rejoining (revised after playtest 1): the seat reconnection token is kept in `localStorage` keyed by room code, so a new tab or a reload can resume. Joining by code with a valid token reclaims the reserved seat instead of failing on the locked room. "Quitter" is a voluntary disconnect with the same 90 s window; only "Abandonner" concedes. A lobby room is not disposed when its host leaves; it expires after 10 minutes. Join errors are distinct: not found, full, game in progress (resume?).

### Logging Strategy

- **Server:** structured JSON logs (`pino`), levels ERROR/WARN/INFO/DEBUG; one INFO line per room lifecycle event; DEBUG includes actions.
- **Game journal:** the engine's event list is the player-visible log and the replay source; on any engine error the server writes `{seed, actions[]}` to `logs/rooms/` so the game can be replayed exactly.
- **Client:** console logs only in development builds.

### Configuration

- Rule constants: `engine/src/rules.ts`.
- Balancing: card JSON files only.
- Player settings (volume, reduced motion override): `localStorage`, wrapped in try/catch.
- Deployment: environment variables (`PORT`, `ALLOWED_ORIGIN`, `LOG_LEVEL`) on the server; `VITE_SERVER_URL` at client build time.

### Debug Tools

Development-only: seed override in the room URL, "give card" and "set coins" debug actions (rejected in production builds), state inspector panel in the client.

## Project Structure

### Organization Pattern

**Pattern:** pnpm monorepo, feature folders inside packages.
**Rationale:** the engine must be shared by server and client tests; cards and protocol types are shared contracts.

### Directory Structure

```
cinecards/
├── apps/
│   ├── client/                 # React + Vite, deployed to GitHub Pages
│   │   ├── src/
│   │   │   ├── app/            # routes: home, join, room, game
│   │   │   ├── table/          # board, slots, hand, banner, timer
│   │   │   ├── card/           # card tile, card sheet (long press), inspector
│   │   │   ├── fx/             # animation queue, audio service
│   │   │   ├── net/            # gameClient (Colyseus SDK wrapper)
│   │   │   ├── store/          # Zustand store
│   │   │   ├── i18n/fr.ts      # all French UI strings + error messages
│   │   │   └── theme/          # Grimoire tokens, fonts, global CSS
│   │   └── public/sounds/
│   └── server/                 # Colyseus, deployed to the VPS
│       ├── src/rooms/duel-room.ts
│       ├── src/codes.ts        # room code ↔ room ID
│       ├── src/view.ts         # viewFor(state, player)
│       └── Dockerfile
├── packages/
│   ├── engine/                 # pure rules engine (no I/O)
│   │   └── src/{rules.ts, state/, turn/, combat/, effects/, chain/, rng.ts, view.ts}
│   ├── cards/                  # Zod schema, loader, deck builders (shared, random-split)
│   └── protocol/               # message & view types shared by client and server
├── content/
│   ├── sets/*.json             # card data (Matrix, Holy Grail, Hot Shots!, White Chicks…)
│   └── art/                    # card images, emblems
├── docs/reference/             # Root's paper card scans
├── _bmad/ _bmad-output/        # BMAD config and planning artifacts
└── .github/workflows/          # CI tests + Pages deploy
```

### System Location Mapping

| System | Location |
| --- | --- |
| Turn, coins, draw | `packages/engine/src/turn` |
| Combat, riposte, victory | `packages/engine/src/combat` |
| Effects DSL interpreter | `packages/engine/src/effects` |
| Resolution chain, anti-loop | `packages/engine/src/chain` |
| Derived stats | `packages/engine/src/state/compute-stats.ts` |
| Card schema, deck modes | `packages/cards` |
| Room, timers, reconnection | `apps/server/src/rooms` |
| Table UI | `apps/client/src/table` |
| Animations, audio | `apps/client/src/fx` |

### Architectural Boundaries

`client` → `protocol`, `cards` (read-only data for display) · `server` → `engine`, `cards`, `protocol` · `protocol` → `engine` (re-exports Action, GameEvent, GameState types) · `engine` → `cards` types only · nothing imports `apps/*`. *(Amended during story 1.3: game types are owned by the engine.)*

## Epic to Architecture Mapping

| Epic | Packages / locations |
| --- | --- |
| E1 Rules engine | `packages/engine` |
| E2 MVP cards and effects | `content/sets`, `packages/cards`, `packages/engine/src/effects` |
| E3 Mobile-first table | `apps/client/src/{table,card,store,i18n,theme}` |
| E4 Online duel | `apps/server`, `packages/protocol`, `apps/client/src/net` |
| E5 Animations and sound | `apps/client/src/fx` |
| E6 Accounts and friends (post-MVP) | `apps/server/src/{db,auth,api}`, room `hub`, `apps/client/src/account` |
| E7 Content pipeline (post-MVP) | `content/`, `packages/cards`, CI report |
| E8 Constructed decks (post-MVP) | `packages/cards` (deck rules), `packages/engine` (deck mode `constructed`), server database, client deck builder |

## Data Architecture

- **Card (data):** `{ id, set, name, rarity, category, role, cost, hp, atk, element, bodies?, abilities[{ name, power{icon,count}, kind, text, effects[] }], image }`. `hp`/`atk` may be arrays for multi-body cards.
- **Set:** `{ id, title, year, family, cards[] }`.
- **CardInstance (state):** `{ instanceId, cardId, owner, zone, slot?, damage, modifiers[], statuses[], usedAbilities[], playedOnOwnerTurn, attacksLeft }`.
- **GameState:** `{ seed, rngState, mode: 'shared' | 'randomSplit', turn, activePlayer, phase, players[2]{ hp, coins, coinCap, hand[], graveyard[], deckRef, slots{characters[10], terrains[5], spells[5]} }, decks{ shared | perPlayer }, chain, pendingReaction?, winner? }`.
- **PlayerView:** GameState with opponent hand → count, decks → counts, rng hidden.

## API Contracts

Client → server messages (Colyseus `room.send`):

| Message | Payload |
| --- | --- |
| `action` | `Action` (discriminated union from `protocol`) |
| `emote` (post-MVP) | `{ id }` |

Server → client messages:

| Message | Payload |
| --- | --- |
| `view` | `{ view: PlayerView, events: GameEvent[], seq }` after each resolved action |
| `rejected` | `{ code, params }` for an illegal action |
| `reaction` | `{ options, expiresAt }` when a reaction window opens for this player |
| `timer` | `{ turnEndsAt }` on each turn start / resume |

HTTP: `POST /rooms` → `{ code, roomId }`; `GET /rooms/:code` → `{ roomId }` (join by code). Room options: `{ mode: 'shared' | 'randomSplit', nickname }`.

## Security Architecture

- Server-authoritative: every action re-validated by the engine; clients cannot set state.
- Hidden information never sent (redacted views).
- Room codes: 6 characters from a 31-letter unambiguous alphabet (~887 million combinations); rooms expire 10 minutes after creation if nobody joins.
- Origin check (`ALLOWED_ORIGIN` = the GitHub Pages URL), basic per-connection rate limit (20 messages/s).
- MVP stores no personal data (nickname only, in memory).
- Private use: film photos never published outside the friends group.

## Performance Considerations

- Only the client bundle is perf-critical: code-split the game route; card images lazy-loaded, WebP, ≤ 60 KB each; fonts subset (Cinzel, Cinzel Decorative, Alegreya).
- Animate only `transform` and `opacity`; cap simultaneous ambient effects (14 embers max); disable ambient effects when `prefers-reduced-motion`.
- Engine actions are O(cards on board); a full action resolves in < 5 ms on the server.
- Views are small JSON (< 20 KB); no binary schema needed for game state.

## Deployment Architecture

- **Client:** GitHub Actions builds `apps/client` on each push to `main` and publishes to GitHub Pages. `VITE_SERVER_URL=wss://<domain-du-VPS>`.
- **Server:** Docker image (Node 24) on Root's VPS behind **Caddy** (automatic HTTPS/WSS certificates). Single instance is enough for a friends group. Restart policy `unless-stopped`.
- **Requirement:** a subdomain of Root's existing domain pointing to the VPS (for TLS). Exact name configured at deployment time (E4).
- **CI:** lint, type-check, Vitest, card-data validation, Playwright smoke test on pull requests.

## Development Environment

### Prerequisites

Node.js 24 LTS, pnpm 12, Git, a modern browser; Docker on the VPS.

### AI Tooling (MCP Servers)

- **Context7** (`upstash/context7`): up-to-date docs for React, Vite, Colyseus, Zod — recommended, since several of these versions are newer than Claude's training data.
- **Playwright MCP** (optional): lets the AI drive two browsers to test a duel.

### Setup Commands

```bash
git clone <repo> cinecards && cd cinecards
pnpm install
pnpm test                 # engine + cards + server tests
pnpm dev                  # client on :5173, server on :2567
```

### First Steps

1. Scaffold the monorepo (`packages/engine`, `packages/cards`, `packages/protocol`, `apps/server`, `apps/client`).
2. Write the Zod card schema and load the four existing sets.
3. Implement the engine core (E1.1–E1.5) test-first, then the effect DSL against the 18 Matrix cards.

## Architecture Decision Records (ADRs)

- **ADR-001 No game engine.** DOM/CSS fits a card UI and reuses the Grimoire mockups. *Rejected:* Phaser/PixiJS (canvas text and layout cost, accessibility).
- **ADR-002 Pure deterministic engine with seeded RNG.** Enables per-card tests, exact replays of bug reports, and a single source of rules. *Rejected:* rules inside the server room (untestable in isolation).
- **ADR-003 Colyseus on the VPS.** Rooms, private join by ID, reconnection and clock are built in; Node and TypeScript match the stack; self-hostable for free. *Rejected:* raw Socket.IO (rebuild rooms and reconnection), boardgame.io (slower release pace), hosted realtime services (third-party dependency, quotas).
- **ADR-004 Redacted views over messages, not Colyseus Schema, for game state.** Hidden information is guaranteed by construction; the engine's plain objects need no schema mirror. Schema kept for room metadata only.
- **ADR-005 Data-driven effect DSL.** Root's ~500 cards become data; unsupported texts are surfaced explicitly instead of silently mis-played.
- **ADR-006 Derived stats with provenance.** No stat drift; delivers the GDD's "arbitre invisible" pillar (show where every bonus comes from).
- **ADR-007 GitHub Pages + VPS.** Free static hosting per Root's preference; the always-on game server lives on the VPS behind Caddy for TLS.
- **ADR-008 `node:sqlite` for post-MVP persistence** (2026-11-22). `@colyseus/database` 0.18 targets Postgres/PGlite and relies on `@colyseus/auth` (e-mail, OAuth), which Root ruled out. Node's built-in SQLite needs no extra service and fits a group of friends; the file lives on a Docker volume with a daily copy. *Rejected:* `@colyseus/database`, a hosted database, JSON files (no transactions).

## Architecture Validation

### Validation Summary

| Check | Result |
| --- | --- |
| Decision compatibility | Pass — React/Vite/Colyseus SDK all TypeScript; Colyseus 0.18 runs on Node 24 |
| GDD coverage | Pass — all 9 core systems mapped to a location |
| Pattern completeness | Pass — actions/events, errors, redaction, entity factory, state machine, DSL, provenance, reactions, cycles |
| Epic mapping | Pass — E1–E8 mapped |
| Document completeness | Pass — Root owns a domain; subdomain chosen at deployment |

### Coverage Report

**Systems covered:** 9/9 · **Novel patterns:** 4 · **Decisions:** 22 · **ADRs:** 7

### Open Items

- Subdomain name for the VPS: Root has a domain; to be set up during E4 deployment.
- `[ASSUMPTION]` P4 cycle phase (first activation on the N-th turn after play) — to confirm during E2 with Root's cards.

### Validation Date

2026-11-22

---

_Generated by BMAD Decision Architecture Workflow v1.0_
_Date: 2026-11-22_
_For: Root_
