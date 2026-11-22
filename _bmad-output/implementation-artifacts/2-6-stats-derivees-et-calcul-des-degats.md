# Story 2.6: Stats dérivées et calcul des dégâts

Status: review

## Story

As a joueur,
I want que les PV et l'ATQ affichés tiennent compte de tous les bonus, avec leur origine,
So that je n'aie jamais à calculer de tête.

## Acceptance Criteria

**Given** un personnage avec des modificateurs de sources différentes
**When** `computeStats(state, instanceId)` est appelé
**Then** il renvoie ATQ et PV actuels et la liste des sources
**And** les dégâts suivent l'ordre : base → multiplicateurs → réductions multiplicatives → bouclier → PV, arrondis à la dizaine inférieure
**And** retirer la carte source retire son bonus

## Tasks / Subtasks

- [x] Implémenter le comportement décrit par les critères d'acceptation
- [x] Écrire les tests correspondants (`describe('2.6 …')` ou tests du paquet)
- [x] Vérifier `pnpm typecheck` et `pnpm test`

## Dev Notes

- Architecture : `_bmad-output/game-architecture.md` (moteur pur, réducteur, stats dérivées, erreurs typées).
- Règles : `_bmad-output/planning-artifacts/gdds/gdd-cinecards-2026-11-22/gdd.md`.

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5

### Completion Notes List

- Copie profonde de l'état par aller-retour JSON (état = données JSON pures) au lieu de structuredClone, pour garder le moteur sans typings DOM/Node.
- Résultat : `pnpm typecheck` OK, `pnpm test` 24/24 OK (2026-11-22).

### File List

- packages/engine/src/state/compute-stats.ts
- packages/engine/src/combat/combat.ts
- packages/engine/src/engine.test.ts

## Change Log

- 2026-11-22 — Implémentation initiale (mode autonome).
