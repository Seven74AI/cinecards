---
baseline_commit: 341954d
---

# Story 13.7: Sorts plus lents sur téléphone

Status: done

## Story

As a joueur sur téléphone,
I want que les sorts prennent le temps de la démo,
So that je voie ce qui se passe.

## Acceptance Criteria

**Given** un sort joué en disposition téléphone portrait
**Then** sa mise en scène (agrandissement, brûlure, projectile, impact) suit la durée de la démo validée (impact vers 2,5 s au lieu de 1,4 s)
**And** ordinateur, tablette et paysage ne changent pas
**And** le réglage de vitesse (rapide, instantanée) s'applique toujours.

## Dev Notes

- Démo `docs/design/animations/demo.html`, scène « Sort » : `flyCard` 620 ms, agrandissement ×1,35 en 300 ms, attente 250 ms, brûlure 450 ms, orbe 520 ms.
- Les durées des temps viennent de `planBeats` (`game/fx.ts`) ; `director.ts` dessine dans la durée du temps (`cue.ms`, déjà multipliée par la vitesse).

## Tasks / Subtasks

- [x] `fx.ts` : `PHONE_SPELL` (temps de la démo) et option `planBeats(..., { phone })` : temps du sort = 1 620 ms, effet du sort (abilityUsed du même sort dans le lot) = 260 + 520 ms. Sans l'option, rien ne change.
- [x] `playback.ts` : champ `phone` passé à `planBeats` ; `Table.tsx` le règle sur la table compacte (téléphone portrait).
- [x] `director.ts` (`castSpell`) : sur la table compacte, images clés aux temps de la démo (vol en arc, ×1,35, maintien, brûlure) ; braises au début de la brûlure. Autres dispositions : images clés d'avant.
- [x] Test unitaire (`present.test.ts`) : temps ordinateur inchangés, temps téléphone = démo.
- [x] Planche `scripts/compare-demo.mjs --scene sort` régénérée et vérifiée : impact à ~2,5 s dans le jeu comme dans la démo.

## Dev Agent Record

### Completion Notes List

- Planche (390 × 844) : la carte du sort tient au centre de ~0,7 à ~1,25 s, brûle jusqu'à ~1,6 s, l'impact (−120) tombe à ~2,5 s (démo ~2,4 s).
- La vitesse « rapide » divise tout par deux (le temps et les images clés suivent `rate`), « instantanée » ne joue rien.
- `pnpm typecheck` OK, `pnpm test` 139/139, e2e 32/32 (ports 2867 / 5474).

### File List

- apps/client/src/game/fx.ts, apps/client/src/game/playback.ts, apps/client/src/game/present.test.ts
- apps/client/src/ui/director.ts, apps/client/src/ui/Table.tsx
- _bmad-output/implementation-artifacts/a-valider-par-root.md, sprint-status.yaml

## Change Log

- 2026-11-22 — Sorts au rythme de la démo sur téléphone portrait (mode autonome).
