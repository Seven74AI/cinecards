---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - _bmad-output/planning-artifacts/gdds/gdd-cinecards-2026-11-22/gdd.md
  - _bmad-output/planning-artifacts/gdds/gdd-cinecards-2026-11-22/epics.md
  - _bmad-output/game-architecture.md
  - _bmad-output/planning-artifacts/briefs/brief-cinecards-2026-11-21/brief.md
mode: autonome (demande de Root)
---

# CineCards - Epic Breakdown

## Overview

Découpage complet en epics et stories, à partir du GDD final, de l'architecture et des maquettes « Direction Grimoire ». Les stories sont dimensionnées pour un agent de développement, dans l'ordre d'implémentation. Code en anglais ; textes joueur en français.

## Requirements Inventory

### Functional Requirements

- FR1 — Partie à 2 joueurs : mélange, 7 cartes en main, premier joueur tiré au sort, alternance des tours.
- FR2 — Revenu de pièces = numéro du tour du joueur (max 10) ; stock plafonné à 10 ; bonus de pièces (+n, ce tour) et plafond de stock (+n) par effets.
- FR3 — Pioche 1 carte/tour ; main max 10 (surplus au cimetière) ; pioche vide → remélange des cimetières (ou du cimetière du propriétaire en mode personnel).
- FR4 — Modes de deck : pioche partagée ; decks personnels aléatoires (deck coupé en deux).
- FR5 — Socles par joueur : 10 personnages (I-X), 5 terrains, 5 sorts actifs ; sorts instantanés résolus puis cimetière.
- FR6 — Un personnage posé attend un tour avant d'attaquer ; 1 attaque/tour sauf capacité.
- FR7 — Attaque avec riposte simultanée ; attaque directe des PV joueur seulement sans personnage adverse ; pas de riposte sur PV joueur.
- FR8 — 700 PV par joueur ; défaite à 0 ; nul si double K.O. ; abandon.
- FR9 — Calcul des dégâts : base → multiplicateurs attaquant → réductions cible (multiplicatives) → bouclier → PV ; arrondi à la dizaine inférieure.
- FR10 — Capacités (révisé au playtest 1) : effets déclenchés (à l'arrivée, quand vous posez une carte, quand l'adversaire pose une carte, à la mort, début/fin de tour, attaque/attaqué/destruction), capacité d'attaque (remplace l'attaque, 1×/tour), passif, réaction, choix exclusif, tous les N tours, usage unique ; un effet répétable reste modeste ; puissance indicative.
- FR11 — 22+ mots-clés d'effet (silence, poison, bouclier, immunité, insensible, guérir, soin, absorber, copier, multi-attaque, à distance, mortel, renvoyer, invoquer depuis, adjacent, bonus de pièces, plafond de stock…).
- FR12 — Familles et terrains : bonus par famille, cumulables.
- FR13 — Dés d6 arbitrés par le serveur, visibles.
- FR14 — Anti-boucle : 1 déclenchement par capacité et par chaîne ; chaîne ≤ 50 effets.
- FR15 — 51 cartes jouables au MVP (Matrix 18, Sacré Graal 13, Hot Shots! 10, White Chicks 10).
- FR16 — Salle privée : création, code à 6 caractères et lien ; rejoindre par code ou lien.
- FR17 — Chrono 75 s/tour visible dans tous les modes (en ligne, solo, hot seat), fin automatique ; fenêtre de réaction 5 s (seulement si réaction possible), chrono suspendu.
- FR18 — Déconnexion ou sortie : 90 s pour revenir (par code, lien ou nouvel onglet), sinon défaite ; seul « Abandonner » met fin à la partie.
- FR19 — Journal de partie lisible.
- FR20 — Refus expliqué des actions illégales.
- FR21 — Détail de l'origine de chaque modificateur (fiche carte / inspecteur).
- FR22 — Interface mobile portrait (grille 2×5), adaptée paysage, tablette, ordinateur (3 colonnes avec inspecteur).
- FR23 — Animations Grimoire et effets sonores ; respect de « réduire les animations ».
- FR24 (post-MVP) — Comptes e-mail/Google, amis, historique, émotes.
- FR25 (post-MVP) — Import des ~500 cartes, illustrations, options de familles.
- FR26 (post-MVP) — Decks personnels construits.
- FR27 — Solo contre le Grimoire (adversaire automatique, coups légaux) et hot seat.
- FR28 — Glossaire : définition des mots-clés et ouverture des cartes ou capacités citées ; catégories de cartes visuellement distinctes.
- FR29 — Choix de cibles « jusqu'à N » (0 à N) par défaut ; « exactement N » seulement si la carte le dit.

### NonFunctional Requirements

- NFR1 — 60 FPS sur téléphone milieu de gamme 2022.
- NFR2 — Premier affichage jouable < 3 s en 4G.
- NFR3 — Latence perçue d'une action < 300 ms entre joueurs d'un même pays.
- NFR4 — Aucune information cachée envoyée au client (main adverse, decks).
- NFR5 — Moteur déterministe : même graine + mêmes actions = même partie.
- NFR6 — Cibles tactiles ≥ 44 px ; contrastes ≥ 4,5:1.
- NFR7 — Navigateurs des 2 dernières années (Safari iOS, Chrome Android, ordinateurs).

### Additional Requirements

- AR1 — Monorepo pnpm : `packages/engine`, `packages/cards`, `packages/protocol`, `apps/server`, `apps/client` (architecture : première story).
- AR2 — TypeScript 7, React 19, Vite 8, Colyseus 0.18, Node 24 LTS, Zod 4, Vitest 5, Playwright 1.65.
- AR3 — Moteur pur : pas d'I/O, pas de `Math.random`/`Date.now` ; PRNG à graine dans l'état.
- AR4 — Réducteur `apply(state, action) → {state, events}` ; erreurs de règles typées, jamais d'exception.
- AR5 — Stats dérivées avec provenance ; auras recalculées.
- AR6 — DSL d'effets dans les données de cartes ; effet `unsupported` exclu des decks.
- AR7 — Vues expurgées par joueur via messages Colyseus.
- AR8 — Client GitHub Pages ; serveur Docker + Caddy sur le VPS (sous-domaine de Root).
- AR9 — Un test de règles par carte ; E2E à deux navigateurs.

### UX Design Requirements

