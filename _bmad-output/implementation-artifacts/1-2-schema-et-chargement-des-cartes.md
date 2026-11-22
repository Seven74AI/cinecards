# Story 1.2: Schéma et chargement des cartes

Status: review

## Story

As a développeur,
I want un schéma Zod des cartes et des sets, et un chargeur des fichiers `content/sets/*.json`,
So that les données de Root soient validées avant d'arriver au moteur.

## Acceptance Criteria

**Given** les 4 fichiers de sets existants
**When** le chargeur les lit
**Then** 51 cartes valides sont retournées avec des identifiants uniques
**And** une carte invalide (champ manquant, rareté inconnue) produit une erreur qui nomme le fichier, la carte et le champ
**And** les cartes à PV/ATQ multiples (Sentinelles) sont acceptées

## Tasks / Subtasks

- [x] Implémenter le comportement décrit par les critères d'acceptation
- [x] Écrire les tests correspondants (`describe('1.2 …')` ou tests du paquet)
- [x] Vérifier `pnpm typecheck` et `pnpm test`

## Dev Notes

- Architecture : `_bmad-output/game-architecture.md` (moteur pur, réducteur, stats dérivées, erreurs typées).
- Règles : `_bmad-output/planning-artifacts/gdds/gdd-cinecards-2026-11-22/gdd.md`.

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5

### Completion Notes List

- Le chargeur Node est exposé séparément (`@cinecards/cards/node`) pour garder le paquet utilisable dans le navigateur. Les effets (`effects`) sont acceptés sous forme générique ; leur vocabulaire arrive à l'epic 3.
- Résultat : `pnpm typecheck` OK, `pnpm test` 24/24 OK (2026-11-22).

### File List

- packages/cards/src/schema.ts
- packages/cards/src/parse.ts
- packages/cards/src/node.ts
- packages/cards/src/parse.test.ts
## Change Log

- 2026-11-22 — Implémentation initiale (mode autonome).
