---
baseline_commit: 517c33a
---

# Story 14.1: Table sans zoom, rangées terrains et sorts, bandeaux complets

Status: done

## Story

As a joueur sur téléphone,
I want voir les deux camps tels quels, avec leurs terrains et leurs sorts,
So that je n'aie plus à agrandir un camp.

**Constat :** le zoom d'un camp (13.2) ne sert pas ; les terrains et sorts ne sont qu'une fine bande.

## Acceptance Criteria

**Given** la table compacte (téléphone en portrait)
**Then** il n'y a plus de zoom ni de repli : pas de « agrandir », pas de zoom automatique sur une attaque ou une demande
de cible, pas de barre « Vue d'ensemble » ; la barre de consigne d'un choix reste dans le bandeau du tour
**And** chaque camp montre une rangée « Terrains » et une rangée « Sorts » de 5 cases (petite plaque avec l'icône et le
nom de la carte, case vide en pointillés), touchables, au-dessus des personnages chez l'adversaire et en dessous chez
moi, puis la grille 2 × 5 des personnages
**And** chaque bandeau montre l'initiale, le nom, la barre de PV, les PV, les pièces et le stock, la main (adversaire),
la pioche et le cimetière ; le bandeau du joueur actif est mis en évidence ; rien de ce qui est affiché aujourd'hui ne
disparaît
**And** les cibles tactiles mesurent au moins 44 px ; les e2e de la table téléphone sont réécrits (plus de zoom) et
vérifient l'absence de défilement vertical à 390 × 844 et 360 × 640

Hors périmètre (stories suivantes) : bouton éventail et main repliée (14.2), carte complète (14.3), réglages (14.4).
Dans cette story, la rangée de main d'aujourd'hui reste en bas, et mon bandeau garde son compteur de main.

## Tasks / Subtasks

- [x] Table.tsx : retirer `zoom`, `autoSide`, `autoKey`, `manualZoom`, `dismissed`, `heldZoom`, `attackZoom`, `fold`,
  `zoomKey`/FLIP, `ROOMY_QUERY` ; `Side` n'a plus qu'une vue (AC 1)
- [x] `Side` compact : chez l'adversaire `Terrains`, `Sorts`, puis la grille ; chez moi la grille, `Sorts`, `Terrains`
  (miroir de la maquette F) ; rangées dans un conteneur `.zones` (le metteur en scène vise `.zones [data-iid]`) (AC 2)
- [x] Plaques : `button.zplate[data-iid]` (icône de catégorie + nom), cases vides `span.zempty` en pointillés ;
  pose (`placeable`), cible (`is-target`), lueur 13.1 (`ref-glow`) ; zone tactile ≥ 44 px par pseudo-élément (AC 2, 4)
- [x] Bandeaux compacts : avatar, nom au-dessus de la barre de PV (`.hero-main` en colonne), PV, pièces/stock, main,
  pioche, cimetière ; bandeau actif mis en évidence (AC 3)
