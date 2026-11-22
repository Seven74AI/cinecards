# Story 2.7: Journal d'événements

Status: review

## Story

As a joueur,
I want que chaque action produise des événements lisibles,
So that le journal raconte la partie.

## Acceptance Criteria

**Given** n'importe quelle action valide
**When** elle est appliquée
**Then** au moins un événement typé est produit (`cardPlayed`, `damageDealt`, `cardDestroyed`, `coinsGained`…)
**And** rejouer la graine et la liste d'actions reproduit les mêmes événements

## Tasks / Subtasks

- [x] Implémenter le comportement décrit par les critères d'acceptation
- [x] Écrire les tests correspondants (`describe('2.7 …')` ou tests du paquet)
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

- packages/engine/src/types.ts
- packages/engine/src/apply.ts
- packages/engine/src/engine.test.ts

## Change Log

- 2026-11-22 — Implémentation initiale (mode autonome).