- UX1 — Direction « Grimoire fantastique » (maquettes G0-G6) : cartes parchemin serties d'or, cercles de runes I-X, sceaux, pierres runiques, sceaux de cire.
- UX2 — Mobile : table en grilles 2×5, lignes terrains/sorts, bandeau du tour, main en éventail, fiche carte par appui long.
- UX3 — Ordinateur : zones + journal à gauche, table au centre, inspecteur à droite.
- UX4 — Invitation au duel : lettre scellée avec le code.
- UX5 — Moment fort : réplique sur parchemin, fenêtre « Contre-sort ? » avec sablier.

### FR Coverage Map

| FR | Stories |
|---|---|
| FR1 | 2.1 |
| FR2 | 2.2, 3.9 |
| FR3, FR4 | 2.3 |
| FR5, FR6 | 2.4 |
| FR7, FR8 | 2.5 |
| FR9, FR21 | 2.6 |
| FR10 | 3.1, 3.2, 3.8 |
| FR11 | 3.3 – 3.10 |
| FR12 | 3.4 |
| FR13 | 3.7 |
| FR14 | 3.1 |
| FR15 | 1.2, 4.1 – 4.4 |
| FR16 | 6.1, 6.2 |
| FR17 | 6.4, 6.5 |
| FR18 | 6.6 |
| FR19 | 2.7, 5.6 |
| FR20 | 2.8, 5.7 |
| FR22 | 5.1 – 5.5, 5.8 |
| FR23 | 7.1 – 7.5 |
| FR24 | 8.1 – 8.4 |
| FR25 | 9.1 – 9.3 |
| FR26 | 10.1 – 10.3 |
| FR10, FR17, FR18 (révisés) | 11.2 – 11.4, 11.6 |
| FR27 | 5.9, 11.1, 11.3 |
| FR28 | 11.7, 11.8 |
| FR29 | 11.5 |

## Epic List

| # | Epic | MVP | Valeur livrée |
|---|---|---|---|
| 1 | Fondations du projet | Oui | Dépôt monorepo, outillage, données de cartes validées |
| 2 | Cœur du moteur de règles | Oui | Une partie complète jouable en tests, sans effets spéciaux |
| 3 | Système d'effets | Oui | Tous les mots-clés du GDD exécutables |
| 4 | Les 51 cartes du MVP | Oui | Chaque carte encodée et testée |
| 5 | Table de jeu mobile-first | Oui | Jouer une partie à deux sur un même écran (hot seat) dans le style Grimoire |
| 6 | Duel en ligne | Oui | Deux amis jouent à distance |
| 7 | Animations et son | Oui (partiel) | Ambiance Grimoire et retours sonores |
| 11 | Corrections du playtest 1 | Oui | Solo, chrono et reconnexion fiables ; capacités déclenchées ; lisibilité des cartes (à faire avant 8, 9, 10) |
| 12 | Retours visuels de chaque action | Oui | Chaque action se voit : attaques, morts, poses, déclencheurs (après 11, avant 8, 9, 10) |
| 13 | Retours du playtest 2 | Oui | Aperçu des cartes citées, table sans défilement, origine des bonus et malus (après 12.4) |
| 8 | Comptes et amis | Non | Connexion, amis, historique, émotes |
| 9 | Pipeline de contenu | Non | Import des ~500 cartes |
| 10 | Decks construits | Non | Mode deck personnel construit |

> Écart assumé avec les 8 epics du GDD : le moteur (E1 du GDD) est scindé en « cœur » (epic 2) et « effets » (epic 3), et une epic 1 de fondations précède tout, comme l'exige l'architecture. Correspondance : GDD E1 → 2+3, E2 → 1.2+4, E3 → 5, E4 → 6, E5 → 7, E6 → 8, E7 → 9, E8 → 10.

## Epic 1: Fondations du projet

Mettre en place le dépôt et les contrats partagés pour que toutes les stories suivantes aient une base commune.

### Story 1.1: Initialiser le monorepo

As a développeur,
I want un monorepo pnpm avec les cinq paquets de l'architecture et l'outillage commun,
So that chaque story s'ajoute au bon endroit avec les mêmes règles.

**Acceptance Criteria:**

**Given** un dépôt vide
**When** j'exécute `pnpm install` puis `pnpm test` et `pnpm typecheck`
**Then** les paquets `engine`, `cards`, `protocol`, `server`, `client` existent avec la structure de l'architecture
**And** TypeScript strict, Vitest et un test exemple passent dans chaque paquet
**And** une CI GitHub Actions exécute typecheck et tests

### Story 1.2: Schéma et chargement des cartes

As a développeur,
I want un schéma Zod des cartes et des sets, et un chargeur des fichiers `content/sets/*.json`,
So that les données de Root soient validées avant d'arriver au moteur.

**Acceptance Criteria:**

**Given** les 4 fichiers de sets existants
**When** le chargeur les lit
**Then** 51 cartes valides sont retournées avec des identifiants uniques
**And** une carte invalide (champ manquant, rareté inconnue) produit une erreur qui nomme le fichier, la carte et le champ
**And** les cartes à PV/ATQ multiples (Sentinelles) sont acceptées

### Story 1.3: Contrats partagés (actions, événements, vues)

As a développeur,
I want les types `Action`, `GameEvent`, `PlayerView` et les codes d'erreur dans `packages/protocol`,
So that serveur et client parlent exactement le même langage.

**Acceptance Criteria:**

**Given** le paquet `protocol`
**When** je l'importe depuis `server` et `client`
**Then** les unions discriminées d'actions (`playCard`, `attack`, `useAbility`, `react`, `pass`, `endTurn`, `concede`) et d'événements sont disponibles
**And** les codes d'erreur ont chacun un message français dans `client/src/i18n/fr.ts`

## Epic 2: Cœur du moteur de règles

Une partie complète (sans capacités spéciales) se joue de bout en bout dans les tests, de façon déterministe.

### Story 2.1: Créer une partie et alterner les tours

As a joueur,
I want qu'une partie démarre avec un deck mélangé, 7 cartes chacun et un premier joueur tiré au sort,
So that chaque partie commence équitablement.

**Acceptance Criteria:**

