---
baseline_commit: c121640
---

# Story 13.11: Courbes d'accélération et entrée de carte plus lente

Status: done

## Story

As a joueur,
I want des animations qui accélèrent et ralentissent naturellement,
So that elles aient du poids au lieu d'avancer de façon mécanique.

## Acceptance Criteria

1. **Given** une palette de courbes nommée et partagée (`easeOut`, `easeIn`, `easeInOut`, `anticipate`, `overshoot`, `snap`), définie une seule fois
   **Then** chaque mouvement du directeur utilise une courbe adaptée par segment (easing par image clé), sauf fondus et compteurs.
2. La carte qui quitte la main pour la table met environ 850 ms (au lieu de 620), avec une anticipation au départ et un léger dépassement à l'atterrissage, sur téléphone comme sur ordinateur.
3. Demande complémentaire de Root : sur téléphone en portrait, ce vol dure environ 1100 ms, et un facteur unique `PHONE_TEMPO` ≈ 1,25 ralentit les déplacements (vols, pioche, retours en main, élan et charge d'attaque, projectiles, rayons), pas les impacts ni les chiffres.
4. La démo est mise à jour avec la même palette pour rester la référence.
5. « Réduire les animations » donne toujours des fondus ; le réglage de vitesse s'applique ; les e2e d'ordre des temps restent verts.

## Tasks / Subtasks

- [x] `apps/client/src/game/motion.ts` : `EASING`, `ENTRANCE_MS` (850), `PHONE_ENTRANCE_MS` (1100), `PHONE_TEMPO` (1,25) — sans dépendance, lu par `fx.ts` et `ui/anim.ts` (qui les réexporte).
- [x] `ui/anim.ts` : `entranceFrames` (recul de 10 px, arc, atterrissage `overshoot`), `ENTRANCE_TOUCH`, `stepFrames` / `animateSteps` (chronologie linéaire, courbe par image clé), `motionFrames` (réduction des animations : opacité seule, courbes retirées).
- [x] `ui/director.ts` : chaque mouvement passe par la palette (pose, cartes de zone, sorts, pioche, mort et cendres, sauvetage, retour en main, attaque, rayons, orbes, étiquettes, chiffres, bandeau, fin de partie, FLIP) ; `tempo()` applique `PHONE_TEMPO` aux déplacements sur la table compacte.
- [x] `game/fx.ts` : `TIMING.play` = 850 ; sur téléphone : pose 1100, pioche / invocation / retour / attaque / capacité × 1,25, `PHONE_SPELL.fly` et `.orb` × 1,25.
- [x] Démo : même palette (`EASING`, `steps()`), pose d'Epok et de Tank en 850 ms avec recul et dépassement ; scènes inchangées sinon.
- [x] Tests : `ui/anim.test.ts` (palette valide, entrée, tempo téléphone, réduction des animations) ; e2e `play-draw` suit le vol 150 images.
- [x] Planches `scripts/compare-demo.mjs` et captures 390 px / ordinateur.

## Dev Agent Record

### Completion Notes List

- Valeurs listées dans `a-valider-par-root.md` (13.11).
- `pnpm typecheck` OK, `pnpm test` 143/143, e2e 32/32 (ports 2967 / 5574).

### File List

- apps/client/src/game/motion.ts (nouveau), apps/client/src/ui/anim.ts, apps/client/src/ui/anim.test.ts (nouveau), apps/client/src/ui/director.ts, apps/client/src/game/fx.ts
- docs/design/animations/demo.html, e2e/play-draw.spec.ts
- _bmad-output/implementation-artifacts/a-valider-par-root.md, sprint-status.yaml

## Change Log

- 2026-11-22 — Palette de courbes, entrée 850 ms (1100 ms sur téléphone), tempo téléphone 1,25, mode autonome.
