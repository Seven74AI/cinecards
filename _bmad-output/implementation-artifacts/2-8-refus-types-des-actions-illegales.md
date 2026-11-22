# Story 2.8: Refus typés des actions illégales

Status: review

## Story

As a joueur,
I want une explication quand une action est impossible,
So that je comprenne les règles en jouant.

## Acceptance Criteria

**Given** une action illégale (hors tour, pas assez de pièces, cible protégée, carte en attente…)
**When** elle est appliquée
**Then** l'état est inchangé et le résultat contient `{ code, params }`
**And** aucune exception n'est levée

## Tasks / Subtasks

- [x] Implémenter le comportement décrit par les critères d'acceptation
- [x] Écrire les tests correspondants (`describe('2.8 …')` ou tests du paquet)
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

- packages/engine/src/apply.ts
- packages/engine/src/types.ts
- packages/engine/src/engine.test.ts

## Change Log

- 2026-11-22 — Implémentation initiale (mode autonome).
