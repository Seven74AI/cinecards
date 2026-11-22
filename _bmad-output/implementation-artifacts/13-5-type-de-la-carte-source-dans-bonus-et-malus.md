---
baseline_commit: 4a4cddd
---

# Story 13.5: Type de la carte source dans « Bonus et malus »

Status: done

## Story

As a joueur,
I want voir d'un coup d'œil si un bonus vient d'un personnage, d'un sort, d'un équipement ou d'un terrain,
So that je sache comment l'enlever.

## Acceptance Criteria

**Given** la liste « Bonus et malus » d'une fiche
**Then** chaque ligne montre le type de la carte source avec son icône de jeton (blason, sceau, écrou, losange) et son nom (« Personnage », « Sort », « Équipement », « Terrain »), lisible à 390 px ; l'aperçu de la source (13.1) reste accessible d'un appui.

## Tasks / Subtasks

- [x] `CardView.tsx` : `CategoryTag` (petit jeton SVG de la forme et de l'icône du jeton de coût, couleurs de `CardView`, puis le nom de la catégorie).
- [x] `CardSheet.tsx` : l'étiquette en tête de chaque ligne dont la source est une carte ; le nom accessible du bouton inclut la catégorie (« Heather et Megan Vandergeld (Personnage) : Langue de vipère »). L'appui ouvre toujours l'aperçu.
- [x] Scène `sources` : ajout de l'Unité A.P.U (équipement, au cimetière, +100 ATQ) pour avoir les 4 catégories.
- [x] Tests : `modifiers.test.ts` (4 sources ATQ), e2e `sources.spec.ts` (5 lignes, 5 étiquettes avec icône, 4 catégories), capture 390 px.

## Dev Notes

- Pas de changement de protocole ni de moteur. La catégorie vient du catalogue (`src.category`).

### References

- `_bmad-output/planning-artifacts/epics.md` — Epic 13, story 13.5 ; story 13.3.

## Dev Agent Record

### Completion Notes List

- `apps/client/src/ui/CardView.tsx` (`CategoryTag`, `TAG_SHAPE`), `CardSheet.tsx`, `styles.css` (`.cat-tag`), `game/devscene.ts`, `e2e/sources.spec.ts`, `game/modifiers.test.ts`.
- Capture 390 px (deviceScaleFactor 1) : étiquette dorée de 11 px au-dessus du nom de la source, icône de 15 × 16 px.
- `pnpm typecheck` OK, `pnpm test` 138/138, `PW_CHANNEL=chromium pnpm e2e -- --trace off` 29/29 (2026-11-22).
