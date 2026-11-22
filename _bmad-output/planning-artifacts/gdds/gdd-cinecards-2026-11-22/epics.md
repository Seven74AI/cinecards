---
title: "Epics — CineCards"
source: gdd.md
created: 2026-11-22
---

# Development Epics — CineCards

Chaque epic livre des mécaniques du GDD. Les stories ci-dessous sont de haut niveau ; le découpage détaillé se fera avec `gds-create-epics-and-stories` après l'Architecture.

## E1 — Moteur de règles (MVP)

**But :** appliquer toutes les règles du GDD de façon déterministe, indépendamment de l'interface.
- E1.1 Partie : mélange du deck commun, distribution de 7 cartes, tirage du premier joueur, alternance des tours.
- E1.2 Pièces : revenu = tour (max 10), stock plafonné, paiement des coûts.
- E1.3 Pioche : une pioche par joueur (partagée ou personnelle), 1 carte par tour, main max 10, pioche vide → remélange.
- E1.3b Modes de deck : pioche partagée et decks personnels aléatoires (deck commun coupé en deux).
- E1.4 Pose : socles (10 personnages, 5 terrains, 5 sorts), « attend un tour ».
- E1.5 Combat : attaque, riposte, attaque directe sans personnage, 700 PV, victoire, défaite, nul.
- E1.6 Modificateurs : ordre de calcul des dégâts, bouclier, arrondi, origine traçable de chaque modificateur (pour l'affichage).
- E1.7 Mots-clés : implémentation de chaque mot-clé du glossaire (actif, passif, à l'arrivée, à la mort, réaction, choix, cycles, silence, poison, immunité, insensible, absorber, copier, multi-attaque, à distance, mortel, renvoyer, invoquer depuis, adjacent).
- E1.8 Anti-boucle : une capacité par chaîne, chaîne limitée à 50 effets.
- E1.9 Dés : tirage arbitré, résultat exposé.
- E1.10 Journal : chaque événement produit une entrée lisible.

## E2 — Cartes et effets du MVP (MVP)

**But :** les 51 cartes jouables avec leur texte exact.
- E2.1 Schéma de données d'une carte et d'une famille (fichiers `content/sets/*.json`).
- E2.2 Encodage des effets des 18 cartes Matrix.
- E2.3 Encodage des 33 cartes Sacré Graal, Hot Shots!, White Chicks.
- E2.4 Un test de règles par carte (cas nominal + cas limite).
- E2.5 Résolution des `[NOTE FOR DESIGNER]` du GDD avant encodage des cartes concernées.

## E3 — Table de jeu mobile-first (MVP)

**But :** jouer confortablement sur téléphone, dans la direction Grimoire.
- E3.1 Table mobile portrait : grilles 2×5, lignes terrains/sorts, bandeau du tour, PV et pièces.
- E3.2 Main en éventail, glisser-déposer et toucher-toucher pour poser.
- E3.3 Sélection, attaque et ciblage ; mise en évidence des actions possibles.
- E3.4 Fiche carte (appui long) avec capacités et origine des modificateurs.
- E3.5 Journal de partie.
- E3.6 Refus d'action expliqué.
- E3.7 Adaptation paysage, tablette et ordinateur (trois colonnes avec inspecteur).

## E4 — Duel en ligne (MVP)

**But :** deux amis jouent à distance.
- E4.1 Création de salle et code / lien d'invitation (carte « invitation au duel »).
- E4.2 Synchronisation de l'état de partie, arbitrage côté serveur.
- E4.3 Chrono de tour (75 s) et fin automatique.
- E4.4 Fenêtre de réaction (5 s) pour les réactions hors tour.
- E4.5 Déconnexion et reconnexion (90 s), défaite au-delà.
- E4.6 Abandon.

## E5 — Animations et son (partiel au MVP)

- E5.1 Ambiance : lueur de bougie, braises, runes qui tournent.
- E5.2 Pose de carte, attaque, riposte, destruction, dégâts qui apparaissent.
- E5.3 Moment fort : réplique sur parchemin.
- E5.4 Effets sonores (~10) et réglage du volume.
- E5.5 Respect de « réduire les animations ».

## E6 — Comptes et amis (post-MVP)

- E6.1 Connexion e-mail ou Google.
- E6.2 Liste d'amis et invitation directe.
- E6.3 Historique des parties.
- E6.4 Émotes et répliques prédéfinies.

## E7 — Pipeline de contenu (post-MVP)

- E7.1 Import des cartes de Root (format à définir).
- E7.2 Gestion des illustrations (photo ou emblème par défaut).
- E7.3 Option de partie : familles incluses dans le deck commun.
- E7.4 Outil de vérification : chaque nouvelle carte utilise uniquement des mots-clés connus.

## E8 — Decks personnels construits (post-MVP)

- E8.1 Règles de construction (taille, exemplaires) avec Root.
- E8.2 Écran de construction de deck (filtres par film, rareté, coût).
- E8.3 Sauvegarde des decks liée au compte.
- E8.4 Choix du deck à l'entrée dans la salle.
