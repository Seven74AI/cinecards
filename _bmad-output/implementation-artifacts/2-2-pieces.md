# Story 2.2: Pièces

Status: review

## Story

As a joueur,
I want recevoir autant de pièces que le numéro de mon tour, en gardant le reste jusqu'à 10,
So that je puisse planifier mes gros tours.

## Acceptance Criteria

**Given** un joueur à son 3ᵉ tour avec 2 pièces en stock
**When** son tour commence
**Then** il a 5 pièces
**And** au tour 12 avec 9 en stock, il a 10 (plafond)
**And** poser une carte retire son coût ; un coût supérieur au stock est refusé avec `NOT_ENOUGH_COINS`

## Tasks / Subtasks

- [x] Implémenter le comportement décrit par les critères d'acceptation
- [x] Écrire les tests correspondants (`describe('2.2 …')` ou tests du paquet)
- [x] Vérifier `pnpm typecheck` et `pnpm test`

## Dev Notes

- Architecture : `_bmad-output/game-architecture.md` (moteur pur, réducteur, stats dérivées, erreurs typées).
- Règles : `_bmad-output/planning-artifacts/gdds/gdd-cinecards-2026-11-22/gdd.md`.

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5

### Completion Notes List

- Critères couverts par les tests ; aucune divergence.
- Résultat : `pnpm typecheck` OK, `pnpm test` 24/24 OK (2026-11-22).

### File List

- packages/engine/src/turn/turn.ts
- packages/engine/src/play/play.ts
- packages/engine/src/rules.ts
- packages/engine/src/engine.test.ts

## Change Log

- 2026-11-22 — Implémentation initiale (mode autonome).