**Given** une graine et la liste des cartes
**When** `createGame({ seed, mode: 'shared' })` est appelé
**Then** chaque joueur a 7 cartes, 700 PV et le premier joueur est déterminé par la graine
**And** la même graine produit exactement la même partie
**And** `endTurn` passe la main à l'autre joueur et incrémente son numéro de tour

### Story 2.2: Pièces

As a joueur,
I want recevoir autant de pièces que le numéro de mon tour, en gardant le reste jusqu'à 10,
So that je puisse planifier mes gros tours.

**Acceptance Criteria:**

**Given** un joueur à son 3ᵉ tour avec 2 pièces en stock
**When** son tour commence
**Then** il a 5 pièces
**And** au tour 12 avec 9 en stock, il a 10 (plafond)
**And** poser une carte retire son coût ; un coût supérieur au stock est refusé avec `NOT_ENOUGH_COINS`

### Story 2.3: Pioche et modes de deck

As a joueur,
I want piocher une carte à chaque tour dans la bonne pioche,
So that le jeu respecte le mode choisi.

**Acceptance Criteria:**

**Given** le mode pioche partagée
**When** un tour commence
**Then** le joueur actif pioche la carte du dessus du deck commun
**And** avec 10 cartes en main, la carte piochée va au cimetière
**And** deck vide → les deux cimetières sont remélangés (graine) ; tout vide → pas de pioche
**And** en mode decks personnels aléatoires, le deck est coupé en deux moitiés égales et chacun pioche dans la sienne

### Story 2.4: Poser des cartes dans les socles

As a joueur,
I want poser personnages, terrains et sorts dans leurs socles,
So that la table reflète mes choix.

**Acceptance Criteria:**

**Given** un joueur avec assez de pièces
**When** il pose un personnage dans un socle libre (I-X)
**Then** la carte occupe ce socle et ne peut pas attaquer ce tour
**And** un socle occupé ou une catégorie incompatible est refusé (`SLOT_OCCUPIED`, `WRONG_SLOT`)
**And** terrain → socle terrain (5), sort persistant/équipement → socle sort (5), sort instantané → résolu puis cimetière

### Story 2.5: Attaque, riposte et victoire

As a joueur,
I want attaquer un personnage adverse et subir sa riposte, ou frapper l'adversaire quand sa table est vide,
So that le combat suive les règles du papier.

**Acceptance Criteria:**

**Given** mon personnage éligible (posé avant ce tour, attaque disponible)
**When** j'attaque un personnage adverse
**Then** chacun inflige son ATQ à l'autre simultanément ; un personnage à 0 PV va au cimetière
**And** attaquer les PV adverses est refusé tant qu'il a un personnage (`TARGET_PROTECTED`)
**And** sans personnage adverse, l'attaque touche ses PV sans riposte ; à 0 PV il perd
**And** double K.O. simultané → partie nulle ; `concede` → défaite

### Story 2.6: Stats dérivées et calcul des dégâts

As a joueur,
I want que les PV et l'ATQ affichés tiennent compte de tous les bonus, avec leur origine,
So that je n'aie jamais à calculer de tête.

**Acceptance Criteria:**

**Given** un personnage avec des modificateurs de sources différentes
**When** `computeStats(state, instanceId)` est appelé
**Then** il renvoie ATQ et PV actuels et la liste des sources
**And** les dégâts suivent l'ordre : base → multiplicateurs → réductions multiplicatives → bouclier → PV, arrondis à la dizaine inférieure
**And** retirer la carte source retire son bonus

### Story 2.7: Journal d'événements

As a joueur,
I want que chaque action produise des événements lisibles,
So that le journal raconte la partie.

**Acceptance Criteria:**

**Given** n'importe quelle action valide
**When** elle est appliquée
**Then** au moins un événement typé est produit (`cardPlayed`, `damageDealt`, `cardDestroyed`, `coinsGained`…)
**And** rejouer la graine et la liste d'actions reproduit les mêmes événements

### Story 2.8: Refus typés des actions illégales

As a joueur,
I want une explication quand une action est impossible,
So that je comprenne les règles en jouant.

**Acceptance Criteria:**

**Given** une action illégale (hors tour, pas assez de pièces, cible protégée, carte en attente…)
**When** elle est appliquée
**Then** l'état est inchangé et le résultat contient `{ code, params }`
**And** aucune exception n'est levée

## Epic 3: Système d'effets

Le langage d'effets (DSL) et son interprète couvrent tous les mots-clés du GDD.

### Story 3.1: Interprète d'effets et chaîne de résolution

As a développeur,
I want un interprète qui exécute les `effects` des capacités via une chaîne de résolution,
So that toutes les cartes partagent le même mécanisme.

**Acceptance Criteria:**

**Given** une capacité avec une liste d'effets
**When** elle est déclenchée
**Then** les effets s'exécutent dans l'ordre et les effets déclenchés s'ajoutent à la chaîne
**And** une même capacité ne se déclenche qu'une fois par chaîne ; au-delà de 50 effets la chaîne s'arrête avec un événement `chainLimitReached`
**And** un effet `unsupported` exclut la carte des decks et apparaît dans un rapport

### Story 3.2: Déclencheurs

As a joueur,
I want que les capacités se déclenchent au bon moment,
So that chaque carte se comporte comme écrit.

**Acceptance Criteria:**

**Given** des capacités active, passive, à l'arrivée, à la mort, début/fin de tour, usage unique
**When** l'événement correspondant survient
**Then** la capacité s'exécute ; une active n'est utilisable qu'une fois par carte posée (redevient disponible si la carte est rejouée)
**And** une carte réduite au silence ne déclenche rien

### Story 3.3: Ciblage et filtres

As a joueur,
I want choisir des cibles valides selon le texte de la carte,
So that je ne puisse pas viser n'importe quoi.

**Acceptance Criteria:**

**Given** des cibles `self`, `chosen`, `all`, `adjacent`, `random` avec filtres (camp, famille, rôle, catégorie, nom)
**When** une capacité demande une cible
**Then** seules les cibles valides sont proposées ; « adjacent » = socles n−1 et n+1 de la rangée logique I-X

### Story 3.4: Modificateurs, auras et terrains

As a joueur,
I want que les bonus de famille et de terrain s'appliquent et disparaissent correctement,
So that les combos de film fonctionnent.

**Acceptance Criteria:**

