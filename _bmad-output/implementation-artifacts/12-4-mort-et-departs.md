---
baseline_commit: 0773ab72a5d114bd14f0666d505e5706033ac294
---

# Story 12.4: Mort et départs

Status: done

## Story

As a joueur,
I want voir une carte mourir,
So that sa disparition ne passe pas inaperçue.

## Acceptance Criteria

**Given** une carte détruite
**When** elle meurt
**Then** elle se fige, se fissure, se consume et ses cendres rejoignent le cimetière
**And** « mort évitée » montre une fissure qui se recolle
**And** un renvoi en main montre la carte repartir en arc.

## Tasks / Subtasks

- [x] Mort (`cardDestroyed`, temps de 1,2 s, la carte reste dans son socle pendant tout ce temps) : elle se fige (≈ 0,1 s), des fissures apparaissent (≈ 0,2 s), elle tremble (≈ 0,25 s), puis se consume (≈ 0,65 s : voile de brûlure, braises qui montent, rétrécit et s'efface) ; ses cendres volent en arc vers le compteur « Cimetière » de son propriétaire, qui pulse (démo, scène « Mort »).
- [x] Mort évitée (`deathPrevented`) : la carte se fissure, tremble, puis la fissure se recolle dans un éclat doré, « Sauvé ! ».
- [x] Renvoi en main (`returnedToHand`) : la carte reste dans son socle le temps du temps (0,5 s), se soulève et repart en arc vers la main de son propriétaire (la mienne ou la main adverse), en rapetissant.
- [x] `game/present.ts` / `game/playback.ts` : une carte renvoyée est gardée en place pendant son animation, comme une carte détruite ; `ShownView.returning`.
- [x] `transform` / `opacity` seulement, fondus seuls avec « réduire les animations » ; tests unitaires (renvoi gardé en place) ; e2e (cendres vers le cimetière, compteur du cimetière qui monte après la mort) ; captures 390 px.

## Dev Notes

- S'appuie sur 12.1 à 12.3 (`ui/director.ts`, `ui/anim.ts`). Les fissures et le voile de brûlure sont rendus par `CardView` quand la carte meurt ; le metteur en scène les anime (opacité).
- Pas de changement de moteur ni de protocole.

### References

- docs/design/animations/demo.html (scène « Mort » : `cracks`, `particles`, cendres, lueur du cimetière) ; retours-visuels-actions.md (lignes Mort d'une carte, Mort évitée, Renvoyer en main).

## Dev Agent Record

### Completion Notes List

- `ui/director.ts` : `death` (une animation WAAPI sur toute la durée du temps : figée 0–25 %, tremble 25–46 %, se consume 46–100 % ; fissures et voile de brûlure rendus par `CardView` et animés en opacité ; braises à 46 % ; cendres à 90 %, en arc vers le compteur « Cimetière » du propriétaire, qui pulse), `saved` (fissure par-dessus la carte, tremblement en `composite: add`, éclat doré, « Sauvé ! »), `backToHand` (soulèvement, arc vers ma main ou la main adverse, rapetisse).
- `game/fx.ts` : mort 1,2 s (la carte reste dans son socle tout ce temps ; les cendres volent pendant les temps suivants), renvoi 0,5 s.
- `game/present.ts` / `game/playback.ts` : `held` (cartes gardées en place pendant leur mort ou leur renvoi) ; `ShownView.returning`. `ui/anim.ts` : `deathFx` (12.1) remplacé par la mort complète du metteur en scène ; ancien éclat `.fx-death` et voile CSS retirés.
- Scènes dev `?scene=sauve` (Chevalier noir à 100 PV) et `?scene=renvoi` (Tank en main).
- Tests : `present.test.ts` (+1 : carte renvoyée gardée en place) ; e2e `beats.spec.ts` (+1 : fissures et brûlure visibles sur la carte, cendres, compteur du cimetière adverse qui passe à 1).
- `pnpm typecheck` OK, `pnpm test` 126/126, `PW_CHANNEL=chromium pnpm e2e -- --trace off` 14/14 (2026-11-22). Captures 390 px vérifiées (fissure, brûlure et braises, cendres vers le cimetière adverse, « Sauvé ! » sur le Chevalier noir, Ni qui repart vers la main adverse).

### File List

- apps/client/src/ui/director.ts, CardView.tsx, Table.tsx, anim.ts
- apps/client/src/game/present.ts, present.test.ts, playback.ts, fx.ts, devscene.ts
- apps/client/src/styles.css
- e2e/beats.spec.ts
- _bmad-output/implementation-artifacts/a-valider-par-root.md, sprint-status.yaml

## Change Log

- 2026-11-22 — Mort mise en scène (figée, fissurée, consumée, cendres vers le cimetière), mort évitée, renvoi en main en arc (mode autonome).
