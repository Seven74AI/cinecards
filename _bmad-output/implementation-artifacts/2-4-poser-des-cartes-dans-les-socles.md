# Story 2.4: Poser des cartes dans les socles

Status: review

## Story

As a joueur,
I want poser personnages, terrains et sorts dans leurs socles,
So that la table reflète mes choix.

## Acceptance Criteria

**Given** un joueur avec assez de pièces
**When** il pose un personnage dans un socle libre (I-X)
**Then** la carte occupe ce socle et ne peut pas attaquer ce tour
**And** un socle occupé ou une catégorie incompatible est refusé (`SLOT_OCCUPIED`, `WRONG_SLOT`)
**And** terrain → socle terrain (5), sort persistant/équipement → socle sort (5), sort instantané → résolu puis cimetière

## Tasks / Subtasks

- [x] Implémenter le comportement décrit par les critères d'acceptation
- [x] Écrire les tests correspondants (`describe('2.4 …')` ou tests du paquet)
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

- packages/engine/src/play/play.ts
- packages/engine/src/engine.test.ts

## Change Log

- 2026-11-22 — Implémentation initiale (mode autonome).
