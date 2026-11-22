---
baseline_commit: 30a55e3bed7e70f4191841edb080ad8f78831115
---

# Story 12.3: Dégâts, soins, statuts

Status: done

## Story

As a joueur,
I want des chiffres et des effets lisibles sur chaque carte touchée,
So that je comprenne ce qui a changé.

## Acceptance Criteria

**Given** des dégâts, un soin, un bonus, un malus, un bouclier ou un statut
**When** ils s'appliquent
**Then** chiffre à taille variable, compteur de PV qui défile, flèche de stat, bouclier qui se fissure, effet propre à chaque statut (chaînes pour le silence, bulles pour le poison).

## Tasks / Subtasks

- [x] Chiffres (`ui/director.ts`) : « −X » dont la taille suit la valeur (démo : 18 + X/10, plafonnée), sur la carte ou le portrait ; la carte rougit brièvement (voile rouge en opacité) ; soin : lueur verte montante et « +X » vert. Les anciens chiffres flottants de React (`Fx`, epic 7) sont retirés.
- [x] Compteur de PV qui défile : écussons PV des cartes et PV des portraits comptent de l'ancienne à la nouvelle valeur (450 ms à vitesse normale, au rythme de la lecture, immédiat en instantané), sans rendu React par image.
- [x] Bonus / malus : flèche dorée vers le haut ou violette vers le bas sur l'écusson concerné (ATQ ou PV), avec la valeur.
- [x] Bouclier qui absorbe : le bouclier se fissure (et éclate s'il est épuisé), chiffre gris « absorbé X ».
- [x] Statuts : silence → chaînes qui se referment sur la carte (et restent visibles, discrètes, tant qu'elle est réduite au silence) ; poison → bulles vertes ; bouclier → bouclier qui se pose ; autres → icône du statut qui se pose avec son nom.
- [x] `transform` / `opacity` seulement, fondus seuls avec « réduire les animations » ; e2e : chiffre et compteur visibles pendant la lecture ; captures 390 px.

## Dev Notes

- Couche de présentation 12.1 et mise en scène 12.2 (`ui/director.ts`). Les valeurs affichées viennent de l'état affiché (`present.ts`) : le compteur part de la valeur du temps précédent.
- Pas de changement de moteur ni de protocole.

### References

- docs/design/animations/demo.html (`floatText`, `damage`, `countHp`, scène « Attaque spéciale » : chaînes) ; retours-visuels-actions.md (lignes Dégâts, Bouclier, Soin, Bonus / malus, Statut appliqué).

## Dev Agent Record

### Completion Notes List

- `ui/director.ts` : `floatText` (frames de la démo, taille 15 + X/10 plafonnée à 30, ajustée à la largeur des cartes ; portrait : 20 + X/8 plafonnée à 40), `tint` (voile rouge / vert en opacité), `particles` (étincelles de soin, bulles de poison, éclats de bouclier), `statArrow` (flèche dorée ↑ / violette ↓ sur l'écusson ATQ ou PV), `shieldHit` (bouclier qui se fissure, éclate s'il est épuisé dans l'état du moteur, « absorbé X » gris), `statusFx` (chaînes du silence, bulles du poison, bouclier, sinon icône du statut + nom).
- `ui/Counter.tsx` : compteur qui défile (rAF, écrit dans le nœud texte de React, pas de rendu par image) ; écusson PV des cartes et PV des portraits ; durée 450 ms × allure de la lecture, immédiat quand rien ne joue.
- `ui/CardView.tsx` : chaînes discrètes (`.chains`) sur une carte réduite au silence ; prop `count` à la place de `fx`.
- Les chiffres flottants React de l'epic 7 (`Fx`, `fxAt`, règles CSS `.fx*`) sont retirés : tout passe par le metteur en scène.
- Scène dev `?scene=bouclier` (bouclier de 40 sur les Chevaliers).
- e2e `beats.spec.ts` (+1 : l'écusson PV passe de 150 à 40 par des valeurs intermédiaires, « −110 » et « absorbé 40 » affichés).
- `pnpm typecheck` OK, `pnpm test` 125/125, `PW_CHANNEL=chromium pnpm e2e -- --trace off` 13/13 (2026-11-22). Captures 390 px vérifiées (compteur à 123 puis 7, bouclier fissuré + « absorbé 40 », chaînes sur Lancelot, flèche +10 de Topper).

### File List

- apps/client/src/ui/director.ts, Counter.tsx, CardView.tsx, Icon.tsx, Table.tsx
- apps/client/src/game/fx.ts, devscene.ts
- apps/client/src/styles.css
- e2e/beats.spec.ts
- _bmad-output/implementation-artifacts/a-valider-par-root.md, sprint-status.yaml

## Change Log

- 2026-11-22 — Chiffres à taille variable, compteurs de PV qui défilent, flèches de stats, bouclier qui se fissure, effet propre à chaque statut (mode autonome).
