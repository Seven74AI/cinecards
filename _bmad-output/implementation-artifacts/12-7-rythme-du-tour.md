---
baseline_commit: fe89ecc
---

# Story 12.7: Rythme du tour

Status: done

## Story

As a joueur,
I want des repères de tour et de fin de partie,
So that le rythme soit clair.

## Acceptance Criteria

**Given** un changement de tour ou une fin de partie
**Then** un bandeau « À vous de jouer » (ou « Tour adverse ») se déroule et mes cartes jouables s'illuminent
**And** la victoire brise le portrait adverse, la défaite assombrit la table.

## Tasks / Subtasks

- [x] `fx.ts` : début de tour 650 ms (bandeau), fin de partie 2 s (le moment de victoire ou de défaite).
- [x] `director.ts` : `turnBanner` — mon tour : bandeau parchemin « À toi de jouer » qui se déroule (0,45 s), reste, puis remonte en s'effaçant (démo « Début du tour ») ; tour adverse : bandeau sombre plus petit et plus court « Tour adverse ». Le sablier du chrono se retourne. Puis `playableGlow` : lueur turquoise sur mes cartes jouables (main abordable, personnages prêts à attaquer).
- [x] `gameEnd` : le portrait du perdant se fissure, tremble et éclate (éclats, tremblement fort) ; victoire : pluie de pièces d'or ; défaite (ou égalité, plus léger) : la table s'assombrit.
- [x] `Table.tsx` : l'écran de fin attend la fin de la lecture (le moment de 2 s) ; en vitesse instantanée il s'affiche tout de suite.
- [x] Tests : e2e `turn-rhythm.spec.ts` (ordre « Tour adverse » → « À toi de jouer » → lueur ; victoire : portrait fissuré, pièces, écran de fin après ; défaite par abandon : voile sombre puis « Défaite… »). Scène dev `?scene=victoire`. Captures 390 px.

## Dev Notes

- Le joueur « à moi » côté metteur en scène est le héros du bas (`myId()`), ce qui suit aussi le hot seat (l'animation reprend derrière « Je suis prêt·e »).
- L'état affiché a `phase: 'finished'` dès le premier temps du lot final ; d'où l'attente sur `pb.playing`.

### References

- `_bmad-output/planning-artifacts/epics.md` — Epic 12, story 12.7 ; `retours-visuels-actions.md` ; `docs/design/animations/demo.html` (scène « Début du tour »).

## Dev Agent Record

### Completion Notes List

- `pnpm typecheck` OK, `pnpm test` 137/137, `PW_CHANNEL=chromium pnpm e2e -- --trace off` 28/28.

### File List

- apps/client/src/game/fx.ts, devscene.ts
- apps/client/src/ui/director.ts, Table.tsx
- apps/client/src/styles.css
- e2e/turn-rhythm.spec.ts
- _bmad-output/implementation-artifacts/a-valider-par-root.md, sprint-status.yaml

## Change Log

- 2026-11-22 — Bandeaux de tour, cartes jouables illuminées, moments de victoire et de défaite (mode autonome).
