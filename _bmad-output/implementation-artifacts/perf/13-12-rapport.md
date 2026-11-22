# Story 13.12 — mesure avant / après (fluidité sur téléphone)

Date : 2026-11-22. Script : `scripts/perf-phone.mjs` (Playwright, émulation iPhone 13 : 390 × 664, densité 3, tactile).
Images chronométrées dans la page avec `requestAnimationFrame`, 3 passages par ligne (moyenne ; « pire image » = pire des 3).

- **Avant** : commit `1d69880` (13.10), avec seulement l'interrupteur `VITE_SCENES` de 13.12 pour ouvrir les scènes de test dans une version de production.
- **Après** : story 13.12.
- Les deux : `VITE_SCENES=1 vite build` puis `vite preview` (React de production, minifié — ce que reçoit l'iPhone).

Scènes : `mort` = Topper Harley tue les Chevaliers « Ni ! » (élan, impact, mort, cendres), 3,5 s mesurées depuis l'appui ;
`pose` = je lance le missile à tête chercheuse depuis la main (vol, mise en avant avec voile, orbe, impact), 6 s ;
`repos` = la table sans action, 3 s (coût des effets d'ambiance seuls).

| Moteur | Scène | Avant : moy. i/s | Avant : pire image | Avant : images > 50 ms | Après : moy. i/s | Après : pire image | Après : images > 50 ms |
|---|---|---|---|---|---|---|---|
| Chromium, processeur ×4 | mort | 57,7 | 100 ms | 1 | **59,2** | **33 ms** | **0** |
| Chromium, processeur ×4 | pose | 59,0 | 133 ms | 1 | **59,7** | **33 ms** | **0** |
| Chromium, processeur ×4 | repos | 59,9 | 33 ms | 0 | 60,0 | 17 ms | 0 |
| WebKit (Linux), densité 3 | mort | 19,7 | 381 ms | 16 | 24,8 | 343 ms | 14 |
| WebKit (Linux), densité 3 | pose | 46,1 | 296 ms | 14 | 50,5 | 330 ms | 10,7 |
| WebKit (Linux), densité 3 | repos | 55,4 | 59 ms | 1,3 | 57,0 | 54 ms | 0,7 |
| WebKit (Linux), densité 1 | mort | 41,5 | 148 ms | 4,7 | 46,0 | 139 ms | 3,3 |
| WebKit (Linux), densité 1 | pose | 56,6 | 333 ms | 2,7 | 58,9 | 176 ms | 2 |
| WebKit (Linux), densité 1 | repos | 61,5 | 31 ms | 0 | 61,7 | 29 ms | 0 |

Données brutes : `13-12-before.json`, `13-12-after.json`, `13-12-before-webkit-dpr1.json`, `13-12-after-webkit-dpr1.json`.

## Lecture

- **Objectif atteint sur Chromium ralenti ×4** (≥ 55 i/s, aucune image > 50 ms) dans les deux scènes. La longue image restante
  avant 13.12 était celle de l'appui : création du moteur audio (~45 ms ralenti), règles, rendu React de toute la table et
  début de la mise en scène dans la même tâche. Le son démarre maintenant au premier appui, les règles passent à l'image
  suivante et la mise en scène à celle d'après : trois images courtes (≤ 33 ms) au lieu d'une de 100 à 130 ms.
- **WebKit n'atteint pas l'objectif, et ne le peut pas dans ce conteneur** : le WebKit de Playwright sous Linux n'a pas de
  processeur graphique, il compose chaque image en logiciel. À densité 3 (1170 × 1992 pixels), déplacer la table (tremblement)
  ou agrandir deux cartes coûte 25 à 40 ms par image quelle que soit la façon de l'animer ; à densité 1 le même passage monte
  à 46 i/s. Les mesures par élimination (couper une famille d'animations à la fois) montrent que le coût est réparti entre
  le tremblement de la table, les cartes mises en scène et les éclats, sans coupable unique. Un iPhone compose ces calques
  sur son processeur graphique : ce passage sert de comparaison avant / après (gain de 4 à 5 i/s partout), pas de verdict
  absolu. La mesure qui compte est le compteur `?fps` sur l'iPhone de Root.
- **Au repos**, les effets d'ambiance coûtaient des images > 34 ms à WebKit (6 par 3 s) ; il en reste 4 avec moins de braises,
  des runes plus lentes et sans lueur de bougie animée sur téléphone.

## Ordinateur inchangé

`scripts/compare-desktop.mjs --before <avant> --after <après>` : accueil, table, choix de cible (cibles qui pulsent) et fiche
ouverte, en 1440 × 900 et 1024 × 768, boucles tenues à leur début, compte à rebours masqué :
0,000 % de pixels différents partout, sauf 0,006 % sur la fiche en 1440 × 900 (bord du masque du compte à rebours, dont la
largeur suit la seconde affichée). Au sommet de leur pulsation, le laurier est identique (copie pré-dessinée) et la cible
s'éclaire d'un voile clair à 13 % au lieu d'une luminosité × 1,18 (rendu très proche).

## Pour Root

Ouvrir le jeu avec `?fps` (ex. `…/cinecards/?fps`) : « 60 i/s · min 58 » en bas à gauche, mis à jour chaque seconde
(orange sous 50 de moyenne ou 20 au minimum). Le mode Économie d'énergie d'iOS plafonne Safari à 30 i/s : le désactiver
pour mesurer.
