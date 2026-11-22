# Story 2.3: Pioche et modes de deck

Status: review

## Story

As a joueur,
I want piocher une carte à chaque tour dans la bonne pioche,
So that le jeu respecte le mode choisi.

## Acceptance Criteria

**Given** le mode pioche partagée
**When** un tour commence
**Then** le joueur actif pioche la carte du dessus du deck commun
**And** avec 10 cartes en main, la carte piochée va au cimetière
**And** deck vide → les deux cimetières sont remélangés (graine) ; tout vide → pas de pioche
**And** en mode decks personnels aléatoires, le deck est coupé en deux moitiés égales et chacun pioche dans la sienne

## Tasks / Subtasks

- [x] Implémenter le comportement décrit par les critères d'acceptation
- [x] Écrire les tests correspondants (`describe('2.3 …')` ou tests du paquet)
- [x] Vérifier `pnpm typecheck` et `pnpm test`

## Dev Notes

- Architecture : `_bmad-output/game-architecture.md` (moteur pur, réducteur, stats dérivées, erreurs typées).
- Règles : `_bmad-output/planning-artifacts/gdds/gdd-cinecards-2026-11-22/gdd.md`.

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5

### Completion Notes List

- Le mode decks aléatoires laisse la 51ᵉ carte hors jeu (nombre impair).
- Résultat : `pnpm typecheck` OK, `pnpm test` 24/24 OK (2026-11-22).

### File List

- packages/engine/src/turn/turn.ts
- packages/engine/src/state/create.ts
- packages/engine/src/engine.test.ts

## Change Log

- 2026-11-22 — Implémentation initiale (mode autonome).
