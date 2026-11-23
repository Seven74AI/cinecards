Status: done

# Story 14.5: Main triée (jouables d'abord) et zones de sécurité de l'iPhone

## Story
As a joueur, I want voir d'abord les cartes que je peux jouer, et toute la table sur mon iPhone,
So that je choisisse vite sans rien perdre en bas de l'écran.

**Constat (test de Root sur iPhone, 2026-11-23) :** la main mélange cartes jouables et injouables ; l'initiale du joueur
et le bouton de la main ne sont visibles qu'à moitié en bas de l'écran.

## Acceptance Criteria
1. Sur toutes les dispositions (choix de Root), les cartes jouables (coût ≤ pièces, ou pose gratuite : la règle de la
   lueur « jouable ») viennent d'abord, puis les autres ; chaque groupe garde l'ordre de pioche.
2. La table téléphone laisse libres les zones de sécurité du haut et du bas ; bandeaux, initiale et bouton de la main
   entièrement visibles, sans défilement vertical.

## Tasks / Subtasks
- [x] `game/handOrder.ts` : `sortHand(hand, playable)` (stable, ne modifie pas la main reçue) ; tests `handOrder.test.ts`.
- [x] `ui/Table.tsx` : la main affichée passe par `sortHand` avec la même fonction `affordable` que la lueur.
- [x] `styles/mobile-table.css` : `--sa-t` / `--sa-b` (`env(safe-area-inset-top/bottom)`) en marge de la table compacte
      et dans `--fixed` (les cartes de la table se partagent la hauteur restante).
- [x] Scène de dev `?scene=tri` (5 pièces ; main Smith, Patsy, Néo, Camelot).
- [x] e2e `hand-order.spec.ts` (téléphone et ordinateur) et `safe-area.spec.ts` (encarts simulés 47 / 34 px à 390 × 844
      et 360 × 640).

## Dev Agent Record
### Completion Notes List
- Chromium ne simule pas les zones de sécurité : l'e2e force `--sa-t` / `--sa-b` sur la table. À confirmer sur l'iPhone de Root.
- `pnpm typecheck` OK, `pnpm test` 320/320, e2e 69/69 (ports 3167 / 5774). Pas de moteur ni de cartes touchés.
### File List
- apps/client/src/game/handOrder.ts (nouveau), apps/client/src/game/handOrder.test.ts (nouveau), apps/client/src/game/devscene.ts
- apps/client/src/ui/Table.tsx, apps/client/src/styles/mobile-table.css
- e2e/hand-order.spec.ts (nouveau), e2e/safe-area.spec.ts (nouveau)
- _bmad-output/planning-artifacts/epics.md, sprint-status.yaml, a-valider-par-root.md, decision-log.md
## Change Log
- 2026-11-23 — Main triée (jouables d'abord) sur toutes les dispositions ; zones de sécurité de l'iPhone sur la table téléphone.