**Given** La Matrice en jeu
**When** une carte Matrix subit des dégâts
**Then** ils sont réduits de 50 %
**And** les terrains se cumulent ; retirer un terrain retire son bonus ; `modify` permanent ou temporaire respecte sa durée

### Story 3.5: Statuts

As a joueur,
I want silence, poison, bouclier, immunité et insensible,
So that les effets de contrôle fonctionnent.

**Acceptance Criteria:**

**Given** chaque statut appliqué
**When** les tours passent
**Then** silence (1 tour par défaut) bloque les capacités ; poison retire 20 PV par tour ; bouclier absorbe d'abord ; immunité ignore les effets adverses ; insensible ignore dégâts et effets
**And** `cleanse` retire les effets négatifs

### Story 3.6: Effets de cartes et de zones

As a joueur,
I want piocher, regarder et choisir, renvoyer, invoquer depuis une zone, ressusciter, annuler une mort,
So that les effets de zone des cartes marchent.

**Acceptance Criteria:**

**Given** les opérations `draw`, `lookAndPick`, `returnToHand`, `summonFrom`, `revive`, `cancelDeath`, `destroyWhere`, `playFree`
**When** elles s'exécutent
**Then** les cartes changent de zone correctement et la main max reste 10

### Story 3.7: Dés et choix

As a joueur,
I want des lancers de dés visibles et des choix exclusifs,
So that le hasard et les dilemmes soient clairs.

**Acceptance Criteria:**

**Given** un effet `dice` à branches et un effet `chooseOne`
**When** ils s'exécutent
**Then** le d6 vient du PRNG de l'état et produit un événement `diceRolled`
**And** le choix met la partie en attente d'une décision du joueur concerné

### Story 3.8: Cycles « tous les N tours »

As a joueur,
I want que les effets cycliques s'activent au bon tour et que je voie le compte à rebours,
So that je n'aie rien à compter.

**Acceptance Criteria:**

**Given** une carte avec un effet `cycle(2)` posée à mon tour t
**When** mes tours passent
**Then** l'effet est actif à t+2, t+4… (première activation au N-ième tour après la pose)
**And** une fonction expose le nombre de tours restants avant activation

### Story 3.9: Combat avancé et pièces

As a joueur,
I want multi-attaque, attaque à distance, dégâts mortels, absorption, copie de stats, bonus de pièces et plafond de stock,
So that les cartes puissantes fonctionnent.

**Acceptance Criteria:**

**Given** chacune de ces opérations
**When** elle s'exécute
**Then** le résultat suit le glossaire du GDD (à distance = pas de riposte ; absorber/copier sur valeurs actuelles sans recalcul ; bonus de pièces perdu en fin de tour)

### Story 3.10: Fenêtre de réaction (moteur)

As a joueur,
I want pouvoir réagir pendant le tour adverse quand j'ai une réaction,
So that les contre-sorts existent.

**Acceptance Criteria:**

**Given** un sort ou une attaque adverse déclaré
**When** le joueur non actif possède une réaction légale
**Then** l'état passe en `pendingReaction` avec les options ; `react` ou `pass` reprend la résolution
**And** sans réaction possible, l'action se résout immédiatement

## Epic 4: Les 51 cartes du MVP

Chaque carte du MVP est encodée dans le DSL et couverte par un test.

### Story 4.1: Encoder le set Matrix (18 cartes)

As a joueur,
I want que les 18 cartes Matrix fonctionnent comme sur papier,
So that le set de référence soit fidèle.

**Acceptance Criteria:**

**Given** `content/sets/matrix.json`
**When** les effets sont encodés
**Then** chaque capacité a des `effects` (ou `unsupported` justifié) et un test cas nominal + cas limite
**And** E.M.P, Smith, Cypher, Néo, Trinity, Sentinelles (3 corps) passent leurs tests

### Story 4.2: Encoder le set Sacré Graal (13 cartes)

As a joueur,
I want les cartes Sacré Graal jouables,
So that le deck MVP soit varié.

**Acceptance Criteria:**

**Given** `holy-grail.json`
**When** les effets sont encodés
**Then** chaque carte a un test ; Chevalier noir (3 survies à 10 PV, −30 ATQ) et Gardien du pont (dé) sont couverts

### Story 4.3: Encoder le set Hot Shots! (10 cartes)

As a joueur,
I want les cartes Hot Shots! jouables,
So that le deck MVP soit varié.

**Acceptance Criteria:**

**Given** `hot-shots.json`
**When** les effets sont encodés
**Then** chaque carte a un test ; Topper (+10 ATQ par destruction) et Wash Out (cible aléatoire) sont couverts

### Story 4.4: Encoder le set White Chicks (10 cartes)

As a joueur,
I want les cartes White Chicks jouables,
So that Smith et Ça pisse tu m'étonnes soient jouables grâce aux pièces.

**Acceptance Criteria:**

**Given** `white-chicks.json`
**When** les effets sont encodés
**Then** chaque carte a un test ; Héritières (+3 pièces ce tour) permet de poser une carte à 12 ; Les Hamptons porte le plafond à 13

### Story 4.5: Partie simulée complète

As a développeur,
I want une simulation de 200 parties aléatoires avec les 51 cartes,
So that aucune combinaison ne plante ou ne boucle.

**Acceptance Criteria:**

**Given** 200 graines et un joueur automatique qui choisit des actions légales au hasard
**When** les parties se jouent
**Then** toutes se terminent sans exception, en moins de 100 tours, et les statistiques (durée, cartes les plus décisives) sont écrites dans un rapport

## Epic 5: Table de jeu mobile-first

Jouer une partie complète à deux sur un même appareil (hot seat), dans le style Grimoire, avant le réseau.

### Story 5.1: Thème Grimoire et composant carte

As a joueur,
I want des cartes et des socles fidèles aux maquettes Grimoire,
So that le jeu ait son identité.

**Acceptance Criteria:**

**Given** les jetons de design de la feuille G0
**When** une carte s'affiche (taille table, main, grande)
**Then** cadre d'or, pièce de coût, gemme de rareté, écussons ATQ/PV (vert boosté, rouge blessé), statuts et halo de cycle sont rendus
**And** illustrations : photo Matrix ou emblème du rôle/famille

### Story 5.2: Table mobile portrait

As a joueur sur téléphone,
I want la table en grilles 2×5 avec mes lignes terrains/sorts et le bandeau du tour,
So that je voie toute la partie sans défiler.

