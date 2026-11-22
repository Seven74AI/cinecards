---
title: "Game Brief — CineCards (titre provisoire)"
status: final
created: 2026-11-21
updated: 2026-11-22
inputs:
  - _bmad-output/brainstorming-session-2026-11-21.md
  - docs/reference/paper-cards-matrix.jpg
---

# Game Brief — CineCards (titre provisoire, nom à trouver)

## Résumé

CineCards est l'adaptation en ligne, jouable dans le navigateur, d'un jeu de cartes papier existant créé par Root : des duels de cartes à la Hearthstone dont les personnages, sorts et terrains sont tirés de films. Chaque carte met en scène un acteur ou une scène culte, et ses capacités portent des répliques détournées avec humour.

Sur papier, le jeu fonctionne, mais il faut tout noter : PV, bonus, malus, statuts, effets « tous les 2 tours ». La version numérique est d'abord un **arbitre automatique** : elle applique fidèlement les règles existantes, affiche clairement l'état de la partie et permet de jouer à distance entre amis. Le but est d'avoir des parties plus rapides, plus confortables et sans disputes de règles.

C'est un projet personnel, destiné au cercle d'amis de Root, sans diffusion publique.

## Vision

**En une phrase :** rejouer les scènes cultes du cinéma en duel de cartes avec ses amis, sans jamais sortir un papier et un crayon.

**Le fantasme du joueur :** organiser un affrontement entre films. Le joueur pose Néo sur le terrain de la Matrice, contre le sort adverse, et voit son plan se dérouler comme une scène de film.

**Ce que le joueur doit ressentir :** la complicité des répliques cultes, le plaisir des combos entre personnages d'un même film, et la fluidité d'une partie où tout se calcule tout seul.

## Joueurs visés

- **Joueurs principaux :** Root et ses amis, qui connaissent déjà la version papier et aiment le cinéma et les jeux de cartes. Ils jouent en duel, à distance, une partie à la fois. Une partie dure 15 à 30 minutes.
- **Pas de cible commerciale :** pas d'étude de marché.

## Fondamentaux

**Genre :** jeu de cartes de combat au tour par tour, en 1 contre 1, avec un **deck commun** (les deux joueurs piochent dans le même tas de ~500 cartes uniques). Pas de construction de deck, pas de collection.

**Boucle de jeu (un tour) :**
1. Piocher 1 carte et recevoir autant de pièces que le numéro du tour. Les pièces non dépensées sont gardées, avec un stock plafonné à 10.
2. Les passifs et les effets cycliques se déclenchent automatiquement.
3. Poser des cartes (personnages, sorts, terrains, équipements) en payant leur coût, avec 10 cartes au maximum sur la table.
4. Utiliser les capacités des cartes activées.
5. Attaquer : chaque carte attaque une fois par tour (sauf capacité contraire), mais pas le tour où elle est posée, et la cible riposte.
6. Victoire : quand un joueur n'a plus de personnage, les attaques touchent ses 700 PV ; à 0, il perd.

**Piliers :**
1. **Fidélité au jeu papier.** Les règles et les cartes existantes font foi. Le numérique automatise, il ne réinvente pas.
2. **L'arbitre invisible.** Tout est calculé, suivi et affiché : origine des bonus, compteurs de cycle, statuts. Le joueur ne note plus rien.
3. **Le cinéma comme système.** Les familles par film, les terrains-décors, les rôles (héros, boss, snitch…) et les répliques cultes sont au cœur des mécaniques, pas de la décoration.
4. **Entre amis, à distance.** Parties privées, ton complice, interactions simples.

## Références

| Jeu | Ce qu'on prend | Ce qu'on ne prend pas |
|---|---|---|
| **Hearthstone** | Ressource croissante de 1 à 10, riposte, carte qui attend un tour avant d'attaquer, plateau qui protège le joueur, lisibilité numérique | Construction de deck, collection, boutique, ressource perdue en fin de tour |
| **Pokémon TCG** | Gabarit des cartes, PV et dégâts en dizaines et centaines, icônes de puissance | Énergies à attacher, une seule attaque par tour, cartes Dresseur |
| **Le jeu papier de Root** | Toutes les règles, les raretés, les familles, les cartes et leur ton | La comptabilité manuelle |

## Périmètre et MVP

**Plateforme :** navigateur web, **conçu mobile d'abord** (téléphone en portrait), puis adapté au paysage, à la tablette et à l'ordinateur.

**Équipe :** Claude réalise tout le projet via les agents BMAD : formalisation des règles, architecture, développement, transcription des cartes, revues, tests. Root fournit les cartes papier (textes et images), tranche les questions de règles, valide chaque étape et teste le jeu.

