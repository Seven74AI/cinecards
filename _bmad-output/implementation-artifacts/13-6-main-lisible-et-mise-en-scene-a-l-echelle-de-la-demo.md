---
baseline_commit: 55db9d9
---

# Story 13.6: Main lisible et mise en scène à l'échelle de la démo

Status: done

## Story

As a joueur sur téléphone,
I want lire ma main et voir les animations comme dans la démo validée,
So that le jeu soit lisible et ait du punch.

## Acceptance Criteria

**Given** un téléphone en portrait (360 × 640 à 430 × 932), en vue d'ensemble comme en zoom
**Then** les cartes de la main sont entièrement visibles (coût, nom lisible, ATQ/PV), dimensionnées pour occuper l'espace libre sans défilement, et un appui soulève et agrandit la carte (aperçu lisible) avant de la jouer
**And** il ne reste pas de bande vide de plus de 24 px : les grilles de la vue d'ensemble grandissent pour occuper l'espace
**And** pendant ma propre attaque, mon camp ne se replie plus en miniatures. L'attaquant et sa cible sont mis en scène au moins à la taille de la démo (100 px de large), puis reviennent à leur socle. Valeurs reprises de `docs/design/animations/demo.html` : élévation ×1,12, élan jusqu'à 78 % de la distance, durées
**And** pose, sort, mort et déclencheurs gardent aussi l'échelle de la démo : une carte qui meurt ou atterrit est montrée à au moins 90 px
**And** preuve visuelle : planches côte à côte (démo / jeu, une image toutes les 100 ms à 390 × 844) générées par un script du dépôt ; les e2e existants restent verts.
**Portée (Root) :** uniquement la table téléphone en portrait (disposition B) ; ordinateur, tablette et paysage inchangés.

## Tasks / Subtasks

- [x] `styles.css` (bloc table compacte) : hauteur répartie exactement (lignes fixes, deux camps qui grandissent jusqu'à la largeur des socles, la main prend le reste, au moins `--hand-min`) ; cartes de plateau jusqu'à la largeur du socle (63 → 70 px à 390 × 844, 46 → 47 px à 360 × 640) ; lignes fixes resserrées sous 700 px de haut.
- [x] Main : conteneur `container-type: size`, cartes dimensionnées sur la hauteur libre (`cqh`), 4 cartes côte à côte sans se couvrir, éventail léger, entièrement visibles ; nom et écussons en `cqw` (≥ 8 / 9 px) ; carte touchée soulevée et agrandie (×1,3) ; défilement horizontal seulement au-delà de 7 cartes.
- [x] `Table.tsx` : l'autre camp ne se replie que sur écran court (`min-height: 760px` sinon) et jamais pendant ma propre attaque (`attackZoom`, aussi pendant le maintien du zoom) ; classe `.fold`.
- [x] `director.ts` : mise en scène (`stage`) sur la table compacte : la carte est agrandie sur place à 104 px de large (propriétés CSS `scale` / `translate`, gardée à l'écran), puis rendue à son socle (280 ms) quand l'action est jouée. Attaque : attaquant et cible grandissent pendant l'élévation ; élan de la démo (toute la largeur, 78 % de la hauteur, ×1,12). Pose : la carte atterrit à 104 px puis se range ; terrain / équipement : une carte vole jusqu'au-dessus du sceau puis s'y range. Déclencheur : la source, puis ses cibles (≤ 2) avant le trait ou l'orbe. Dégâts, soins, statuts, bonus, mort, « Sauvé » : la carte touchée (moins de 3 cartes en scène). `rectOf` donne la place mise en scène aux effets.
- [x] Défilement : `scrollbar-gutter: stable` (demande de Root, correctif fourni) en commit séparé.
- [x] e2e `mobile-table.spec.ts` : main entière et lisible, pas de bande > 24 px, mon camp non replié pendant l'attaque, attaquant et cible ≥ 100 px puis de retour, carte posée ≥ 90 px puis rangée, ordinateur sans mise en scène ; zoom manuel replié seulement sous 760 px.
- [x] `scripts/compare-demo.mjs` : planches démo / jeu (attaque mortelle, pose, sort).

## Dev Agent Record

### Completion Notes List

- Mesures 390 × 844 : cartes de plateau 70 px (69 en zoom), main 4 × 92 px de large, 17 px au-dessus / 19 px au-dessous. 360 × 640 : plateau 47 px (43 pendant l'attaque, 64 en zoom replié), main 74 px.
- Ordinateur, tablette, paysage : captures avant / après identiques (seules les braises d'ambiance bougent) ; la mise en scène ne s'active que sous `.table.compact`, et l'élan hors table compacte garde l'ancienne formule.
- Durées des temps (`TIMING`) inchangées pour ne pas toucher l'ordinateur : le sort du jeu arrive à l'impact en ~1,4 s contre ~2,5 s dans la démo.
- `pnpm typecheck` OK, `pnpm test` 138/138, e2e 32/32 (ports dédiés 2767 / 5374).

### File List

- apps/client/src/ui/Table.tsx, apps/client/src/ui/director.ts, apps/client/src/styles.css
- e2e/mobile-table.spec.ts
- scripts/compare-demo.mjs (nouveau)
- _bmad-output/implementation-artifacts/a-valider-par-root.md, sprint-status.yaml

## Change Log

- 2026-11-22 — Main lisible sur la hauteur libre, camps à pleine largeur, mise en scène à 104 px sur la table téléphone, planches de comparaison (mode autonome).