**Acceptance Criteria:**

**Given** un écran de 390 px de large
**When** une partie est affichée
**Then** la disposition suit la maquette G1 sans défilement horizontal, cibles ≥ 44 px

### Story 5.3: Main et pose de cartes

As a joueur,
I want glisser une carte de ma main vers un socle, ou toucher la carte puis le socle,
So that poser soit naturel au doigt.

**Acceptance Criteria:**

**Given** une carte jouable (lumineuse) dans ma main
**When** je la dépose sur un socle valide
**Then** l'action `playCard` est envoyée au moteur ; les socles valides s'éveillent pendant le geste
**And** une carte trop chère est grisée

### Story 5.4: Attaquer et cibler

As a joueur,
I want sélectionner mon personnage, appuyer sur « Attaquer » et toucher la cible,
So that le combat soit clair.

**Acceptance Criteria:**

**Given** un personnage éligible
**When** je le sélectionne
**Then** seules les cibles valides sont mises en évidence ; la riposte prévue est indiquée avant de confirmer

### Story 5.5: Fiche carte et inspecteur

As a joueur,
I want voir une carte en grand avec ses capacités et l'origine de ses bonus,
So that je comprenne chaque effet.

**Acceptance Criteria:**

**Given** une carte sur la table ou en main
**When** j'appuie longuement (mobile) ou clique (ordinateur)
**Then** la fiche G2 s'ouvre avec boutons « Lancer » pour les actives disponibles et la liste des sources de modificateurs

### Story 5.6: Journal

As a joueur,
I want relire ce qui s'est passé,
So that je suive les actions de l'adversaire.

**Acceptance Criteria:**

**Given** des événements de partie
**When** j'ouvre le journal
**Then** chaque événement apparaît en phrase française avec son icône, du plus récent au plus ancien

### Story 5.7: Messages de refus

As a joueur,
I want comprendre pourquoi une action est refusée,
So that j'apprenne les règles.

**Acceptance Criteria:**

**Given** une action refusée
**When** le moteur renvoie un code
**Then** un message français court s'affiche (« Pas assez de pièces : 7 requises, 4 en stock »)

### Story 5.8: Adaptation paysage, tablette, ordinateur

As a joueur sur grand écran,
I want la mise en page en trois colonnes avec inspecteur,
So that je profite de la largeur.

**Acceptance Criteria:**

**Given** une largeur ≥ 1024 px
**When** la table s'affiche
**Then** zones + journal à gauche, table au centre, inspecteur à droite (maquette G5) ; en paysage mobile, rangées de 10

### Story 5.9: Mode hot seat local

As a joueur,
I want jouer une partie complète à deux sur le même appareil,
So that on teste le jeu avant le mode en ligne.

**Acceptance Criteria:**

**Given** l'accueil
**When** je lance « Partie locale »
**Then** une partie complète se joue jusqu'à la victoire ; un écran de passage masque la main entre les tours

## Epic 6: Duel en ligne

Deux amis jouent à distance, avec chrono, réactions et reconnexion.

### Story 6.1: Serveur et salle de duel

As a joueur,
I want qu'une salle Colyseus héberge la partie et valide chaque action,
So that personne ne puisse tricher.

**Acceptance Criteria:**

**Given** le serveur démarré
**When** deux clients rejoignent une salle `duel`
**Then** le serveur crée la partie avec une graine serveur, applique les actions via le moteur et renvoie `rejected` pour les actions illégales

### Story 6.2: Code et lien d'invitation

As a joueur,
I want créer une salle et partager un code ou un lien,
So that mon ami me rejoigne facilement.

**Acceptance Criteria:**

**Given** l'écran « invitation au duel » (G3)
**When** je crée une salle
**Then** un code de 6 caractères (alphabet sans ambiguïté) et un lien sont générés ; rejoindre par code ou lien fonctionne
**And** une salle sans adversaire expire après 10 minutes ; le créateur choisit le mode de deck

### Story 6.3: Vues expurgées

As a joueur,
I want ne recevoir que ce que j'ai le droit de voir,
So that la main adverse reste secrète.

**Acceptance Criteria:**

**Given** une partie en cours
**When** le serveur envoie l'état
**Then** chaque joueur reçoit `view` avec la main adverse et les decks réduits à des nombres ; un test vérifie qu'aucun identifiant de carte cachée ne transite

### Story 6.4: Chrono de tour

As a joueur,
I want un chrono de 75 s par tour,
So that personne ne fasse attendre.

**Acceptance Criteria:**

**Given** le début d'un tour
**When** 75 s s'écoulent sans « Clore le tour »
**Then** le serveur termine le tour ; le client affiche le sablier et l'heure de fin envoyée par le serveur

### Story 6.5: Fenêtre de réaction en ligne

As a joueur non actif,
I want 5 s pour réagir quand une réaction est possible,
So that je puisse contrer.

**Acceptance Criteria:**

**Given** une action adverse ouvrant `pendingReaction`
**When** le serveur ouvre la fenêtre
**Then** le chrono de tour est suspendu, j'ai « Contrer » / « Laisser » pendant 5 s ; sans réponse, « Laisser »

### Story 6.6: Déconnexion et reconnexion

As a joueur,
I want revenir dans la partie après une coupure,
So that une mauvaise connexion ne me fasse pas perdre.

**Acceptance Criteria:**

**Given** un joueur déconnecté
**When** il revient en moins de 90 s
**Then** il retrouve la partie à l'identique ; au-delà, l'adversaire gagne ; un bandeau « reconnexion… » s'affiche pendant la coupure

### Story 6.7: Déploiement

As a Root,
I want le jeu en ligne sur GitHub Pages et le serveur sur mon VPS,
So that mes amis puissent jouer.

**Acceptance Criteria:**

**Given** le dépôt GitHub et le VPS
**When** je pousse sur `main`
**Then** le client est publié sur GitHub Pages ; le serveur tourne en Docker derrière Caddy en WSS sur le sous-domaine choisi ; un guide pas à pas existe dans `docs/deploy.md`

### Story 6.8: Test de bout en bout à deux navigateurs

As a développeur,
I want un test Playwright qui joue une partie courte entre deux navigateurs,
So that le duel en ligne reste fonctionnel.

**Acceptance Criteria:**