**Délai et budget :** aucun délai imposé. Hébergement gratuit ou presque : le site du jeu de préférence sur **GitHub Pages**, et le **VPS de Root** pour ce qui doit tourner en continu. GitHub Pages ne sert que des fichiers statiques : le serveur temps réel du mode en ligne (parties, chrono, reconnexion) devra donc vivre sur le VPS ou sur un service temps réel gratuit — choix à trancher à l'étape Architecture.

**MVP**, conçu pour vérifier qu'une partie numérique est plus fluide et plus agréable qu'une partie papier :
- un duel en ligne 1 contre 1, rejoint par **lien ou code** ;
- un **deck d'environ 50 cartes** : le set Matrix (18 cartes de référence) + 3 sets créés par Claude : *Monty Python : Sacré Graal !*, *Hot Shots!* et *FBI : Fausses Blondes Infiltrées* (Wayans) — 33 cartes, dans `content/sets/` ;
- toutes les règles du tour automatisées : pièces, pioche, pose, capacités, attaques et ripostes, statuts, victoire ;
- une table lisible : stats modifiées en couleur, détail des bonus, compteurs de cycle, journal de partie ;
- le chrono par tour et la reconnexion (1 à 2 minutes).

**Après le MVP :**
- comptes (e-mail ou Google) et liste d'amis, historique des parties ;
- émotes et répliques prédéfinies ;
- fenêtre de réaction pour les contre-sorts ;
- effets visuels (réplique en sous-titre, décor de terrain animé) ;
- les autres films, jusqu’aux ~500 cartes.

**Hors périmètre :** méta-jeu et progression, IA, recherche d'adversaire publique, spectateurs, parties à plus de 2 joueurs, replays, tournois, monétisation.

## Contenu et direction

- **Contenu :** ~500 cartes uniques tirées de **films des années 1990 et 2000**. Chaque film forme une famille de **8 à 20 cartes**, soit environ 25 à 60 films au total. Premier set : Matrix (1999).
- **Visuels :** les illustrations des cartes papier (photos de films). Usage privé uniquement.
- **Direction artistique : « Grimoire fantastique »** (validée). Table de bois sombre éclairée à la bougie ; cartes en parchemin serties d'or (pièce d'or = coût, gemme = rareté, écussons ATQ/PV) ; socles personnages = cercles de runes numérotés I à X ; socles terrain = sceaux ; socles sorts = pierres runiques ; boutons d'action = sceaux de cire. Animations : lueur de bougie, braises, runes qui tournent, pose de carte avec éclat, reflet sur les légendaires, réplique sur parchemin qui se déroule. Respect du réglage « réduire les animations ». Maquettes : canevas « CineCards — Pistes de design », page « Direction Grimoire ».
- **Table de jeu :** par joueur, 10 socles personnages, 5 socles terrain et 5 socles sorts actifs.
- **Son :** effets sonores légers dans l'ambiance Grimoire (pose de carte, attaque, sablier, sceau de cire) ; pas d'extraits de films.

## Risques et questions ouvertes

**Risques**
- **Formaliser les effets.** Les textes des cartes sont rédigés librement, avec des cas ambigus : conditions « en main ou au cimetière », dés, copies de stats, absorptions. Chaque carte doit devenir une règle exacte. *Parade : formaliser d'abord les 18 cartes Matrix et en tirer un vocabulaire d'effets réutilisable.*
- **Réactions hors de son tour.** Les contre-sorts et les attaques de Néo pendant le tour adverse sont complexes à gérer en temps réel. *Parade : à prototyper tôt ; les reporter après le MVP si besoin.*
- **Équilibrage.** Certains effets sont très puissants (Cypher copie ses stats sur toutes vos cartes, Smith absorbe 50 % du plateau). Sur papier, les joueurs arbitrent ; en numérique, la règle s'applique sans appel.
- **Saisie du contenu.** Il faut transcrire ~500 cartes (textes et images) dans un format exploitable.

**Questions ouvertes (pour le GDD)**
- Lecture exacte des icônes de puissance : quel lien entre leur nombre ou leur couleur et la puissance ?
- Ce qui se passe quand le deck commun est épuisé.
- Durée du chrono et de la fenêtre de réaction.
- Format dans lequel Root fournira ses ~500 cartes (photos des cartes papier, fichiers, tableur ?).
- Nom définitif du jeu (pas encore choisi).
- Choix technique du temps réel : serveur sur le VPS ou service gratuit (étape Architecture).
