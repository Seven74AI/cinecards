---
baseline_commit: 2adf101
---

# Story 13.15: Tremblement de la table à l'échelle de l'écran

Status: done

## Story

As a joueur,
I want que la table tremble avec la même force apparente sur téléphone et sur ordinateur,
So that un gros coup se sente sans secouer un petit écran.

## Acceptance Criteria

Maquette validée par Root le 2026-11-23 (`docs/design/animations/maquette-13-13-a-13-15.html`) : référence 390 px.

1. **Given** un coup, une pose ou une fin de partie qui fait trembler la table **Then** l'amplitude vaut
   `min(10, 2 + dégâts ÷ 25) × clamp(petit côté de l'écran ÷ 390, 0,4, 2)` px.
2. Un téléphone de 390 px garde le tremblement de la démo validée (10 px au plus) ; un écran de 1 440 × 900 va jusqu'à
   20 px ; un téléphone de 360 px un peu moins (9,2 px au plus).
3. La durée (320 ms) ne change pas ; « réduire les animations » supprime toujours le tremblement ; e2e verts.

## Tasks / Subtasks

- [x] `game/motion.ts` : `SHAKE_SCALE` {ref 390, min 0,4, max 2}, `shakeScale(w, h)` ; tests.
- [x] `ui/director.ts` : `shake()` multiplie l'amplitude par `shakeScale(innerWidth, innerHeight)`.
- [x] Choix par défaut dans `a-valider-par-root.md`.

## Dev Notes

- `shake(amount, r)` (director.ts) : `p = min(10, 2 + amount / 25)`, 4 positions, 320 ms × r, `composite: 'add'` sur `.table`.
- Appelé par les dégâts (riposte × 0,6), les coups au joueur, la pose d'un personnage (20) et la victoire (120).
- Avec « réduire les animations », `animate` ne garde que l'opacité : aucun mouvement.

## Dev Agent Record

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- `shakeScale` (motion.ts) ; `shake()` × `shakeScale(innerWidth, innerHeight)`.
- Mesure dans le jeu (coup de 150) : 16 px sur 1440 × 900, 8 px sur 390 × 844 (inchangé).
- `pnpm typecheck` OK, `pnpm test` 313/313, e2e 49/49 (ports 2667 / 5274).

### File List

- apps/client/src/game/motion.ts
- apps/client/src/game/motion.test.ts
- apps/client/src/ui/director.ts
- _bmad-output/implementation-artifacts/a-valider-par-root.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

### Change Log

- 2026-11-23 : tremblement à l'échelle de l'écran (story 13.15).
