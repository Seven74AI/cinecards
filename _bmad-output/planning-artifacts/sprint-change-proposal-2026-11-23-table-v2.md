---
title: "Sprint Change Proposal — table téléphone v2 (epic 14)"
project: cinecards
date: 2026-11-23
workflow: gds-correct-course
mode: batch
status: approuvé (Root, 2026-11-23, maquette F)
scope: modéré
---

# Sprint Change Proposal — table téléphone v2

## 1. Résumé du problème

**Déclencheur :** retour de Root sur la table téléphone (2026-11-23), après les epics 12 et 13.

**Constats (captures du jeu avec 10 cartes en main, `docs/design/mobile-table-v2/rendus/avant-390.png` et `avant-360.png`) :**
- Le zoom d'un camp (« agrandir », story 13.2) ne sert pas : Root demande de le retirer.
- La main en éventail se chevauche et déborde des deux côtés : il est difficile de toucher une carte précise.
- Le bandeau du joueur gêne la main (la main est coupée en bas à 360 × 640).
- Le but reste le même : toute la partie sans défilement vertical.

**Décision de Root après plusieurs maquettes** (`docs/design/mobile-table-v2/`, canevas https://claude.ai/artifact/GNVShiMg3iVgsHStLSjLMR) :
option **F**.
- Plus de zoom ; une rangée « Terrains » et une rangée « Sorts » par camp (5 cases chacune) ; bandeaux complets.
- La main est repliée derrière un bouton « éventail + pastille » (nombre de cartes) dans mon bandeau ; le même bouton
  l'ouvre et la ferme.
- Main ouverte : un panneau opaque, sans en-tête, posé par-dessus mon camp (le plateau ne bouge pas), cartes sur une
  ligne qui défile horizontalement.
- Deux vues, au choix du joueur dans un nouveau bouton « Réglages » : **Compacte** (faces des cartes) et **Détaillée**
  (carte complète : illustration, type et effet de chaque capacité sans la réplique, ATQ/PV ; 70 % de la largeur de
  l'écran, 280 px au plus ; hauteur du panneau = carte la plus haute de la main, sans défilement vertical).
- Toucher une carte, dans les deux vues, ouvre la fiche actuelle (avec « Jouer » et les répliques).

## 2. Analyse d'impact

| Item | Statut | Note |
|---|---|---|
| 1.1 Déclencheur | [x] | Retour de Root, captures du jeu avec 10 cartes en main |
| 1.2 Problème | [x] | Zoom inutile, main difficile à toucher, bandeau qui gêne la main |
| 1.3 Preuves | [x] | Captures avant, maquettes A à F, rendus vérifiés |
| 2.1 Epics concernés | [x] | Epic 13 (13.2 zoom, 13.6 main et mise en scène) remplacé en partie par une nouvelle epic 14 |
| 2.2 Changement d'epic | [x] | Epic 14 « Table téléphone v2 », 4 stories |
| 2.3 Epics futurs | [x] | Epic 9 : la carte complète devra afficher les capacités des cartes importées (texte plus long possible) |
| 2.5 Ordre | [x] | Epic 14 maintenant, avant l'epic 9 (qui attend les cartes de Root) |
| 3.1 GDD | [x] | Section interface téléphone : main repliée, réglage « Main ouverte » (decision-log) ; aucune règle de jeu touchée |
| 3.2 Architecture | [x] | Client seul ; nouveau format de carte (`CardView` taille « full ») ; réglage local (`localStorage`, comme vitesse et son) |
| 3.3 UX | [x] | Maquette F validée ; ordinateur, tablette et paysage inchangés |
| 3.4 Autres artefacts | [x] | e2e `mobile-table.spec.ts` (zoom) à réécrire ; planches `compare-demo` (cibles de la pioche et du retour en main) |
| 4.1 Ajustement direct | Viable | Effort moyen, risque moyen (disposition téléphone et metteur en scène) |
| 4.2 Retour arrière | Non viable | La disposition B de 13.2 reste la base (un seul DOM par camp) |
| 4.3 Revue du MVP | Non nécessaire | |

**Impact technique :** client seulement. `ui/Table.tsx` (composant `Side`, `zoom`, `autoSide`, `heldZoom`, `fold`),
`styles/mobile-table.css`, `ui/CardView.tsx` (nouvelle taille « full »), `ui/director.ts` (la pioche et le retour en
main visent le bouton de la main quand elle est repliée), un bouton « Réglages » dans la barre du haut. Aucun
changement de protocole ni de moteur : pas de simulation de 200 parties requise.

## 3. Approche recommandée

Ajustement direct : une epic 14 de 4 stories, une à la fois, chacune vérifiée par captures 390 × 844 et 360 × 640 et
comparée aux rendus de `docs/design/mobile-table-v2/rendus/`.

## 4. Propositions de modification

### epics.md

- Tableau « Epic List » : ajout de la ligne 14.
- Nouvelle section « Epic 14: Table téléphone v2 » avec les stories 14.1 à 14.4 (texte dans `epics.md`).

### sprint-status.yaml

Ajout de `epic-14: backlog`, `14-1-…` à `14-4-…` en `backlog`, `epic-14-retrospective: optional`.

### GDD (decision-log)

Ligne du 2026-11-23 : option F de la table téléphone v2 choisie par Root.

## 5. Passage à l'implémentation

- **Portée :** modérée (nouvelle epic), agent dev.
- **Étapes :** `gds-create-story` puis `gds-dev-story`, une story à la fois, dans l'ordre 14.1 → 14.4.
- **Critères de succès :** `pnpm typecheck`, `pnpm test`, e2e complet sur ports dédiés ; pas de défilement vertical de
  360 × 640 à 430 × 932 ; captures conformes aux rendus ; ordinateur inchangé (`scripts/compare-desktop.mjs`) ;
  choix par défaut notés dans `a-valider-par-root.md`.