**Given** serveur et client lancés en local
**When** le test s'exécute
**Then** deux navigateurs créent/rejoignent une salle, jouent quelques tours avec une graine fixe et voient le même résultat

## Epic 7: Animations et son

### Story 7.1: Ambiance de table

As a joueur,
I want la lueur de bougie, les braises et les runes qui tournent,
So that l'ambiance Grimoire vive.

**Acceptance Criteria:**

**Given** la table
**When** elle s'affiche
**Then** les animations d'ambiance de la maquette tournent à 60 FPS et s'arrêtent avec « réduire les animations »

### Story 7.2: File d'animations des événements

As a joueur,
I want voir chaque événement s'animer l'un après l'autre,
So that je comprenne l'enchaînement.

**Acceptance Criteria:**

**Given** une liste d'événements reçue
**When** elle est jouée
**Then** pose (chute + éclat), attaque, riposte, dégâts qui apparaissent, destruction s'enchaînent ; l'interface reste utilisable

### Story 7.3: Moment fort

As a joueur,
I want la réplique culte affichée sur un parchemin qui se déroule,
So that les grands moments marquent.

**Acceptance Criteria:**

**Given** une capacité nommée par une réplique
**When** elle se déclenche
**Then** la scène G4 s'affiche 2 s (passable d'un toucher)

### Story 7.4: Effets sonores

As a joueur,
I want des sons légers pour les actions,
So that le jeu soit vivant.

**Acceptance Criteria:**

**Given** ~10 sons (pose, attaque, riposte, destruction, sceau, sablier, dé)
**When** l'événement correspondant survient
**Then** le son joue ; volume réglable et coupure en un geste, mémorisés

### Story 7.5: Lancer de dé animé

As a joueur,
I want voir le dé rouler,
So that le hasard soit transparent.

**Acceptance Criteria:**

**Given** un événement `diceRolled`
**When** il est joué
**Then** un dé animé affiche le résultat reçu du serveur

## Epic 11: Corrections du playtest 1

Retours du premier playtest de Root (2026-11-22). Source : `sprint-change-proposal-2026-11-22.md`. À faire avant les epics 8, 9 et 10 (l'import des cartes de l'epic 9 dépend de la story 11.4).

### Story 11.1: Débloquer le solo quand le Grimoire commence

As a joueur solo,
I want que le Grimoire joue son tour même quand il commence la partie,
So that le mode solo ne se bloque jamais.

**Acceptance Criteria:**

**Given** une partie solo dont le premier joueur tiré au sort est le Grimoire
**When** la partie démarre
**Then** le Grimoire joue son tour et me passe la main
**And** un test sur 300 graines ne laisse aucune partie bloquée

### Story 11.2: Revenir dans une partie en ligne

As a joueur en ligne (hôte ou invité),
I want revenir dans ma partie après l'avoir quittée ou perdu la connexion,
So that une coupure ou une erreur de bouton ne termine pas le duel.

**Acceptance Criteria:**

**Given** un joueur parti depuis moins de 90 s
**When** il saisit le code ou rouvre le lien, même dans un nouvel onglet
**Then** il retrouve son siège et la partie à l'identique
**And** « Quitter » n'abandonne plus (message « vous pourrez revenir pendant 90 s ») ; « Abandonner » demande confirmation
**And** une salle d'attente survit au départ de l'hôte pendant 10 min
**And** les erreurs distinguent salle introuvable, salle complète et partie en cours à reprendre
**And** le test e2e couvre hôte qui part et revient, invité qui part et revient, nouvel onglet

### Story 11.3: Chrono dans tous les modes

As a joueur,
I want voir et subir le chrono de 75 s en ligne, en solo et en hot seat,
So that le rythme reste tenu quel que soit le mode.

**Acceptance Criteria:**

**Given** une partie en ligne, solo ou hot seat
**When** un tour commence
**Then** le sablier et les secondes restantes sont visibles, avec une alerte à 10 s
**And** à 0, les choix en attente sont résolus par défaut puis le tour se termine
**And** en hot seat, le chrono démarre à la levée de l'écran de passage
**And** en ligne, l'affichage reste juste malgré un décalage d'horloge de ±2 min (le serveur envoie le temps restant)

### Story 11.4: Modèle de capacités : déclencheurs et capacités d'attaque

As a moteur de règles,
I want des capacités déclenchées par des événements et des capacités d'attaque qui remplacent l'attaque,
So that aucune carte ne devienne un moteur répétable incontrôlable.

**Acceptance Criteria:**

