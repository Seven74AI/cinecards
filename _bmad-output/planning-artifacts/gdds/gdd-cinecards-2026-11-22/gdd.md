---
title: "GDD — CineCards (titre provisoire)"
game_type: card-game
platforms: [web-mobile, web-desktop]
status: final
created: 2026-11-22
updated: 2026-11-22 (playtest 1 — voir sprint-change-proposal-2026-11-22.md)
inputs:
  - _bmad-output/planning-artifacts/briefs/brief-cinecards-2026-11-21/brief.md
  - _bmad-output/planning-artifacts/briefs/brief-cinecards-2026-11-21/addendum.md
  - _bmad-output/brainstorming-session-2026-11-21.md
  - content/sets/*.json
  - docs/reference/paper-cards-matrix.jpg
---

# CineCards (titre provisoire) — Game Design Document

**Auteur :** Root (design), rédigé par Claude en mode autonome
**Type de jeu :** Card Game — jeu de cartes de combat en duel, deck commun
**Plateformes :** navigateur web, mobile d'abord (téléphone portrait), puis paysage, tablette, ordinateur

> Ce GDD formalise le jeu papier existant de Root. En cas de conflit, **les règles papier confirmées par Root font foi**. Les points déduits sans confirmation sont marqués `[ASSUMPTION]` ; les décisions à trancher par Root sont marquées `[NOTE FOR DESIGNER]`. Index complet en fin de document.

---

## Executive Summary

### Core Concept

Duel de cartes au tour par tour entre deux amis, en ligne. Les deux joueurs piochent dans **un seul deck commun** qui contient toutes les cartes du jeu. Chaque carte représente un personnage, un sort ou un terrain tiré d'un film des années 1990-2000 ; ses capacités portent des répliques cultes détournées. Le numérique sert d'**arbitre automatique** : il applique les règles, calcule chaque bonus, statut et cycle, et affiche l'état de la partie sans que personne n'ait à noter quoi que ce soit.

### Target Audience

Root et son cercle d'amis, qui jouent déjà à la version papier. Adultes, cinéphiles, à l'aise avec les jeux de cartes. Parties de 15 à 30 minutes, en duel, à distance, surtout sur téléphone. Aucune diffusion publique.

### Unique Selling Points (USPs)

1. **Le jeu papier des amis, sans la comptabilité** : tous les effets complexes (cycles de 2 tours, absorptions, copies de stats) sont suivis par la machine.
2. **Le cinéma comme système** : familles par film, terrains qui renforcent un film, duos de personnages qui s'appellent, répliques cultes comme noms de capacités.
3. **Deck commun** : pas de collection ni de construction de deck ; chaque partie est un tirage partagé où il faut saisir les occasions.
4. **Réactions hors de son tour** : contre-sorts et attaques pendant le tour adverse, rares dans le genre numérique.

---

## Goals and Context

### Project Goals

- G1 — Rendre une partie numérique **plus rapide et plus confortable** qu'une partie papier, à règles identiques.
- G2 — Permettre de jouer **à distance** entre amis, par lien ou code, sur téléphone.
- G3 — Accueillir à terme **~500 cartes** (25 à 60 films) sans retoucher le moteur de règles : chaque nouvelle carte doit pouvoir être décrite avec le vocabulaire d'effets de ce document.

### Background and Rationale

Le jeu existe sur papier (set Matrix de référence, 18 cartes). Le frein principal du papier est la prise de notes : PV, bonus, statuts, effets cycliques. Le projet est un loisir personnel, sans contrainte de délai ni de monétisation. Hébergement visé : GitHub Pages pour le jeu, VPS de Root pour le serveur de partie.

---

## Core Gameplay

### Game Pillars

1. **Fidélité au papier** — Les règles et les textes de cartes de Root font foi. Le numérique n'invente pas de mécanique ; il tranche seulement les ambiguïtés, avec l'accord de Root. *Test de décision : « est-ce que ça marcherait pareil sur la table de Root ? »*
2. **L'arbitre invisible** — Tout ce qui demandait un crayon est calculé et montré : origine de chaque modificateur, compteurs de cycle, statuts, journal. *Test : « un joueur a-t-il besoin de retenir quelque chose de tête ? » Si oui, l'interface doit l'afficher.*
3. **Le cinéma comme système** — Familles, terrains, duos et répliques portent des mécaniques, pas de la décoration. *Test : toute nouvelle carte appartient à une famille et sa capacité principale évoque une scène ou une réplique du film.*
4. **Duel entre amis, à distance** — Parties privées, rythme tenu (chrono), ton complice (émotes). *Test : une fonctionnalité qui ne sert pas le duel 1 contre 1 entre amis est hors périmètre.*

### Core Gameplay Loop

**Une partie**
1. Création d'une salle privée ; l'adversaire rejoint par lien ou code.
2. Le deck commun est mélangé ; chaque joueur reçoit 7 cartes. Le premier joueur est tiré au sort. `[ASSUMPTION : tirage au sort ; pas de compensation pour le second joueur]`
3. Les joueurs alternent les tours jusqu'à ce que les PV d'un joueur tombent à 0.

**Un tour** (joueur actif)
1. **Début du tour** : pioche 1 carte ; revenu de pièces = numéro du tour du joueur (tour 1 → 1 pièce, tour 3 → 3 pièces), revenu maximum 10. Les pièces non dépensées restent en stock ; stock plafonné à 10.
2. **Déclencheurs de début de tour** : passifs « au début de votre tour », soins périodiques, poison, compteurs de cycle. Néo (« Y m'faut des armes, un maximum d'armes », règle de Root du 2026-11-22) : tous les 2 tours de son propriétaire (premier doublement 2 tours après sa pose), son ATQ double et garde ce gain tant qu'il reste en jeu (160 → 320 → 640…) ; réduit au silence, il ne double pas ce tour-là ; une carte qui quitte la table perd ses bonus. `[ASSUMPTION : le doublement a lieu après le poison et avant les autres passifs de début de tour, et double l'ATQ actuelle, bonus temporaires et auras compris — le gain, lui, est permanent]`
3. **Phase principale** (dans n'importe quel ordre, autant de fois que les pièces le permettent) :
   - poser des cartes (personnage dans un socle personnage, sort persistant ou équipement dans un socle sort, terrain dans un socle terrain ; sort instantané résolu puis envoyé au cimetière) ;
   - attaquer avec les personnages éligibles, ou utiliser leur capacité d'attaque à la place ;
   - les effets déclenchés (à l'arrivée, quand une carte est posée…) s'exécutent automatiquement.
4. **Fin du tour** : bouton « Clore le tour » ou chrono écoulé ; déclencheurs de fin de tour ; le tour passe.

**Boucle d'envie de rejouer** : poser une carte → voir sa réplique s'afficher → enchaîner un combo de famille (terrain + duo) → retourner la situation par une réaction pendant le tour adverse.

### Win/Loss Conditions

- Chaque joueur a **700 PV personnels** (maximum 700).
- Tant qu'un joueur a **au moins un personnage** sur sa table, ses PV personnels ne peuvent pas être attaqués : les personnages font **barrage** (mot-clé « Barrage »).
- Quand un joueur n'a **plus aucun personnage**, toute attaque adverse touche directement ses PV personnels.
- Un joueur dont les PV personnels atteignent **0** perd immédiatement.
- **Abandon** : bouton « Abandonner » → défaite.
- **Déconnexion** : le joueur a 90 secondes pour revenir ; au-delà, défaite. `[ASSUMPTION : 90 s, dans la fourchette 1-2 min du brief]`
- **Égalité** : si les deux joueurs tombent à 0 PV pendant la même résolution, la partie est nulle. `[ASSUMPTION]`

---

## Game Mechanics

### Primary Mechanics

**Pièces (ressource)**
- Revenu au début du tour = min(numéro du tour du joueur, 10).
- Stock = pièces non dépensées + revenu, plafonné à 10.
- Toute carte coûte son nombre de pièces pour être posée. Un terrain sans coût imprimé (« - ») coûte 0. `[ASSUMPTION]`
- Le plafond de stock (10) peut être modifié par des cartes :
  - **Bonus de pièces (+n)** : ajoute n pièces pour le tour en cours uniquement, même au-delà du plafond ; les pièces bonus non dépensées sont perdues en fin de tour.
  - **Plafond de stock (+n)** : augmente le stock maximum de n tant que la carte source est en jeu (sans effet sur le revenu, toujours plafonné à 10).
- Les cartes de coût supérieur à 10 (Smith 13, Ça pisse tu m'étonnes 12) ne sont jouables qu'avec ces effets. Cartes du MVP qui les fournissent : *Brittany et Tiffany Wilson* (bonus de pièces +3) et *Les Hamptons* (plafond de stock +3).

**Pioche**
- 1 carte au début de chaque tour, dans le deck commun.
- Main maximum : 10 cartes. Une carte piochée au-delà va directement au cimetière de son propriétaire. `[ASSUMPTION]`
- **Deck commun vide** : les deux cimetières sont mélangés pour former un nouveau deck commun. S'ils sont vides aussi, on ne pioche pas. `[ASSUMPTION]`
- Chaque joueur a **sa pioche**. En mode **pioche partagée**, les deux pioches sont le même deck commun ; « VOTRE deck » et « deck ADVERSE » désignent alors tous deux le deck commun. En mode **decks personnels aléatoires**, chaque texte vise la pioche correspondante.

**Poser des cartes**
- Aucune limite de cartes posées par tour, hors pièces.
- Par joueur : **10 socles personnages** (numérotés I à X), **5 socles terrain**, **5 socles sorts actifs**.
- Un personnage posé ne peut pas attaquer avant votre prochain tour (« attend un tour »), sauf capacité contraire.
- Un socle plein ne peut pas recevoir de carte. Si les 10 socles personnages sont pleins, aucun personnage supplémentaire ne peut être posé.

**Attaquer**
- Chaque personnage éligible attaque **une fois par tour**, sauf capacité contraire (ex. Smith : 3 cibles par tour).
- Cible : un personnage adverse ; ou les PV personnels de l'adversaire s'il n'a plus de personnage.
- **Riposte** : l'attaquant inflige son ATQ à la cible ; la cible inflige simultanément son ATQ à l'attaquant. Une attaque sur les PV personnels ne provoque pas de riposte.
- Certaines capacités suppriment la riposte (« ignore les dégâts de sa cible », « attaque à distance »).
- Un personnage dont les PV tombent à 0 est détruit et va au cimetière de son propriétaire.

**Capacités**
- Chaque capacité a un **type de déclenchement** (voir Mots-clés) et un indicateur de **puissance** : 1 à 4 icônes d'un élément (éclair jaune, étoile noire, poing rouge, œil violet).
- La puissance est **purement indicative** (lisibilité, équilibrage) ; elle ne coûte rien.
- Une capacité appartient à l'une de trois familles :
  1. **Effet déclenché** (la majorité) : s'exécute automatiquement quand un événement se produit — à l'arrivée de la carte, quand vous posez une autre carte, quand l'adversaire pose une carte, à la mort, au début ou à la fin de votre tour, quand il attaque ou est attaqué, quand il détruit une carte. Le joueur fait ses choix (cibles, options) au moment du déclenchement, avant un éventuel lancer de dé de la même capacité `[ASSUMPTION]` ; les effets « quand il attaque / est attaqué » se résolvent pendant l'attaque, sans cible à choisir `[ASSUMPTION]`. Les effets de fin de tour se résolvent avant le passage du tour, ceux de début de tour après la pioche `[ASSUMPTION]`. Un effet à l'arrivée se déclenche à chaque pose de la carte (s'il revient en main puis est reposé, il se déclenche de nouveau).
  2. **Attaque spéciale** (capacité d'attaque, active) : le personnage l'utilise **à la place de son attaque normale**, une fois par tour, aux mêmes conditions que l'attaque (pas le tour de sa pose, sauf hâte). Réservée aux effets modestes et répétables.
  3. **Passif** : toujours actif tant que la carte est en jeu et non réduite au silence.
- Une mention explicite prime : « tous les N tours », « usage unique ».
- **Règle d'équilibrage** : un effet utilisable à chaque tour ne pioche pas plus d'une carte, ne donne pas de bonus permanent cumulable à plusieurs cartes et ne contrôle pas plusieurs cartes adverses.
- **Choix de cibles** : « choisissez N » se lit « jusqu'à N » — le joueur choisit de 0 à N cibles. Seul « exactement N » impose le nombre. Le jeu ne complète jamais un choix au hasard.
- Le vocabulaire des déclencheurs est extensible : un nouvel événement s'ajoute au moteur sans toucher aux cartes existantes.
- Raison : la pioche (Epok, Le maître des clés), la récupération (Smith) et les bonus de masse (Le Mulo, Epok) deviennent sinon des moteurs incontrôlables (constaté au playtest 1).

**Familles et terrains**
- Chaque carte appartient à la **famille** de son film (ex. « monde de Matrix »).
- Un **terrain** donne un bonus aux cartes d'une famille précise (ex. La Matrice : −50 % de dégâts reçus pour vos cartes Matrix). Les effets de plusieurs terrains se cumulent. `[ASSUMPTION]`
- Les « cartes neutres » d'une famille (texte A.P.U) = les cartes de cette famille qui ne sont pas des sorts. `[ASSUMPTION]`

**Hasard**
- Les dés sont des d6 tirés par le serveur et montrés à l'écran (animation de lancer). Aucune décision cachée de hasard.

**Calcul des dégâts et modificateurs** (ordre de résolution)
1. Valeur de base (ATQ imprimée, modifiée par les bonus/malus actifs).
2. Effets de l'attaquant (« mortel » de Trinity). L'ATQ de Néo ne multiplie plus les dégâts : elle double elle-même tous les 2 tours (voir « Début du tour »).
3. Réductions de la cible (−50 % La Matrice, moitié des dégâts de Cypher), cumulées multiplicativement. `[ASSUMPTION]`
4. Bouclier (absorbe en premier), puis PV.
5. Arrondi à la dizaine inférieure après réduction. `[ASSUMPTION]`

### Controls and Input

| Action | Mobile (tactile) | Ordinateur (souris) |
|---|---|---|
| Voir une carte en détail | Appui long → fiche carte | Clic → inspecteur latéral |
| Poser une carte | Glisser de la main vers un socle libre, ou toucher la carte puis le socle | Glisser-déposer ou clic carte puis socle |
| Attaquer | Toucher son personnage, puis « Attaquer », puis la cible | Clic personnage → clic cible |
| Utiliser une capacité | Fiche carte → « Lancer » | Inspecteur → « Lancer » |
| Réagir hors de son tour | Fenêtre de réaction : « Contrer » / « Laisser » | Idem |
| Finir le tour | « Clore le tour » | Idem ou touche Entrée `[ASSUMPTION]` |
| Journal | Bouton livre | Panneau toujours visible |

Toutes les cibles tactiles mesurent au moins 44 × 44 px. Une action illégale est refusée avec une explication courte (« Pas assez de pièces : 7 requises, 4 en stock »).

---

## Card Game Specific Elements

### Card Types and Effects

**Catégories**

| Catégorie | Zone en jeu | Comportement |
|---|---|---|
| Personnage | Socle personnage (10) | PV, ATQ, rôle, capacités ; attaque et riposte |
| Sort instantané | — | Résolu puis cimetière |
| Sort persistant | Socle sort (5) | Reste en jeu tant que son effet dure, puis cimetière |
| Équipement | Socle sort (5) | Reste en jeu ; lié à un personnage ou une famille |
| Terrain | Socle terrain (5) | Bonus permanent à une famille |

**Raretés** : commune (gris), rare (bleu), épique (violet), légendaire (orange). **Toutes les catégories ont une rareté** (personnages, sorts, équipements, terrains ; décision de Root du 2026-11-22). La rareté se lit à la gemme et aux ornements de la carte ; la catégorie se lit au jeton de coût (voir Art Style).

**Rôles de personnage** : héros, guerrier, soutien, traqueur, boss, snitch (traître). Le rôle sert aux synergies (« vos cartes traqueur gagnent… ») et à l'illustration par défaut.

**Attributs d'une carte** : nom, famille, catégorie, rareté, rôle, coût (pièces), PV, ATQ, élément (icône), capacités (nom = réplique, puissance, déclenchement, texte), illustration. Variante : **corps multiples** (Sentinelles : 3 corps de 100 PV / 40 ATQ, chaque corps attaque et meurt séparément `[ASSUMPTION]`).

**Mots-clés et déclenchements** (vocabulaire de référence pour toutes les cartes futures)

| Mot-clé | Définition |
|---|---|
| Attaque spéciale | Remplace l'attaque normale du personnage, une fois par tour (mêmes conditions que l'attaque) |
| Effet | Ce que fait un sort quand il est posé |
| Barrage | Tant que vous avez un personnage en jeu, vos PV ne peuvent pas être attaqués |
| Passif | Toujours actif tant que la carte est en jeu et non réduite au silence |
| À l'arrivée | Se déclenche quand la carte est posée ; déclencheur par défaut des effets puissants |
| Quand vous posez une carte | Se déclenche quand son propriétaire pose une autre carte (filtre possible : famille, catégorie) |
| Quand l'adversaire pose une carte | Se déclenche quand l'adversaire pose une carte (filtre possible) |
| Début / fin de votre tour | Se déclenche au début ou à la fin de chaque tour de son propriétaire |
| Quand il attaque / est attaqué / détruit une carte | Se déclenche lors de l'événement de combat correspondant |
| Hâte | Peut attaquer le tour où il est posé |
| Jusqu'à N | Choisir de 0 à N cibles (lecture par défaut de « choisissez N ») ; « exactement N » impose le nombre |
| À la mort | Se déclenche quand la carte est détruite |
| Réaction | Utilisable pendant le tour adverse, dans une fenêtre de réaction |
| Choix exclusif | Le joueur choisit une option parmi deux |
| Tous les N tours | Actif un tour sur N, compté à partir du tour où la carte est posée (tours de son propriétaire) |
| Usage unique | Une fois par partie |
| Silence | La carte perd l'usage de ses capacités (d'attaque, déclenchées et passives) pendant la durée indiquée ; 1 tour par défaut `[ASSUMPTION]` |
| Poison (n) | Perd 20 PV au début de chacun de ses tours pendant n tours `[ASSUMPTION : valeur]` |
| Bouclier (x) | Absorbe les x prochains dégâts |
| Bonus de pièces (+n) | +n pièces pour ce tour seulement, au-delà du plafond si besoin |
| Plafond de stock (+n) | Stock maximum augmenté de n tant que la source est en jeu |
| Immunité | Ignore les effets adverses (pas les dégâts d'attaque) |
| Insensible | Ignore les dégâts et les effets adverses |
| Guérir | Retire les effets négatifs (silence, poison, malus) |
| Soin (x) | Rend x PV, sans dépasser les PV maximum de la carte |
| Absorber | Retire une valeur à des cartes et l'ajoute à la carte source |
| Copier | Fixe PV et/ou ATQ d'une carte à ceux d'une autre |
| Multi-attaque (n) | Peut attaquer n fois / n cibles par tour |
| À distance | L'attaque ne provoque pas de riposte |
| Mortel | Les dégâts détruisent la cible quels que soient ses PV |
| Renvoyer | Remet une carte en jeu dans la main de son propriétaire |
| Invoquer depuis | Fait venir une carte précise depuis une main, un cimetière ou la table adverse |
| Adjacent | Socles d'index voisins (n−1 et n+1) dans la rangée logique I à X, quel que soit l'affichage (grille 2×5 sur mobile) |

**Anti-boucle infinie**
- Une même capacité ne peut se déclencher qu'une fois par chaîne de résolution.
- Une chaîne de résolution est limitée à 50 effets ; au-delà, elle s'arrête et le journal l'indique. `[ASSUMPTION]`
- Les effets « copier » et « absorber » s'appliquent sur les valeurs actuelles au moment de la résolution et ne se recalculent pas.

**Ensemble de cartes du MVP : 51 cartes**

| Set | Année | Cartes | Source |
|---|---|---|---|
| Matrix | 1999 | 18 | Transcription des cartes papier (`content/sets/matrix.json`) |
| Monty Python : Sacré Graal ! | 1975 | 13 | Créé par Claude (`holy-grail.json`) |
| Hot Shots! | 1991 | 10 | Créé par Claude (`hot-shots.json`) |
| FBI : Fausses Blondes Infiltrées (White Chicks) | 2004 | 10 | Créé par Claude (`white-chicks.json`) |

Le détail carte par carte vit dans les fichiers de données ; ce GDD n'en duplique pas le texte.

### Deck Building

**Modes de deck**

| Mode | Pioches | Disponibilité |
|---|---|---|
| Pioche partagée | Un deck commun pour les deux joueurs (mode principal) | MVP |
| Decks personnels aléatoires | Le deck commun est mélangé puis coupé en deux moitiés égales, une par joueur | MVP |
| Decks personnels construits | Chaque joueur compose son deck à partir de toutes les cartes | Post-MVP (après comptes et import des ~500 cartes) |

Le mode est choisi par le créateur de la salle. En mode decks personnels, une pioche vide se reforme à partir du cimetière de son propriétaire. `[ASSUMPTION]` Règles de construction (taille, exemplaires) à définir avec Root pour le mode construit.

- **Pas de construction de deck au MVP.** Un seul deck commun contient **un exemplaire de chaque carte** du jeu (51 au MVP, ~500 à terme).
- Option de partie `[ASSUMPTION, post-MVP]` : choisir les familles incluses dans le deck commun (ex. « seulement Matrix et Sacré Graal »), pour des parties thématiques.
- Archétypes émergents : jouer « en famille » (terrain + cartes du même film) ou « opportuniste » (meilleure carte disponible).

### Mana/Resource System

- Ressource unique : les **pièces** (voir Primary Mechanics).
- Courbe : revenu 1, 2, 3… jusqu'à 10 au tour 10 ; stock maximum 10.
- Pas de rampe ni de destruction de ressource dans le set actuel ; l'effet « jouez 1 carte gratuitement ce tour-ci » (L'ange sans ailes) contourne le coût d'une carte.
- Courbe de coût cible par rareté (pour les cartes futures) : commune 1-3, rare 4-5, épique 6-8, légendaire 9-10, pour toutes les catégories (les sorts actuels vont de 2 à 12).

### Turn Structure

| Phase | Contenu | Fenêtre de réaction adverse |
|---|---|---|
| Début | Pioche, revenu, déclencheurs | Non |
| Principale | Poser, capacités, attaques | Oui, après chaque sort ou attaque adverse, si l'adversaire a une réaction possible |
| Fin | Déclencheurs de fin, passage du tour | Non |

- **Chrono** : 75 secondes par tour `[ASSUMPTION : dans la fourchette 60-90 s du brief]`, **dans tous les modes (en ligne, solo, hot seat)**, toujours visible (sablier et secondes, alerte à 10 s). À 0, les choix en attente sont résolus par défaut (aucune cible pour « jusqu'à N »), puis le tour se termine. Le chrono est suspendu pendant une fenêtre de réaction. En hot seat, il démarre quand le joueur lève l'écran de passage ; en solo, le Grimoire joue en quelques secondes.
- **Fenêtre de réaction** : 5 secondes `[ASSUMPTION]`. Elle ne s'ouvre que si le joueur non actif possède une réaction utilisable ; sinon le jeu ne marque aucune pause. Choix assumé : la rapidité prime sur le bluff entre amis (la pause peut révéler qu'une réaction existe).
- Durée de partie visée : 15 à 30 minutes, soit environ 10 à 16 tours par joueur.

### Card Collection and Progression

Sans objet : pas de collection, pas de déblocage, pas de monnaie, pas de méta-jeu (décision du brief). Toutes les cartes sont disponibles dès la première partie.

### Game Modes

- **MVP** : duel privé 1 contre 1 par lien ou code ; **hot seat** (deux joueurs sur un même appareil) ; **solo contre le Grimoire** (adversaire automatique qui joue des coups légaux, pour s'entraîner).
- **Post-MVP** : comptes (e-mail ou Google), liste d'amis, invitation directe, historique des parties.
- Hors périmètre : classé, draft, campagne, IA stratégique, spectateurs, tournois, plus de 2 joueurs.

---

## Progression and Balance

### Player Progression

Pas de progression persistante. La progression est interne à la partie : montée des pièces (1 → 10), accumulation de la table, combos de famille.

### Difficulty Curve

Prise en main assurée par l'interface plutôt que par un tutoriel :
- actions possibles mises en évidence (cartes jouables lumineuses, socles libres qui s'éveillent) ;
- refus explicites des actions illégales ;
- détail de chaque modificateur au survol ou à l'appui long ;
- partie d'entraînement en solo contre le Grimoire et hot seat (MVP) ;
- glossaire : appui sur un mot-clé → définition ; appui sur un nom de carte ou de capacité cité → ouverture de la carte ; écran « Règles et mots-clés ».

### Economy and Resources

**Repères d'équilibrage** (tirés des cartes papier)

| Rareté | Coût | PV | ATQ |
|---|---|---|---|
| Commune | 1-3 | 40-100 | 10-60 |
| Rare | 4-5 | 90-160 | 40-90 |
| Épique | 6-9 | 90-350 | 70-200 |
| Légendaire | 9-13 | 300-600 | 130-160 |

**Cartes à surveiller** (puissance élevée, à valider en test) : Smith (absorbe 50 % de tout le terrain), Cypher (toutes vos cartes copient ses stats), Epok et Maître des clés (pioche répétée), Ça pisse tu m'étonnes (immunité permanente), E.M.P (silence global). Le journal de partie conserve les données nécessaires à leur réglage.

---

## Level Design Framework

### Level Types

Pas de niveaux. L'équivalent est la **table de jeu** : 2 joueurs × (10 socles personnages + 5 terrains + 5 sorts), deck commun, deux cimetières, deux mains.

### Level Progression

Sans objet. La variété vient du tirage du deck commun et de l'ajout progressif de familles (25 à 60 films à terme, 8 à 20 cartes par famille).

---

## Art and Audio Direction

### Art Style

**« Grimoire fantastique »** (validé). Maquettes de référence : canevas « CineCards — Pistes de design », page « Direction Grimoire ».
- Table de bois sombre éclairée à la bougie, vignettage, braises qui montent.
- Cartes en parchemin serties d'or, même cadre pour toutes les catégories (maquettes D, E, F du canevas « Cadres de cartes CineCards », copiées dans `docs/design/card-frames/`) :
  - **jeton de coût = catégorie** : blason doré avec épée (personnage), sceau de cire rouge avec éclair (sort), écrou d'acier hexagonal avec engrenage (équipement), pierre verte en losange avec montagne (terrain) ; parchemin teinté selon la catégorie (clair, rosé, gris, vert pâle) ;
  - **gemme et ornements = rareté** : commune (jeton nu, cadre simple), rare (anneau gravé autour du jeton, équerres aux coins, liseré bleu), épique (pierre sertie dans le jeton, fleurons, halo violet), légendaire (couronne de laurier qui luit autour du jeton, filigrane, cadre ardent et reflet) ;
  - écusson rouge = ATQ, écusson pourpre = PV (vert si boosté, rouge si blessé), personnages seulement ;
  - ornements dessinés en SVG (net à toute taille, léger) ; pas de modèles 3D.
- Socles : cercles de runes dorés numérotés I-X (personnages), sceaux (terrains), pierres runiques (sorts). Un socle occupé pulse en turquoise.
- Boutons d'action : sceaux de cire rouge. Tour affiché sur un bandeau de parchemin avec sablier.
- Polices : Cinzel Decorative (titres), Cinzel (noms, chiffres, boutons), Alegreya (textes de capacités).
- Illustrations : photos des cartes papier pour Matrix ; emblèmes héraldiques par rôle aux couleurs du film pour les sets créés (`content/art/emblems/`), remplaçables par les images de Root.
- Mises en page : mobile portrait en grille 2×5 par joueur ; ordinateur en trois colonnes (zones et journal / table / inspecteur de carte).
- Animations : runes qui tournent, pose de carte avec éclat, réplique sur parchemin qui se déroule, dégâts qui apparaissent, sablier qui se retourne. Respect du réglage système « réduire les animations ».

### Audio and Music

Effets sonores légers dans l'ambiance Grimoire : pose de carte (papier + carillon), attaque (choc métallique), riposte, destruction (parchemin qui brûle), sceau de cire (fin de tour), sablier (10 dernières secondes), lancer de dé. Pas d'extraits de films. Musique d'ambiance optionnelle, coupée par défaut. `[ASSUMPTION]` Volume et coupure accessibles en un geste.

---

## Technical Specifications

### Performance Requirements

- 60 images/seconde sur un téléphone milieu de gamme de 2022 pendant une partie (animations comprises). `[ASSUMPTION : appareil de référence]`
- Premier affichage jouable en moins de 3 secondes sur une connexion 4G.
- Latence perçue d'une action en ligne (poser une carte, attaquer) inférieure à 300 ms entre les deux joueurs dans un même pays.
- État de partie conservé par le serveur pour permettre la reconnexion jusqu'à 90 secondes.

### Platform-Specific Details

- Navigateurs : Safari iOS, Chrome Android, Chrome/Firefox/Safari/Edge ordinateur, versions des 2 dernières années.
- Mobile portrait en priorité (largeur de référence 390 px) ; paysage, tablette et ordinateur adaptés.
- Hébergement : jeu en fichiers statiques (GitHub Pages) ; serveur de partie temps réel sur le VPS de Root ou un service gratuit (décision en Architecture).
- Le serveur est l'arbitre : il valide chaque action et tire les dés ; les clients ne font qu'afficher.

### Asset Requirements

- 51 illustrations au MVP (18 photos Matrix + 21 emblèmes réutilisés), ~500 à terme.
- Format des données de carte : un fichier par famille (`content/sets/{id}.json`), schéma commun.
- 7 icônes de rôle, 4 icônes d'élément de puissance, 8 icônes de statut et de zone (feuille d'icônes existante).
- ~10 effets sonores.

---

## Development Epics

### Epic Structure

Détail dans `epics.md`.

| # | Epic | MVP | Livre |
|---|---|---|---|
| E1 | Moteur de règles | Oui | Tour, pièces, pioche, pose, attaque/riposte, victoire, mots-clés, anti-boucle |
| E2 | Cartes et effets du MVP | Oui | Schéma de données, 51 cartes encodées, tests par carte |
| E3 | Table de jeu mobile-first | Oui | Interface Grimoire : table, main, fiche carte, journal, refus d'actions |
| E4 | Duel en ligne | Oui | Salle privée par lien/code, synchronisation, chrono, fenêtre de réaction, reconnexion |
| E5 | Animations et son | Partiel | Animations clés et effets sonores |
| E6 | Comptes et amis | Non | Connexion, liste d'amis, historique, émotes |
| E7 | Pipeline de contenu | Non | Import des ~500 cartes de Root, illustrations, options de familles |
| E8 | Decks personnels construits | Non | Règles de construction, écran de construction, sauvegarde des decks |

Ordre : E1 → E2 → E3 → E4 → E5, puis E6, E7 et E8.

---

## Success Metrics

### Technical Metrics

- 100 % des 51 cartes du MVP couvertes par au moins un test de règles automatisé.
- 0 désynchronisation d'état entre les deux joueurs sur 20 parties de test.
- Reconnexion réussie dans 95 % des coupures de moins de 90 secondes.

### Gameplay Metrics

- Durée médiane d'une partie entre 15 et 30 minutes.
- Après 5 parties de test, Root et ses amis jugent la version numérique plus rapide que le papier (question directe, oui/non).
- Aucune « dispute de règles » non tranchée par le jeu sur 10 parties (tout cas ambigu rencontré devient une règle de ce GDD).

---

## Out of Scope

**Version 1.0 (MVP)** : comptes, amis, historique, émotes, musique, options de familles.
**Jamais (décision du brief)** : méta-jeu, collection, boutique, monétisation, IA stratégique, recherche d'adversaire publique, spectateurs, replays, tournois, parties à plus de 2 joueurs, diffusion publique.

---

## Assumptions and Dependencies

**Dépendances**
- Root fournit ses ~500 cartes (format à définir) et ses illustrations.
- Le VPS de Root est disponible pour le serveur de partie, ou un service temps réel gratuit est retenu.
- Usage privé uniquement (photos de films et d'acteurs).

**Points tranchés par Root** (anciens `[NOTE FOR DESIGNER]`)
1. ~~Coûts supérieurs au stock maximum~~ — résolu : cartes de bonus de pièces et de plafond de stock.
2. ~~« VOTRE deck » / « deck ADVERSE »~~ — résolu : une pioche par joueur ; modes pioche partagée et decks personnels aléatoires au MVP.
3. ~~Actives répétables chaque tour~~ — résolu : une fois par carte posée. *Remplacé par le point 5.*
4. ~~Fenêtre de réaction et bluff~~ — résolu : fenêtre ouverte seulement si une réaction est possible.
6. Cartes (2026-11-22) : catégorie lue au jeton de coût, rareté à la gemme et aux ornements ; toutes les catégories ont une rareté ; étiquettes « Effet » (sort) et « Attaque spéciale » ; la protection des PV par les personnages s'appelle « Barrage ».
5. Capacités (révisé au playtest 1, 2026-11-22) : effets déclenchés par défaut, capacités d'attaque à la place de l'attaque, choix de 0 à N cibles par défaut. Solo contre le Grimoire et chrono dans tous les modes au MVP.

**Index des `[ASSUMPTION]`**
Premier joueur tiré au sort sans compensation · 90 s de reconnexion · partie nulle si double K.O. · terrain sans coût = 0 · main max 10 · deck vide → cimetières remélangés · terrains cumulables · cartes neutres = non-sorts · réductions cumulées multiplicativement, arrondi à la dizaine inférieure · corps multiples indépendants · silence 1 tour par défaut · poison 20 PV/tour · chaîne d'effets limitée à 50 · chrono 75 s · fenêtre de réaction 5 s (hypothèses acceptées par Root le 2026-11-22) · choix des cibles avant le dé d'une même capacité · « quand il attaque / est attaqué » sans cible · déclencheurs de début de tour après la pioche, de fin de tour avant le passage · Néo double son ATQ actuelle (bonus compris) au début de son tour, avant les autres passifs (hypothèses validées par Root le 2026-11-22, lot 1) · touche Entrée pour finir le tour · options de familles post-MVP · appareil de référence 2022 · musique coupée par défaut.
