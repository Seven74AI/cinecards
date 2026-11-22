# Story 2.5: Attaque, riposte et victoire

Status: review

## Story

As a joueur,
I want attaquer un personnage adverse et subir sa riposte, ou frapper l'adversaire quand sa table est vide,
So that le combat suive les règles du papier.

## Acceptance Criteria

**Given** mon personnage éligible (posé avant ce tour, attaque disponible)
**When** j'attaque un personnage adverse
**Then** chacun inflige son ATQ à l'autre simultanément ; un personnage à 0 PV va au cimetière
**And** attaquer les PV adverses est refusé tant qu'il a un personnage (`TARGET_PROTECTED`)
**And** sans personnage adverse, l'attaque touche ses PV sans riposte ; à 0 PV il perd
**And** double K.O. simultané → partie nulle ; `concede` → défaite

## Tasks / Subtasks

- [x] Implémenter le comportement décrit par les critères d'acceptation
- [x] Écrire les tests correspondants (`describe('2.5 …')` ou tests du paquet)
- [x] Vérifier `pnpm typecheck` et `pnpm test`

## Dev Notes

- Architecture : `_bmad-output/game-architecture.md` (moteur pur, réducteur, stats dérivées, erreurs typées).
- Règles : `_bmad-output/planning-artifacts/gdds/gdd-cinecards-2026-11-22/gdd.md`.

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5

### Completion Notes List

- Cartes à plusieurs corps : une attaque par corps vivant ; les dégâts reçus frappent le premier corps vivant ; la riposte utilise l'ATQ de ce corps.
- Résultat : `pnpm typecheck` OK, `pnpm test` 24/24 OK (2026-11-22).

### File List

- packages/engine/src/combat/combat.ts
- packages/engine/src/engine.test.ts

## Change Log

- 2026-11-22 — Implémentation initiale (mode autonome).
