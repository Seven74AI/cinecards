---
title: "Glossaire des mots-clés — textes en jeu"
project: cinecards
date: 2026-11-22
story: 11.8
status: brouillon à relire par Root
source: gdd.md (Mots-clés et déclenchements, révisé au playtest 1)
---

# Glossaire des mots-clés — textes en jeu

Ce sont les textes qui s'affichent quand on appuie sur un mot-clé d'une carte (bulle), et dans l'écran « Règles et mots-clés ». Chaque définition tient en une ou deux lignes sur un téléphone (120 caractères maximum). Les cartes vouvoient le joueur, donc le glossaire aussi.

La story 11.8 génère le glossaire du jeu à partir de ce fichier, qui sert de source unique. Quand Root corrige un texte ici, le jeu le reprend.

## Catégories de cartes

| Mot-clé | Texte en jeu |
|---|---|
| Personnage | Se pose dans un socle personnage. Il a des PV et une ATQ, attaque une fois par tour et riposte quand on l'attaque. |
| Sort instantané | S'applique dès qu'il est posé, puis part au cimetière. |
| Sort persistant | Reste dans un socle sort tant que son effet dure, puis part au cimetière. |
| Équipement | Reste dans un socle sort et renforce un personnage ou une famille tant qu'il est en jeu. |
| Terrain | Se pose dans un socle terrain et donne un bonus permanent aux cartes de sa famille. |

## Déclencheurs (quand une capacité agit)

| Mot-clé | Texte en jeu |
|---|---|
| À l'arrivée | Agit une fois, au moment où la carte est posée. Si elle revient en main puis est reposée, elle agit de nouveau. |
| Attaque | Remplace l'attaque normale du personnage ce tour-ci. Mêmes conditions qu'une attaque : pas le tour où il est posé, sauf hâte. |
| Passif | Agit en permanence tant que la carte est en jeu et n'est pas réduite au silence. |
| Effet | Ce que fait un sort quand il est posé. |
| À la mort | Agit quand la carte est détruite. |
| Quand vous posez une carte | Agit chaque fois que vous posez une autre carte (parfois seulement d'une famille ou d'une catégorie). |
| Quand l'adversaire pose une carte | Agit chaque fois que votre adversaire pose une carte. |
| Début de votre tour | Agit au début de chacun de vos tours. |
| Fin de votre tour | Agit à la fin de chacun de vos tours. |
| Quand il attaque | Agit chaque fois que ce personnage attaque. |
| Quand il est attaqué | Agit chaque fois que ce personnage est attaqué. |
| Quand il détruit une carte | Agit chaque fois que ce personnage détruit une carte adverse. |
| Réaction | Se joue pendant le tour adverse, dans une courte fenêtre : « Contrer » ou « Laisser ». |
| Tous les N tours | Agit un tour sur N, compté à partir du tour où la carte est posée. Le compte à rebours s'affiche sur la carte. |
| Usage unique | Une seule fois par partie. |
| Choix exclusif | Vous choisissez une option parmi deux. |

## Cibles et choix

| Mot-clé | Texte en jeu |
|---|---|
| Jusqu'à N | Choisissez de 0 à N cibles. Validez quand vous voulez, ou « Aucune cible ». |
| Exactement N | Vous devez choisir N cibles, ni plus ni moins. |
| Adjacent | Les socles voisins, à gauche et à droite (n−1 et n+1), dans l'ordre I à X. |
| Famille | Les cartes d'un même film (ex. « monde de Matrix »). |
| Cartes neutres | Les cartes d'une famille qui ne sont pas des sorts. |

## Combat

| Mot-clé | Texte en jeu |
|---|---|
| Attend un tour | Un personnage posé ne peut pas attaquer avant votre prochain tour, sauf s'il a la hâte. |
| Hâte | Peut attaquer dès le tour où il est posé. |
| Riposte | Quand on l'attaque, la cible rend son ATQ à l'attaquant, en même temps. |
| À distance | Son attaque ne provoque pas de riposte. |
| Multi-attaque (N) | Peut attaquer N fois, ou N cibles, par tour. |
| Mortel | Ses dégâts détruisent la cible, quels que soient ses PV. |
| Barrage | Tant que vous avez un personnage en jeu, vos PV ne peuvent pas être attaqués. |

## Statuts et effets

| Mot-clé | Texte en jeu |
|---|---|
| Silence | Ne peut plus utiliser ses capacités (attaque, déclenchées, passives) pendant la durée indiquée, 1 tour par défaut. |
| Poison (N) | Perd 20 PV au début de chacun de ses tours, pendant N tours. |
| Bouclier (X) | Absorbe les X prochains dégâts avant les PV. |
| Immunité | Ignore les effets adverses, mais pas les dégâts d'attaque. |
| Insensible | Ignore les dégâts et les effets adverses. |
| Guérir | Retire les effets négatifs : silence, poison, malus. |
| Soin (X) | Rend X PV, sans dépasser les PV maximum de la carte. |
| Absorber | Prend une valeur (PV ou ATQ) à d'autres cartes et l'ajoute à la carte source. |
| Copier | Prend les PV et/ou l'ATQ d'une autre carte, à leur valeur du moment. |
| Renvoyer | Remet une carte en jeu dans la main de son propriétaire. |
| Invoquer depuis | Fait venir une carte précise depuis une main, un cimetière ou la table adverse. |

## Pièces

| Mot-clé | Texte en jeu |
|---|---|
| Pièces | Paient le coût des cartes. Revenu = numéro de votre tour (10 maximum). Le reste se garde, jusqu'à 10. |
| Bonus de pièces (+N) | +N pièces pour ce tour seulement, même au-delà de 10. Perdues si non dépensées. |
| Plafond de stock (+N) | Vous pouvez garder N pièces de plus tant que la carte est en jeu. |

## Renvois entre cartes (story 11.8)

Ce ne sont pas des mots-clés : le jeu détecte deux sortes de renvois dans le texte et les rend cliquables.

- **Nom de carte entre guillemets** (« Trinity », « Capitaine Iffune ») : ouvre la fiche de cette carte.
- **Nom de capacité entre guillemets** (« Au galop ! ») : ouvre la carte qui porte cette capacité, la capacité mise en évidence.

## Points à trancher par Root

1. **« Effet » pour les sorts** : ce mot convient-il, ou préfères-tu « Sortilège » ou rien du tout, puisqu'un sort agit forcément à la pose ?
2. **« Attaque » comme nom de déclencheur** : peut-on le confondre avec l'attaque normale ? Une autre option : « Action ».
3. **Barrage** : le GDD décrit la règle sans lui donner de nom. Faut-il un mot-clé ?
