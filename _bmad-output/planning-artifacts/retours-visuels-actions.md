---
title: "Retours visuels de chaque action — spécification"
project: cinecards
date: 2026-11-22
epic: 12
status: brouillon à valider par Root
---

# Retours visuels de chaque action

**Demande de Root (2026-11-22) :** chaque action doit se voir. Aujourd'hui, une attaque ne montre que des PV qui baissent, et une carte détruite disparaît sans rien montrer. Référence de genre : Hearthstone. On reprend les **principes** (mise en scène, lisibilité, poids des coups), pas ses images, ses sons ni sa direction artistique : tout reste dans le style Grimoire.

## Constat technique

L'animation de l'epic 7 (`apps/client/src/game/fx.ts`, `ui/Table.tsx`) applique le **nouvel état tout de suite**, puis superpose des effets (chiffres flottants, tremblement, éclat).

Conséquences :
- **Destruction :** une carte détruite est retirée de la table avant que son effet de mort ne joue, et l'éclat s'affiche dans un socle vide.
- **Attaque :** elle ne joue qu'un son, sans mouvement.
- **Pose :** une carte posée apparaît sans trajectoire.

**Correctif de fond (story 12.1) :** une **couche de présentation**. Le client garde l'état affiché séparé de l'état réel. Il rejoue les événements un par un, et chaque « temps » de l'animation fait avancer l'état affiché. La règle reste celle du moteur (rien n'est décidé côté client). Les actions du joueur restent possibles pendant la lecture, mais la suite de l'animation accélère.

## Principes (inspirés du genre)

1. **Une action, une cause visible :** on voit toujours *qui* agit (la source s'illumine ou bouge), *sur quoi* (trajectoire ou lien vers la cible) et *le résultat* (chiffre, état, mort).
2. **Le poids suit la valeur :** gros dégâts = impact plus fort, tremblement plus marqué, chiffre plus grand. Une légendaire a droit à son entrée (déjà en place).
3. **Séquence lisible :** les effets se jouent dans l'ordre de la chaîne de résolution, avec de courtes pauses. Rien ne se joue tout en même temps.
4. **L'adversaire aussi :** en ligne, on voit les actions adverses avec la même mise en scène (carte posée depuis sa main, attaque qui part de son côté).
5. **Rapide :** une action simple dure moins de 0,8 s. Réglage « Vitesse des animations » : normale, rapide, instantanée. « Réduire les animations » remplace les mouvements par des fondus.
6. **Son et image ensemble :** chaque temps a son son (les sons de l'epic 7 sont réutilisés et complétés).

## Catalogue : action → retour visuel

| Action / événement | Retour visuel | Durée cible |
|---|---|---|
| Début de votre tour | Bandeau « À vous de jouer » qui se déroule, le sablier se retourne, les cartes jouables s'illuminent | 0,9 s |
| Début du tour adverse | Bandeau « Tour adverse » plus discret | 0,6 s |
| Pioche | La carte sort du deck, glisse jusqu'à la main et se retourne (dos visible pour l'adversaire) | 0,5 s |
| Pièces gagnées | Les pièces tintent et rejoignent le compteur | 0,4 s |
| Poser un personnage | La carte quitte la main en arc, grossit au-dessus du socle puis s'y pose avec un petit impact (cercle de runes qui s'allume, poussière dorée) | 0,6 s |
| Poser un sort | La carte s'agrandit au centre, brûle en parchemin, et l'effet part vers sa cible | 0,7 s |
| Poser un terrain | Le sceau du terrain s'imprime, une onde de couleur parcourt les cartes de sa famille | 0,7 s |
| Poser un équipement | La carte vient se fixer sur la pierre runique, éclat métallique | 0,5 s |
| Déclencheur (à l'arrivée, à la mort…) | La carte source pulse, une étiquette « À l'arrivée » et le nom de la capacité apparaissent au-dessus, puis l'effet part | 0,5 s + effet |
| Attaque | L'attaquant se soulève, fonce vers la cible, la percute (éclair d'impact, tremblement proportionnel), puis revient dans son socle | 0,6 s |
| Riposte | La cible renvoie un choc visible vers l'attaquant (même impact, plus petit) | inclus |
| Attaque spéciale | Comme une attaque, mais la source s'illumine et un trait magique (couleur du déclencheur) part vers la cible, sans contact | 0,6 s |
| Attaque sur les PV du joueur | L'attaquant fonce vers le portrait du joueur, qui tremble ; gros chiffre rouge | 0,7 s |
| Dégâts | Éclaboussure de chiffre (taille selon la valeur), la carte rougit brièvement, et l'écusson PV descend en comptant | 0,5 s |
| Bouclier qui absorbe | Le bouclier se fissure ou éclate ; chiffre « absorbé » gris | 0,4 s |
| Soin | Lueur verte montante, « +X » vert | 0,5 s |
| Bonus / malus (stats) | Flèche dorée vers le haut / violette vers le bas sur l'écusson concerné | 0,4 s |
| Statut appliqué (silence, poison…) | L'icône du statut se pose sur la carte avec un petit effet propre (silence : chaînes, poison : bulles vertes) | 0,4 s |
| Mort d'une carte | La carte se fige, se fissure, puis se consume en parchemin brûlé (braises) et ses cendres glissent vers le cimetière | 0,8 s |
| Mort évitée | La carte se fissure puis se recolle, « Sauvé ! » | 0,6 s |
| Renvoyer en main | La carte se soulève et repart en arc vers la main de son propriétaire | 0,5 s |
| Invoquer depuis… | La carte arrive de sa zone d'origine (cimetière, main adverse) jusqu'au socle | 0,6 s |
| Dé | Lancer animé (existant) | 1,3 s |
| Fenêtre de réaction | L'écran s'assombrit légèrement, la carte qui réagit monte au premier plan | — |
| Action refusée | La carte tremble « non », message court (existant) | 0,3 s |
| Fin de partie | Victoire : le portrait adverse se brise, pluie d'or. Défaite : la table s'assombrit | 2 s |

## Découpage proposé (epic 12)

1. **12.1 Couche de présentation :** l'état affiché avance au rythme des événements. Les cartes mortes restent visibles le temps de leur animation. Réglage de vitesse et de réduction des animations. Les actions restent possibles pendant la lecture.
2. **12.2 Attaques et impacts :** élan de l'attaquant, impact, riposte, tremblement proportionnel, attaque sur le joueur, attaque spéciale.
3. **12.3 Dégâts, soins, statuts :** chiffres à taille variable, compteurs qui défilent, bouclier, effets de statut.
4. **12.4 Mort et départs :** fissure et consumation, cendres vers le cimetière, mort évitée, renvoi en main.
5. **12.5 Poser et piocher :** trajectoires main → socle et deck → main, pour soi et l'adversaire, avec un impact propre à chaque catégorie.
6. **12.6 Déclencheurs et sorts :** pulsation de la source, étiquette du déclencheur, trait ou projectile vers la cible, onde de terrain.
7. **12.7 Rythme du tour :** bandeaux de tour, cartes jouables illuminées, fin de partie.

**Critères communs :**
- 60 images/s sur un téléphone milieu de gamme : transformations CSS et opacité uniquement, pas d'effets qui recalculent la mise en page.
- Une action simple dure moins de 0,8 s.
- Test e2e qui vérifie l'ordre des temps.
- Avec « réduire les animations », il ne reste que des fondus.