**Given** le schéma de cartes et le registre d'événements
**When** un événement se produit (arrivée, pose d'une carte alliée ou adverse, mort, début/fin de tour, attaque, attaqué, destruction)
**Then** les capacités abonnées se déclenchent, avec choix du joueur au moment du déclenchement
**And** une capacité d'attaque consomme l'attaque du tour et suit son éligibilité (hâte comprise)
**And** `support.ts` refuse un déclencheur inconnu ; le journal nomme le déclencheur (« À l'arrivée d'Epok : … »)

### Story 11.5: Choisir de 0 à N cibles

As a joueur,
I want choisir entre 0 et N cibles quand une carte dit « choisissez N »,
So that je garde le contrôle de mes effets.

**Acceptance Criteria:**

**Given** un effet `targets { count: N, min }` (`min = 0` par défaut, `min = N` si la carte dit « exactement »)
**When** je choisis mes cibles
**Then** un compteur « k / N », un bouton « Valider » (actif dès `min`) et « Aucune cible » sont proposés
**And** le moteur ne complète jamais un choix au hasard ; les choix dans le deck acceptent aussi `min..N`

### Story 11.6: Réencoder les capacités des 51 cartes

As a Root,
I want que les cartes suivent le nouveau modèle de capacités,
So that les parties restent équilibrées.

**Acceptance Criteria:**

**Given** le tableau 4.3 de la proposition de changement
**When** les sets sont réencodés
**Then** chaque capacité utilise le bon déclencheur, et les textes adoptent « À l'arrivée : … » / « Attaque : … »
**And** Patsy dit « Tant que Patsy est sur votre table, Arthur a la hâte » ; le bonus de Benson dure jusqu'à la fin du tour ; les Sentinelles sont en usage unique
**And** `cards.test.ts` est à jour et la simulation de 200 parties passe, avec comparaison des durées avant/après

### Story 11.7: Distinguer les catégories de cartes

As a joueur,
I want reconnaître d'un coup d'œil un personnage, un sort, un équipement ou un terrain,
So that je ne confonde pas les cartes en main ou en jeu.

**Acceptance Criteria:**

**Given** une carte de chaque catégorie et de chaque rareté
**When** elle est affichée en main, en socle ou en fiche
**Then** la catégorie se lit au jeton de coût (blason, sceau de cire, écrou d'acier, losange vert, chacun avec son icône) et à la teinte du parchemin, comme sur la maquette D
**And** la rareté se lit à la gemme et aux ornements, comme sur les maquettes E et F : commune nue ; rare avec anneau gravé, équerres et liseré bleu ; épique avec pierre sertie, fleurons et halo violet ; légendaire avec laurier lumineux, filigrane, cadre ardent et reflet
**And** chaque capacité porte son étiquette de déclencheur (« À l'arrivée », « Attaque spéciale », « Passif », « Effet »…)
**And** toutes les catégories ont une rareté : le schéma sépare `rarity` (commune → légendaire) de `category`, les valeurs `spell`/`terrain` de rareté disparaissent, et les 13 sorts, équipements et terrains reçoivent une rareté proposée selon la courbe de coût, listée dans `a-valider-par-root.md`
**And** les ornements sont en SVG/CSS (pas d'images lourdes) ; les animations (laurier, reflet) s'arrêtent avec « réduire les animations »
**And** la différence reste lisible en miniature, en mobile portrait comme sur ordinateur, et la forme du jeton suffit sans les couleurs
**Reference:** `docs/design/card-frames/` (Jetons, Raretes, Ornements)

### Story 11.8: Glossaire et renvois

As a joueur,
I want comprendre un mot-clé ou un renvoi (« voir Au galop ! ») sans quitter la partie,
So that je n'aie rien à retenir de tête.

**Acceptance Criteria:**

**Given** un texte de carte
**When** j'appuie sur un mot-clé, un nom de capacité ou un nom de carte cité
**Then** sa définition s'affiche, ou la carte citée s'ouvre
**And** les textes viennent de `_bmad-output/planning-artifacts/glossaire-mots-cles.md` (validé par Root) ; « Attaque : … » devient « Attaque spéciale : … » dans les cartes, et « Barrage » est un mot-clé
**And** un écran « Règles et mots-clés » est accessible depuis le menu, généré depuis une seule source dans le code

## Epic 12: Retours visuels de chaque action

Demande de Root (2026-11-22, approuvée) : chaque action doit se voir, sur le modèle des principes de mise en scène du genre (référence Hearthstone, sans reprendre ses images ni sa direction artistique). Spécification complète et catalogue action → retour visuel : `retours-visuels-actions.md`. Démo animée validée par Root : `docs/design/animations/demo.html`. À faire juste après l'epic 11, avant les epics 8, 9 et 10.

**Critères communs :**
- 60 images/s sur un téléphone milieu de gamme (transformations CSS et opacité uniquement).
- Une action simple dure moins de 0,8 s.
- Réglage de vitesse (normale, rapide, instantanée).
- Avec « réduire les animations », il ne reste que des fondus.
- Les actions adverses ont la même mise en scène.
- Un test e2e vérifie l'ordre des temps.

### Story 12.1: Couche de présentation
As a joueur, I want que la table rejoue les événements un par un, So that je voie chaque action avant son résultat.
**Acceptance Criteria:** **Given** un lot d'événements **When** il arrive **Then** l'état affiché avance au rythme des temps d'animation (le moteur reste l'arbitre) **And** une carte détruite reste visible pendant son animation de mort **And** je peux agir pendant la lecture (la suite accélère) **And** le réglage de vitesse et « réduire les animations » sont respectés.

### Story 12.2: Attaques et impacts
As a joueur, I want voir l'attaquant foncer sur sa cible, So that une attaque se voie et se sente.
**Acceptance Criteria:** **Given** une attaque **When** elle se joue **Then** l'attaquant se soulève, fonce, percute (éclair, tremblement proportionnel aux dégâts) et revient **And** la riposte est visible **And** l'attaque sur les PV du joueur vise son portrait **And** une attaque spéciale lance un trait vers la cible, sans contact.

### Story 12.3: Dégâts, soins, statuts
As a joueur, I want des chiffres et des effets lisibles sur chaque carte touchée, So that je comprenne ce qui a changé.
**Acceptance Criteria:** **Given** des dégâts, un soin, un bonus, un malus, un bouclier ou un statut **When** ils s'appliquent **Then** chiffre à taille variable, compteur de PV qui défile, flèche de stat, bouclier qui se fissure, effet propre à chaque statut (chaînes pour le silence, bulles pour le poison).

### Story 12.4: Mort et départs
As a joueur, I want voir une carte mourir, So that sa disparition ne passe pas inaperçue.
**Acceptance Criteria:** **Given** une carte détruite **When** elle meurt **Then** elle se fige, se fissure, se consume et ses cendres rejoignent le cimetière **And** « mort évitée » montre une fissure qui se recolle **And** un renvoi en main montre la carte repartir en arc.

### Story 12.5: Poser et piocher
As a joueur, I want voir les cartes voyager, So that je sache qui joue quoi.
**Acceptance Criteria:** **Given** une pose ou une pioche, à moi ou à l'adversaire **When** elle se joue **Then** la carte suit une trajectoire main → socle ou deck → main **And** l'atterrissage est propre à la catégorie : éclat de runes pour un personnage, brûlure et effet pour un sort, onde de famille pour un terrain, éclat métallique pour un équipement **And** l'adversaire voit un dos de carte quand il pioche.

### Story 12.6: Déclencheurs et sorts
As a joueur, I want voir quelle carte déclenche quoi, So that les combos soient lisibles.
**Acceptance Criteria:** **Given** un déclencheur ou un sort **When** il se résout **Then** la source pulse, une étiquette (déclencheur + nom de la capacité) apparaît, puis un trait ou un projectile rejoint la cible **And** les effets d'une chaîne se jouent dans l'ordre.

### Story 12.7: Rythme du tour
As a joueur, I want des repères de tour et de fin de partie, So that le rythme soit clair.
**Acceptance Criteria:** **Given** un changement de tour ou une fin de partie **Then** un bandeau « À vous de jouer » (ou « Tour adverse ») se déroule et mes cartes jouables s'illuminent **And** la victoire brise le portrait adverse, la défaite assombrit la table.

## Epic 13: Retours du playtest 2

Retours de Root (2026-11-22, deuxième session de test). À faire après les stories 12.1 à 12.4, avant 12.5.

### Story 13.1: Aperçu des cartes citées
As a joueur, I want voir un aperçu d'une carte citée dans un texte, So that je comprenne la combinaison sans quitter la partie.
**Constat :** le texte de Patsy (« Tant que Patsy est sur votre table, Arthur a la hâte… ») ne rend cliquable que « Au galop ! ». « Arthur », cité sans guillemets, n'est pas reconnu. Ouvrir une carte remplace en plus la fiche en cours.
**Acceptance Criteria:**
- **Given** un texte de carte qui cite une autre carte, entre guillemets ou par son nom d'usage (« Arthur », « Trinity », « Kevin »…, une table d'alias par carte dans les données)
- **When** je touche ce nom (ou le survole sur ordinateur)
- **Then** un aperçu de la carte citée s'affiche en surimpression : la carte en taille lisible et ses capacités, avec « Voir la fiche » et la fermeture d'un geste
- **And** si la carte citée est en jeu, son socle s'illumine sur la table
- **And** toutes les cartes du MVP qui citent une autre carte sont couvertes par un test (aucun nom cité non reconnu)

### Story 13.2: Table sans défilement vertical sur mobile
As a joueur sur téléphone, I want voir toute la table sans faire défiler, So that je garde l'œil sur la partie.
**Constat :** en portrait (390 × 844), les deux grilles de 10 socles, les rangées terrains et sorts, le bandeau de tour et la main dépassent la hauteur de l'écran.
**Acceptance Criteria:**
- **Given** une partie sur un téléphone en portrait (de 360 × 640 à 430 × 932)
- **When** la table s'affiche, à n'importe quel moment de la partie
- **Then** tout tient dans la hauteur visible (`100dvh`) sans défilement de la page : les deux camps, le bandeau de tour avec le chrono, les PV et pièces, et la main
- **And** la disposition suit la maquette validée par Root
- **And** les cibles tactiles mesurent toujours au moins 44 px, et les cartes restent lisibles (nom, coût, ATQ/PV)
- **And** les tests e2e vérifient l'absence de défilement vertical à 390 × 844 et 360 × 640

### Story 13.3: Origine des bonus et malus sur la carte
As a joueur, I want savoir quelle carte donne un bonus ou un malus, So that je sache quoi cibler pour l'enlever.
**Constat :** la table affiche les valeurs modifiées (badge vert ou rouge), mais pas leur origine. La fiche les liste avec seulement le libellé de l'effet.
**Acceptance Criteria:**
- **Given** une carte modifiée (aura, terrain, bonus temporaire ou permanent, malus)
- **When** je regarde la carte sur la table
- **Then** un petit marqueur sur l'écusson modifié indique qu'il y a une origine à voir (nombre de sources)
- **And** quand je touche la carte, chaque source en jeu est reliée à elle par un trait lumineux, vert pour un bonus et rouge pour un malus
- **And** la fiche liste chaque modificateur avec la miniature et le nom de la carte source, le nom de la capacité, la valeur et la durée restante ; toucher une source ouvre son aperçu (story 13.1)
- **And** une source qui n'est plus en jeu (bonus permanent) est indiquée « carte partie »

## Epic 8: Comptes et amis (post-MVP)

### Story 8.1: Connexion
As a joueur, I want me connecter par e-mail ou Google, So that je retrouve mon profil.
**Acceptance Criteria:** **Given** l'accueil **When** je me connecte **Then** mon pseudo est conservé et une session reste ouverte.

### Story 8.2: Liste d'amis et invitation directe
As a joueur, I want inviter un ami de ma liste, So that je n'aie pas à partager de code.
**Acceptance Criteria:** **Given** un ami en ligne **When** je l'invite **Then** il reçoit l'invitation et rejoint la salle.

### Story 8.3: Historique
As a joueur, I want voir mes dernières parties, So that je suive mes résultats.
**Acceptance Criteria:** **Given** des parties terminées **When** j'ouvre l'historique **Then** adversaire, résultat et date s'affichent.

### Story 8.4: Émotes
As a joueur, I want envoyer des répliques prédéfinies, So that on se chambre sans chat libre.
**Acceptance Criteria:** **Given** une partie **When** je choisis une réplique **Then** l'adversaire la voit 3 s.

## Epic 9: Pipeline de contenu (post-MVP)

### Story 9.1: Import des cartes de Root
As a Root, I want importer mes cartes depuis mon format, So that les ~500 cartes rejoignent le jeu.
**Acceptance Criteria:** **Given** un fichier de Root **When** l'import s'exécute **Then** des sets JSON valides sont générés et les capacités non traduites sont listées.

### Story 9.2: Illustrations
As a Root, I want associer mes images aux cartes, So that chaque carte ait son visuel.
**Acceptance Criteria:** **Given** un dossier d'images **When** je lance l'outil **Then** les images sont optimisées (WebP ≤ 60 Ko) et liées ; à défaut, l'emblème est utilisé.

### Story 9.3: Options de familles
As a joueur, I want choisir les films inclus dans le deck, So that on fasse des parties thématiques.
**Acceptance Criteria:** **Given** la création de salle **When** je coche des familles **Then** le deck ne contient que ces familles.

## Epic 10: Decks construits (post-MVP)

### Story 10.1: Règles de construction
As a Root, I want définir taille et exemplaires autorisés, So that le mode soit équilibré.
**Acceptance Criteria:** **Given** les règles décidées avec Root **When** un deck est validé **Then** les règles sont appliquées.

### Story 10.2: Écran de construction
As a joueur, I want composer mon deck avec des filtres, So that je joue mes cartes préférées.
**Acceptance Criteria:** **Given** toutes les cartes **When** je filtre par film, rareté, coût **Then** j'ajoute/retire des cartes et vois les erreurs de règles.

### Story 10.3: Choisir son deck en salle
As a joueur, I want sélectionner un deck sauvegardé, So that la partie l'utilise.
**Acceptance Criteria:** **Given** un deck sauvegardé **When** je rejoins une salle en mode construit **Then** ma pioche est ce deck.
