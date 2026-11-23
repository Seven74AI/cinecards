---
baseline_commit: 873a48a
---

# Story 13.14: Taille des effets à l'échelle de la carte

Status: done

## Story

As a joueur,
I want que les chiffres, particules et étoiles d'impact aient la taille de la carte touchée,
So that un effet ne déborde pas d'une petite carte et ne disparaisse pas sur une grande.

## Acceptance Criteria

Maquette validée par Root le 2026-11-23 (`docs/design/animations/maquette-13-13-a-13-15.html`) : un seul facteur
`s = largeur affichée ÷ 100 px`, borné 0,45 – 1,3, ordinateur **et** téléphone, chiffres d'au moins 11 px.

1. **Given** un effet sur une carte (chiffre de dégâts, de soin ou « 0 », étoile d'impact, particules de pose, de mort,
   de soin, de poison et d'éclats de bouclier, cendres, flèche de stat, étiquette d'état, « absorbé », « Sauvé ! »)
   **Then** sa taille suit `s` : police, taille de l'étoile, taille des particules, hauteur de leur montée et dérive.
2. Un chiffre n'est jamais plus petit que 11 px (flèche : icône d'au moins 12 px, texte d'au moins 10 px).
3. Sur un portrait (petit avatar de 28 à 32 px), `s` vient d'une case de la table de la même disposition (largeur d'une
   carte ou d'une case du plateau) : les coups au joueur gardent l'échelle des cartes de cet écran.
4. Une carte mise en scène sur téléphone (104 px) garde l'échelle de la démo (s ≈ 1).
5. « Réduire les animations » et le plafond de particules du téléphone (`particleBudget`) restent respectés ; les e2e
   restent verts.

## Tasks / Subtasks

- [x] `game/motion.ts` : `FX_SCALE` {ref 100, min 0,45, max 1,3}, `fxScale(width)`, `FX_MIN_FONT` 11 ; tests.
- [x] `ui/director.ts` : `fxScaleOf(el)` (carte : sa largeur ; portrait : une case de la table) remplace `fitOf` et le
      `fit` de `splat` ; `floatText` garde 11 px au moins ; `particles` (taille, montée, dérive), cendres, `statArrow`.
- [x] Choix par défaut dans `a-valider-par-root.md`.

## Dev Notes

- Aujourd'hui : `fitOf` = clamp(largeur ÷ 90, 0,6, 1,2) pour quelques chiffres ; `splat` clamp(largeur ÷ 90, 0,6, 1) ;
  particules 5–8 px (CSS `.fx-dot`, `.fx-bubble`, `.fx-shard`), montée 30–70 px, dérive ±10 px ; flèche 22 px / 15 px ;
  chiffre du héros min(40, 20 + dégâts ÷ 8) px fixe.
- Les particules : multiplier les `scale()` des images clés par `s` (la taille CSS reste la base) ; montée et dérive × s.
- Mesures : ordinateur 45–72 px, téléphone en vue d'ensemble 47–70 px, mis en scène 104 px.
- Rien d'autre ne change (rayons, étiquettes au-dessus des cartes, recul, tremblement : story 13.15).

## Dev Agent Record

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- `fxScale` / `FX_MIN_FONT` (motion.ts) ; `fxScaleOf` et `numPx` (director.ts) remplacent `fitOf` et le `fit` de l'étoile.
- Particules : `scale()` des images clés × s, montée et dérive × s ; cendres × s ; flèche 22 × s (≥ 12) et 15 × s px (≥ 10).
- Portrait : échelle de la première carte (ou case) du plateau.
- Captures à l'impact : ordinateur 1440 × 900, l'étoile tient dans la carte de 59 px ; téléphone (104 px mis en scène) inchangé.
- `pnpm typecheck` OK, `pnpm test` 312/312, e2e 49/49 (ports 2667 / 5274).

### File List

- apps/client/src/game/motion.ts
- apps/client/src/game/motion.test.ts
- apps/client/src/ui/director.ts
- _bmad-output/implementation-artifacts/a-valider-par-root.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

### Change Log

- 2026-11-23 : taille des effets à l'échelle de la carte (story 13.14).
