---
baseline_commit: b8912a3
---

# Story 14.3: Carte complète et vue détaillée de la main

Status: done

## Story

As a joueur sur téléphone,
I want lire en entier les cartes de ma main sans ouvrir chaque fiche,
So that je choisisse vite quoi jouer.

## Acceptance Criteria

**Given** la main ouverte en vue détaillée
**Then** chaque carte est une carte complète : cadre, jeton de coût et gemme du jeu, illustration, puis un encart avec,
pour chaque capacité, son icône d'énergie, son étiquette de type (À l'arrivée, Passif, Réaction, Effet…) et son texte
d'effet, sans la réplique du film ; ATQ/PV en bas
**And** la carte fait 70 % de la largeur de l'écran, 280 px au plus ; textes d'au moins 12 px
**And** le panneau a la hauteur de la carte la plus haute de la main (recalculée quand la main change) : aucune carte ne
défile verticalement ; il monte au-dessus de mon camp, du bandeau du tour et d'une partie du camp adverse, sans
dépasser le bandeau adverse
**And** les cartes défilent horizontalement ; toucher une carte ouvre la fiche actuelle (répliques comprises, « Jouer »)

Hors périmètre : le panneau « Réglages » et son choix « Main ouverte : Compacte | Détaillée » (14.4). La vue compacte
(14.2) reste la vue par défaut ; ordinateur, tablette et paysage ne changent pas.

## Tasks / Subtasks

- [x] `game/handView.ts` : vue `compact | detailed`, clé `cinecards.handView`, défaut `compact` ; `getHandView`,
  `setHandView`, `subscribeHandView` (pour 14.4) ; `?handView=detailed` force la vue sur le serveur de développement
  et les builds `VITE_SCENES=1` ; test unitaire `handView.test.ts`
- [x] `ui/Abilities.tsx` : `PowerIcon` (sorti de la fiche, partagé), `CardText` (encart parchemin : icône d'énergie,
  étiquette de type, texte d'effet, sans réplique ni ligne d'ambiance), `FullCard` (`CardView size="big"` + encart)
- [x] `AbilityText` (`Refs.tsx`) : option `still`, même rendu et mêmes classes (`tg kw-tag`, `kw`, `ref`) sans
  boutons, pour un encart posé dans le bouton de la carte
- [x] `CardView` : prop `text` insérée après `.card-art`, classe `card-full` ; `card.css` : carte à hauteur de son
  contenu, illustration 55 % de la largeur, encart Alegreya 12 px
- [x] `Table.tsx` : `HandPanel` (classe `detailed`, hauteur = carte la plus haute + marges, mesurée au changement de
  main, au redimensionnement d'une carte et de la fenêtre, plafonnée sous le bandeau adverse) ; cartes `FullCard`
  dans la main ouverte en vue détaillée
- [x] `mobile-table.css` : rangée détaillée (cartes `min(70vw, 280px)`, nom 15 px, ATQ/PV 12 px)
- [x] Scène `?scene=pleine` : Néo (textes les plus longs du jeu) en premier dans la main
- [x] e2e `e2e/hand-detailed.spec.ts` ; captures ; `scripts/compare-desktop.mjs`
- [x] `pnpm typecheck`, `pnpm test`, e2e complet

## Dev Notes

- Le metteur en scène ne change pas : les cartes complètes gardent `.card[data-iid]` dans `.table .hand`, donc la
  pioche, le retour en main et le départ d'une carte jouée visent la carte du panneau détaillé comme en vue compacte.
- Les cartes complètes sont des boutons : l'encart n'a aucun élément touchable (un bouton ne peut pas en contenir) ;
  les mots-clés et renvois se touchent dans la fiche.
- Hauteurs mesurées : Néo 444 px (390 × 844), 430 px (360 × 640) ; panneau 468 / 454 px, sous le bandeau adverse
  (93 / 87 px).

### References

- `_bmad-output/planning-artifacts/epics.md` → Epic 14, Story 14.3
- `docs/design/mobile-table-v2/README.md`, `F-detaillee.dc.html`, `F-detaillee-360.dc.html`,
  `rendus/F-detaillee.png`, `rendus/F-detaillee-360.png`
- Story 14.2 (`14-2-main-repliee-bouton-eventail-vue-compacte.md`)

## Dev Agent Record

### Agent Model Used

Agent dev (Claude Code)

### Debug Log References

- Captures (hors des dossiers suivis), scène `?scene=pleine&handView=detailed` à 390 × 844 et 360 × 640, et vue
  compacte : comparées aux rendus F-detaillee, même découpage (Néo en entier, panneau du bandeau adverse jusqu'au mien).
- `scripts/compare-desktop.mjs` (b8912a3 contre l'arbre de travail, serveurs vite de dev) : 0,000 % partout (bureau et
  tablette : accueil, table, cibles, fiche).

### Completion Notes List

- Vue détaillée de la main ouverte : cartes complètes à `min(70vw, 280px)`, panneau à la hauteur de la plus haute.
- Vue compacte inchangée et par défaut ; module `handView` prêt pour le réglage de 14.4.
- Choix par défaut listés dans `a-valider-par-root.md`.
- Tests : `pnpm typecheck` OK ; `pnpm test` 316/316 ; e2e complet 60/60
  (`E2E_SERVER_PORT=2967 E2E_CLIENT_PORT=5574`). Pas de simulation de 200 parties (ni moteur ni cartes touchés).

### File List

- apps/client/src/game/handView.ts
- apps/client/src/game/handView.test.ts
- apps/client/src/game/devscene.ts
- apps/client/src/ui/Abilities.tsx
- apps/client/src/ui/CardView.tsx
- apps/client/src/ui/CardSheet.tsx
- apps/client/src/ui/Refs.tsx
- apps/client/src/ui/Table.tsx
- apps/client/src/styles/card.css
- apps/client/src/styles/mobile-table.css
- e2e/hand-detailed.spec.ts
- _bmad-output/implementation-artifacts/14-3-carte-complete-et-vue-detaillee.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/a-valider-par-root.md

### Change Log

- 2026-11-23 : story créée puis implémentée (carte complète, vue détaillée de la main ouverte).
