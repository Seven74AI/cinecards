# Story 1.1: Initialiser le monorepo

Status: review

## Story

As a développeur,
I want un monorepo pnpm avec les cinq paquets de l'architecture et l'outillage commun,
So that chaque story s'ajoute au bon endroit avec les mêmes règles.

## Acceptance Criteria

**Given** un dépôt vide
**When** j'exécute `pnpm install` puis `pnpm test` et `pnpm typecheck`
**Then** les paquets `engine`, `cards`, `protocol`, `server`, `client` existent avec la structure de l'architecture
**And** TypeScript strict, Vitest et un test exemple passent dans chaque paquet
**And** une CI GitHub Actions exécute typecheck et tests

## Tasks / Subtasks

- [x] Implémenter le comportement décrit par les critères d'acceptation
- [x] Écrire les tests correspondants (`describe('1.1 …')` ou tests du paquet)
- [x] Vérifier `pnpm typecheck` et `pnpm test`

## Dev Notes

- Architecture : `_bmad-output/game-architecture.md` (moteur pur, réducteur, stats dérivées, erreurs typées).
- Règles : `_bmad-output/planning-artifacts/gdds/gdd-cinecards-2026-11-22/gdd.md`.

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5

### Completion Notes List

- pnpm 10 utilisé localement (12 prévu en CI via packageManager à mettre à jour). TypeScript 7.0.2, Vitest 5.1.1, Vite 8.3.8. Le serveur reste un squelette jusqu'à la story 6.1.
- Résultat : `pnpm typecheck` OK, `pnpm test` 24/24 OK (2026-11-22).

### File List

- package.json
- pnpm-workspace.yaml
- tsconfig.base.json
- tsconfig.json
- vitest.config.ts
- .github/workflows/ci.yml
- README.md
- packages/*/package.json
- apps/*/package.json
## Change Log

- 2026-11-22 — Implémentation initiale (mode autonome).
