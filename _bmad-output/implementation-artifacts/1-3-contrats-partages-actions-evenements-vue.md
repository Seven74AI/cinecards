# Story 1.3: Contrats partagés (actions, événements, vues)

Status: review

## Story

As a développeur,
I want les types `Action`, `GameEvent`, `PlayerView` et les codes d'erreur dans `packages/protocol`,
So that serveur et client parlent exactement le même langage.

## Acceptance Criteria

**Given** le paquet `protocol`
**When** je l'importe depuis `server` et `client`
**Then** les unions discriminées d'actions (`playCard`, `attack`, `useAbility`, `react`, `pass`, `endTurn`, `concede`) et d'événements sont disponibles
**And** les codes d'erreur ont chacun un message français dans `client/src/i18n/fr.ts`

## Tasks / Subtasks

- [x] Implémenter le comportement décrit par les critères d'acceptation
- [x] Écrire les tests correspondants (`describe('1.3 …')` ou tests du paquet)
- [x] Vérifier `pnpm typecheck` et `pnpm test`

## Dev Notes

- Architecture : `_bmad-output/game-architecture.md` (moteur pur, réducteur, stats dérivées, erreurs typées).
- Règles : `_bmad-output/planning-artifacts/gdds/gdd-cinecards-2026-11-22/gdd.md`.

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5

### Completion Notes List

- Écart avec l'architecture : les types Action/GameEvent/GameState sont définis dans le moteur et ré-exportés par `protocol` (le moteur n'a pas à dépendre du réseau). `useAbility`, `react`, `pass` renvoient `NOT_SUPPORTED_YET` jusqu'à l'epic 3.
- Résultat : `pnpm typecheck` OK, `pnpm test` 24/24 OK (2026-11-22).

### File List

- packages/protocol/src/index.ts
- packages/engine/src/types.ts
- apps/client/src/i18n/fr.ts
- apps/client/src/i18n/fr.test.ts
## Change Log

- 2026-11-22 — Implémentation initiale (mode autonome).
