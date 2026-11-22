# Story 2.1: Créer une partie et alterner les tours

Status: review

## Story

As a joueur,
I want qu'une partie démarre avec un deck mélangé, 7 cartes chacun et un premier joueur tiré au sort,
So that chaque partie commence équitablement.

## Acceptance Criteria

**Given** une graine et la liste des cartes
**When** `createGame({ seed, mode: 'shared' })` est appelé
**Then** chaque joueur a 7 cartes, 700 PV et le premier joueur est déterminé par la graine
**And** la même graine produit exactement la même partie
**And** `endTurn` passe la main à l'autre joueur et incrémente son numéro de tour

## Tasks / Subtasks

- [x] Implémenter le comportement décrit par les critères d'acceptation
- [x] Écrire les tests correspondants (`describe('2.1 …')` ou tests du paquet)
- [x] Vérifier `pnpm typecheck` et `pnpm test`

## Dev Notes

- Architecture : `_bmad-output/game-architecture.md` (moteur pur, réducteur, stats dérivées, erreurs typées).
- Règles : `_bmad-output/planning-artifacts/gdds/gdd-cinecards-2026-11-22/gdd.md`.

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5

### Completion Notes List

- Hypothèse appliquée : le premier joueur pioche aussi au tour 1 (règle « à chaque tour on pioche »).
- Résultat : `pnpm typecheck` OK, `pnpm test` 24/24 OK (2026-11-22).

### File List

- packages/engine/src/state/create.ts
- packages/engine/src/rng.ts
- packages/engine/src/turn/turn.ts
- packages/engine/src/engine.test.ts

## Change Log

- 2026-11-22 — Implémentation initiale (mode autonome).
