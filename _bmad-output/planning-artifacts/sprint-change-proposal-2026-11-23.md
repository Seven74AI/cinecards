---
title: "Sprint Change Proposal — les trois idées d'animation en attente (epic 13)"
project: cinecards
date: 2026-11-23
workflow: gds-correct-course
mode: batch
status: approuvé (demande de Root, 2026-11-23) ; valeurs fixées par la maquette avant/après
scope: mineur
---

# Sprint Change Proposal — idées d'animation en attente

## 1. Résumé du problème

**Déclencheur :** Root demande (2026-11-23) de transformer en stories les trois idées notées en fin d'epic 13
(« Idées en attente ») : durée des déplacements selon la distance, taille des effets relative à la carte, tremblement
de la table à l'échelle de l'écran.

**Type :** amélioration de la mise en scène (pas de bug, pas de règle de jeu).

**Constats mesurés dans le jeu** (scène de dev `?scene=pose`, 2026-11-23) :

| Mesure | Téléphone 390 × 844 | Téléphone 360 × 640 | Ordinateur 1280 × 720 | Ordinateur 1440 × 900 | Ordinateur 1920 × 1080 |
|---|---|---|---|---|---|
| Largeur d'une carte de la table | 70 px (104 px mise en scène) | 47 px (104 px mise en scène) | 45 px | 59 px | 72 px |
| Attaque face à face → la plus lointaine | 266 → ~400 px | 193 → ~300 px | 126 → ~530 px | 148 → ~680 px | 168 → ~830 px |
| Main → case de la table | ~320 px | ~240 px | 310 → ~650 px | 450 → ~760 px | 600 → ~950 px |

- **Durées fixes** (`ui/director.ts`, `game/fx.ts`) : l'attaque met 390 ms (élan 220 + charge 170), qu'elle vise la carte
  d'en face ou la case X, à 4 à 5 fois la distance sur ordinateur. Une courte charge paraît lente, une longue paraît
  sauter. Même chose pour la pose (850 ms), la pioche, le retour en main, les projectiles et les traits.
- **Tailles fixes** : particules de 5 à 8 px montant de 30 à 70 px, flèche de stat de 22 px, étoile d'impact plafonnée
  à 64 px, chiffres des héros de 20 à 40 px. Le coefficient `fitOf` existant est borné à 0,6 – 1,2 et ne touche que
  certains chiffres. Sur ordinateur (cartes de 45 à 72 px), l'étoile et les particules débordent largement de la carte.
- **Tremblement fixe** : jusqu'à 10 px partout, soit 2,6 % de la largeur d'un téléphone de 390 px mais 0,7 % d'un
  écran de 1440 px.

## 2. Analyse d'impact

| Item | Statut | Note |
|---|---|---|
| 1.1 Story déclencheuse | [x] | Idées notées après les stories 13.10 à 13.12 |
| 1.2 Problème | [x] | Mise en scène : durées et tailles fixes, indépendantes de la géométrie |
| 1.3 Preuves | [x] | Mesures ci-dessus, code cité |
| 2.1 Epics concernés | [x] | Epic 13 seulement (rouvert, trois stories ajoutées) |
| 2.2 Changement d'epic | [x] | Stories 13.13 à 13.15 à la suite de l'epic 13, qui les listait déjà |
| 2.3 Epics futurs | [x] | Aucun impact sur l'epic 9 (cartes de Root) |
| 2.5 Ordre | [x] | 13.13, puis 13.14, puis 13.15 ; avant l'epic 9 |
| 3.1 GDD | [N/A] | Aucune règle touchée |
| 3.2 Architecture | [x] | Petite extension : la lecture des actions (`Playback`) peut demander au directeur la durée d'un déplacement mesuré sur la table (13.13) ; `planBeats` reste pur |
| 3.3 UX | [!] | Changement visuel : **maquette avant/après d'abord**, Root choisit, puis on construit. Ordinateur inchangé sauf demande de Root |
| 3.4 Autres artefacts | [x] | Démo `docs/design/animations/demo.html` alignée si les valeurs changent ; planches `scripts/compare-demo.mjs` |
| 4.1 Ajustement direct | Viable | Effort faible à moyen, risque faible (client seul, pas de protocole) |
| 4.2 Retour arrière | Non viable | Rien à annuler |
| 4.3 Revue du MVP | Non nécessaire | |

**Impact technique :** client seulement (`game/motion.ts`, `game/fx.ts`, `game/playback.ts`, `ui/director.ts`,
styles des effets). Aucun changement de protocole ni de moteur, donc pas de simulation de 200 parties requise.
Les e2e d'ordre des temps doivent rester verts.

## 3. Approche recommandée

Ajustement direct : trois stories dans l'epic 13, une à la fois, chacune après le choix de Root sur la maquette.
Une seule maquette animée couvre les trois idées (avant à gauche, après à droite, en cadre téléphone et ordinateur).

## 4. Propositions de modification

### epics.md — fin de l'epic 13

OLD : « Idées en attente » (trois puces).
NEW : stories 13.13, 13.14 et 13.15 (texte dans `epics.md`).

### sprint-status.yaml

`epic-13: done` → `in-progress` ; ajout de `13-13-…`, `13-14-…`, `13-15-…` en `backlog`.

## 5. Passage à l'implémentation

- **Portée :** mineure, agent dev.
- **Étapes :** maquette avant/après → choix de Root → `gds-create-story` → `gds-dev-story`, une story à la fois.
- **Critères de succès :** `pnpm typecheck`, `pnpm test`, e2e complet sur ports dédiés ; planches démo/jeu à jour ;
  déploiement vérifié par `/api/smoke` ; choix par défaut notés dans `a-valider-par-root.md`.
