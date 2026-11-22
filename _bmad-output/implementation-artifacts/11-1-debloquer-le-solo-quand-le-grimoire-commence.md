# Story 11.1: Débloquer le solo quand le Grimoire commence

Status: done

## Story

As a joueur solo,
I want que le Grimoire joue son tour même quand il commence la partie,
So that le mode solo ne se bloque jamais.

## Acceptance Criteria

**Given** une partie solo dont le premier joueur tiré au sort est le Grimoire
**When** la partie démarre
**Then** le Grimoire joue son tour et me passe la main
**And** un test sur 300 graines ne laisse aucune partie bloquée

## Tasks / Subtasks

- [x] Planifier le coup du bot juste après la création de la partie dans `localSession` (`apps/client/src/game/session.ts`)
- [x] Remettre `botTimer` à `null` dans `dispose()`
- [x] Test de non-régression Vitest (faux minuteurs) sur 300 graines : `apps/client/src/game/session.test.ts`
- [x] Vérifier que le test échoue sans le correctif, puis `pnpm typecheck` et `pnpm test`

## Dev Notes

- Cause racine : `scheduleBot()` n'était appelé que dans `commit()`, donc jamais avant la première action humaine. Si le tirage au sort désignait le Grimoire (joueur 1), la partie restait figée.
- Hors périmètre : aucun chrono de tour ajouté (story 11.3).
- Contexte : `_bmad-output/planning-artifacts/sprint-change-proposal-2026-11-22.md`.

## Dev Agent Record

### Agent Model Used

Claude Opus 5.5

### Completion Notes List

- Choix par défaut (mode autonome) : le test utilise le catalogue MVP réel (`packages/engine/src/scenario.ts`), alterne les modes `shared` / `randomSplit` selon la parité de la graine, et joue le côté humain avec `botStep` (graine `seed * 7919`) via `session.send`.
- Critère « non bloquée » : chaque partie se termine par un vainqueur, ou dépasse 6 tours cumulés, et le Grimoire a joué au moins un tour. Un second test vérifie que, pour chaque graine où le Grimoire commence, il rend la main au joueur ; un troisième vérifie que `dispose()` annule le coup en attente.
- Story écrite à la main au format des stories existantes (workflow `gds-create-story` interactif non utilisé).
- Résultat : sans le correctif, 2 tests échouent ; avec, `pnpm typecheck` OK, `pnpm test` 80/80 OK (2026-11-22).

### File List

- apps/client/src/game/session.ts
- apps/client/src/game/session.test.ts

## Change Log

- 2026-11-22 — Correctif et test de non-régression (mode autonome).