- [x] director.ts : supprimer `captureLayout`/`flipLayout` (ne servaient qu'au zoom) ; garder `stage` et `zoneGhost`
- [x] CSS `mobile-table.css` : retirer zoom/repli, rangées `.zrow`, hauteur partagée sans défilement de 360 × 640 à
  430 × 932 avec la rangée de main
- [x] Scène de dev `?scene=pleine` : 7 personnages adverses, 4 à moi, terrains et sorts des deux côtés, 10 cartes en main
- [x] e2e `mobile-table.spec.ts` réécrit ; captures 390 × 844 et 360 × 640 hors des dossiers suivis ;
  `scripts/compare-desktop.mjs` avant/après (ordinateur et tablette inchangés)
- [x] `pnpm typecheck`, `pnpm test`, e2e complet

## Dev Notes

- Table compacte : `COMPACT_QUERY = '(orientation: portrait) and (max-width: 699px)'`, classe `.table.compact`, styles
  dans `apps/client/src/styles/mobile-table.css`. Ordinateur, tablette et paysage ne doivent pas changer : tout le
  nouveau CSS est préfixé `.compact`, et le rendu non compact de `Zones`/`Board` reste identique.
- Le metteur en scène (`director.ts`) trouve une carte par `.board [data-iid]` (`cardEl`) puis
  `.table .zones [data-iid]` (`boardEl`) ; sur la table compacte, un terrain ou un équipement posé n'est pas une
  `.card` → `zoneGhost` (la carte vole puis rétrécit dans sa case) : il marche avec une plaque.
- `backToHand` / `handZone` visent `.table .hand` pour moi et `[title="Main"]` du héros adverse : garder ces `title`.
- Hauteur : `--cw` (largeur d'une carte de la table) se calcule sur la hauteur libre ; les rangées terrains/sorts
  remplacent la bande de 22 px de 13.2. La rangée de main reste (supprimée en 14.2).
- Règle de lisibilité (rétro 13) : aucun texte ne passe sous une taille lisible ; noms des plaques ≥ 9 px.

### References

- `_bmad-output/planning-artifacts/epics.md` → Epic 14, Story 14.1
- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-11-23-table-v2.md`
- `docs/design/mobile-table-v2/F-reglages.dc.html` (`.zrow`, `.pl`, `.pe`, `.pmain`, `.hpbar`, `.cnt`),
  `docs/design/mobile-table-v2/rendus/F-reglages.png`, `avant-390.png`, `avant-360.png`
- Story 13.2 (`13-2-table-sans-defilement-vertical-sur-mobile.md`), 13.6 (mise en scène)

## Dev Agent Record

### Agent Model Used

Agent dev (Claude Code)

### Debug Log References

- Captures (hors des dossiers suivis) : scène `?scene=pleine` à 390 × 844, 360 × 640 et 430 × 932, comparées à
  `docs/design/mobile-table-v2/rendus/F-reglages.png` ; scène `?scene=mort` avant/après (largeur des cartes de la table :
  47 → 41 px à 360 × 640, 70 → 61 px à 390 × 844, polices inchangées).
- `scripts/compare-desktop.mjs` (build avant 517c33a contre build après, `VITE_SCENES=1`) : accueil, cibles 0,000 % ;
  table 0,002 % (bureau) et 0,003 % (tablette) = 29 pixels épars des braises ; fiche 0,006 % = même bruit que
  avant contre avant (0,006 / 0,007 %). Ordinateur et tablette inchangés.

### Completion Notes List

- Zoom, repli, « agrandir », « Vue d'ensemble », zoom automatique (attaque, demande de cibles) et transition FLIP
  retirés (`Table.tsx`, `director.ts` : `captureLayout`/`flipLayout` supprimés ; `stage` et `zoneGhost` gardés).
- `ZoneRows` (table compacte seulement) : rangées `.zrow.terrains` / `.zrow.spells` dans `.zones.zrows`, 5 cases ;
  plaque `button.zplate[data-iid]` (icône de catégorie, nom, `is-target`, `ref-glow`), case vide `span.zempty`
  (`placeable` pendant une pose). Ordinateur, tablette et paysage gardent `Zones` tel quel.
- Bandeaux compacts : initiale, nom au-dessus de la barre de PV, PV, pièces/stock, main, pioche, cimetière ; bandeau
  actif mis en évidence. Les `title` (« Main », « Pioche », « Cimetière ») visés par le metteur en scène sont gardés.
- Hauteur : `--zh` (18 → 26 px selon la hauteur), `--side-x = 18px + 2 × --zh` ; aucun défilement de 360 × 640 à
  430 × 932 avec la rangée de main d'aujourd'hui.
- Choix par défaut listés dans `a-valider-par-root.md` (icônes au lieu des mots, taille des cartes en attendant 14.2,
  zone tactile des plaques).
- Tests : `pnpm typecheck` OK ; `pnpm test` 313/313 ; e2e complet 49/49 (`E2E_SERVER_PORT=2767 E2E_CLIENT_PORT=5374`).
  Pas de simulation de 200 parties (ni moteur ni cartes touchés).

### File List

- apps/client/src/ui/Table.tsx
- apps/client/src/ui/director.ts
- apps/client/src/styles/mobile-table.css
- apps/client/src/game/devscene.ts
- e2e/mobile-table.spec.ts
- _bmad-output/implementation-artifacts/14-1-table-sans-zoom-rangees-terrains-et-sorts.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/a-valider-par-root.md

### Change Log

- 2026-11-23 : story créée puis implémentée (table sans zoom, rangées terrains et sorts, bandeaux complets).
