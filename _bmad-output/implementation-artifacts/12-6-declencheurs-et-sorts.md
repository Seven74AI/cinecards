---
baseline_commit: 98cae52
---

# Story 12.6: Déclencheurs et sorts

Status: done

## Story

As a joueur,
I want voir quelle carte déclenche quoi,
So that les combos soient lisibles.

## Acceptance Criteria

**Given** un déclencheur ou un sort
**When** il se résout
**Then** la source pulse, une étiquette (déclencheur + nom de la capacité) apparaît, puis un trait ou un projectile rejoint la cible
**And** les effets d'une chaîne se jouent dans l'ordre.

## Tasks / Subtasks

- [x] `fx.ts` : temps d'une capacité déclenchée 550 ms (pulsation + étiquette, puis l'effet), attaque spéciale / réaction 650 ms.
- [x] `director.ts` : `abilityFired` pour tous les `abilityUsed` (avant : attaques spéciales et réactions seulement) : la source sur la table pulse (`glow`), étiquette `fx-tag` « déclencheur · « nom » » au-dessus (libellé et couleur de `abilityTag`, 11.7 ; gardée à l'écran), puis un trait (capacité d'une carte : vert, bleu pour une attaque spéciale, doré pour une réaction) ou un projectile en arc (sort : depuis le centre de la table où il a brûlé, 12.5) vers chaque cible des effets qui suivent.
- [x] Terrain : onde de couleur sur les personnages de sa famille (même monde) du côté de son propriétaire, de proche en proche (`familyWave`).
- [x] Chaîne : chaque événement reste un temps de la lecture (12.1), dans l'ordre du moteur.
- [x] Tests : e2e `triggers-spells.spec.ts` (sort : carte qui brûle → étiquette « Effet » → projectile → dégâts, et ordre des temps ; terrain : sceau, étiquette « À l'arrivée », onde sur Lancelot seulement). Captures 390 px.

## Dev Notes

- `effectTargets()` (12.2) donne les cibles des effets jusqu'à la capacité ou l'attaque suivante.
- Un sort est déjà au cimetière quand son effet part : pas d'élément sur la table, d'où le départ au centre (`tableMid`).
- Scène dev `?scene=pose` (12.5).

### References

- `_bmad-output/planning-artifacts/epics.md` — Epic 12, story 12.6 ; `retours-visuels-actions.md` ; `docs/design/animations/demo.html` (scènes « Poser + À l'arrivée », « Attaque spéciale », « Sort » : `tag`, `beam`, orbe).

## Dev Agent Record

### Completion Notes List

- `pnpm typecheck` OK, `pnpm test` 137/137, `PW_CHANNEL=chromium pnpm e2e -- --trace off` 25/25. Captures : étiquette de Camelot et onde, projectile du missile.

### File List

- apps/client/src/game/fx.ts
- apps/client/src/ui/director.ts
- apps/client/src/styles.css
- e2e/triggers-spells.spec.ts
- _bmad-output/implementation-artifacts/a-valider-par-root.md, sprint-status.yaml

## Change Log

- 2026-11-22 — Pulsation, étiquette du déclencheur, trait ou projectile, onde de famille des terrains (mode autonome).
