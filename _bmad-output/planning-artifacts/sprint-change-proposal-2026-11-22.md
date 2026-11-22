---
title: "Sprint Change Proposal — retours du premier playtest"
project: cinecards
date: 2026-11-22
workflow: gds-correct-course
mode: batch
status: en attente d'approbation
scope: modéré
---

# Sprint Change Proposal — retours du premier playtest

## 1. Résumé du problème

**Déclencheur :** premier playtest de Root sur la version déployée (client GitHub Pages, serveur `wss://cinecards.sevend.io`), après la clôture des epics 1 à 7.

**Types de problème :**
- **Malentendu sur les exigences** (correction de Root) : le modèle des capacités est faux. Les capacités ne sont pas des actions réutilisables chaque tour.
- **Bugs** : le solo bloque, pas de chrono, la reconnexion échoue, impossible de choisir moins de N cibles.
- **Lisibilité** : on distingue mal les sorts des personnages ; les renvois de texte (« voir Au galop ! ») mènent nulle part.

**Constats et causes (vérifiés dans le code) :**

| # | Constat de Root | Cause | Nature |
|---|---|---|---|
| 1 | Une carte peut piocher 3 cartes à chaque tour | `play/abilities.ts:11-31` : une active est réutilisable **une fois par tour** (remise à zéro à `turn/turn.ts:22`). Le GDD disait « une fois par carte posée », ce qui reste un modèle hybride. Elle ne coûte rien et ne consomme pas l'attaque. Les `modify` sans durée sont permanents, donc les bonus s'empilent chaque tour. | Modèle de règles |
| 2 | Solo : le Grimoire reste bloqué | `apps/client/src/game/session.ts:54-89` : `scheduleBot()` n'est appelé que dans `commit()`. Si le tirage au sort désigne le bot comme premier joueur, il ne joue jamais (reproduit : 161 parties bloquées sur 300 graines). | Bug |
| 3 | Aucun chrono, dans aucun mode | Le chrono n'existe que côté serveur (`apps/server/src/duel.ts:106-137`). Le solo et le hot seat fixent `turnEndsAt: null` (`session.ts:59`). En ligne, l'affichage compare une heure absolue du serveur à l'horloge du téléphone, donc un décalage d'horloge le fausse ou le masque. | Bug + manque |
| 4 | Patsy « peut attaquer dès son arrivée », mais rien ne se passe ; « voir Au galop ! » ne mène à rien | La hâte appartient à **Arthur** (« Au galop ! », `holy-grail.json:17-29`), sous condition que Patsy soit en jeu. La capacité de Patsy n'est qu'un rappel (`op: none`), et sa formulation fait croire que c'est Patsy qui attaque. Il n'existe aucun glossaire ni lien vers une capacité citée. | Texte + manque |
| 5 | On distingue mal les capacités et les personnages | `ui/CardView.tsx` : un seul cadre pour toutes les catégories. Seule la couleur de rareté change, et la face de la carte n'indique pas sa catégorie. | Manque UX |
| 6 | Tank « choisit 3 cartes » : on doit pouvoir en choisir 0 à 3 | Moteur : en dessous de N cibles, il complète au hasard, sauf avec `optional` (jamais utilisé). Client (`Table.tsx:144-173`) : la sélection n'est envoyée qu'à N cibles, et il n'y a pas de bouton « Valider ». | Bug + règle |
| 7 | Après avoir quitté, impossible de revenir avec le code | La salle est verrouillée (`room.ts:95`) et le siège réservé (`allowReconnection`). Saisir le code appelle toujours `joinById` (`online.ts:68`), jamais la reconnexion. Le jeton de reconnexion est en `sessionStorage` (perdu dans un nouvel onglet ou sur un autre appareil) et effacé à la sortie. « Quitter » appelle `leave(true)`, ce qui **abandonne** la partie. Toutes les erreurs affichent « n'existe pas ou est complète ». | Bug + UX |

**Décisions de Root (2026-11-22) :**
- revue des modifications par lot ;
- les capacités puissantes répétables deviennent des effets **à l'arrivée** par défaut ;
- le mode solo contre le Grimoire devient un **mode officiel** ;
- le chrono de 75 s s'applique **en ligne, en solo et en hot seat**.

## 2. Analyse d'impact

### Checklist

| Item | Statut | Note |
|---|---|---|
| 1.1 Story déclencheuse | [x] | Playtest après la clôture des epics 3 (effets), 4 (cartes), 5 (table, hot seat, bot) et 6 (en ligne) |
| 1.2 Problème | [x] | Malentendu sur les règles (capacités) et bugs d'implémentation |
| 1.3 Preuves | [x] | Retours de Root, reproduction du blocage du bot, références de code ci-dessus |
| 2.1 Epics concernés | [!] | Epics 3, 4, 5 et 6 terminés mais à reprendre partiellement |
| 2.2 Changement d'epic | [!] | Nouvel epic 11 « Corrections du playtest 1 » plutôt que rouvrir les epics terminés |
| 2.3 Epics futurs | [x] | Epic 9 (import des ~500 cartes) **dépend** du nouveau vocabulaire de déclencheurs : à faire avant lui |
| 2.4 Epic obsolète ou manquant | [x] | Aucun obsolète. L'epic 11 couvre le manque |
| 2.5 Ordre | [!] | Epic 11 en priorité, avant les epics 8, 9 et 10 |
| 3.1 GDD | [!] | Capacités, mots-clés, chrono, modes de jeu, hors périmètre, choix de cibles |
| 3.2 Architecture | [!] | P1 (déclencheurs), décision Timers (le client gère le chrono hors ligne), reconnexion |
| 3.3 UX | [!] | Cadres par catégorie, glossaire, bouton « Valider », écran de reprise, sortie et abandon |
| 3.4 Autres artefacts | [!] | `content/sets/*.json`, `support.ts`, tests de cartes, simulation des 200 parties, e2e en ligne |
| 4.1 Ajustement direct | Viable | Effort moyen, risque faible à moyen |
| 4.2 Retour arrière | Non viable | Rien à annuler : le socle d'effets est bon, seuls les déclencheurs et les données changent |
| 4.3 Revue du MVP | Non nécessaire | Le MVP s'élargit seulement du mode solo, qui existe déjà |

### Impact par artefact

- **GDD** : sections Capacités, Mots-clés et déclenchements, Turn Structure (chrono), Game Modes, Out of Scope, Difficulty Curve, Points tranchés.
- **Architecture** : P1 (liste des déclencheurs), Timers, Error Handling (reconnexion).
- **Epics** : FR10, FR17, nouvel epic 11. Pas de réécriture des stories terminées.
- **Code** : moteur (`play/abilities.ts`, `effects/targets.ts`, `turn/turn.ts`, déclencheurs), schéma (`packages/cards/src/schema.ts`), contenu (31 capacités actives ou à choix à revoir), client (`session.ts`, `Table.tsx`, `CardView.tsx`, `CardSheet.tsx`, `online.ts`), serveur (`room.ts`).

## 3. Approche recommandée

**Ajustement direct** : un nouvel epic 11, avec 8 stories et des corrections ciblées. La chaîne de résolution, le ciblage, les statuts et le réseau restent en place. On change le **modèle de déclenchement** et les **données de cartes**, puis on corrige les bugs.

- **Effort :** moyen (environ 8 stories, dont 2 de taille moyenne : 11.3 et 11.4).
- **Risque :** moyen sur l'équilibrage (les cartes changent beaucoup) ; faible ailleurs. La simulation des 200 parties sert de filet.
- **Ordre :** d'abord les bloquants (11.1 solo, 11.2 reconnexion, 11.3 chrono), puis le modèle de capacités (11.4, 11.5, 11.6), puis la lisibilité (11.7, 11.8).

## 4. Propositions détaillées

### 4.1 GDD

**Section « Capacités »**

ANCIEN :
> - **Une capacité active s'utilise une seule fois par carte posée**, au moment choisi par son propriétaire pendant son tour (y compris le tour où la carte est posée). Si la carte quitte la table puis est rejouée, ses capacités redeviennent disponibles. Une mention explicite (« à chaque tour », « tous les 2 tours ») prime sur cette règle.
> - L'attaque normale d'un personnage reste disponible à chaque tour.

NOUVEAU :
> Une capacité appartient à l'une de trois familles :
> 1. **Effet déclenché** (la majorité) : il s'exécute automatiquement quand un événement se produit. Exemples : à l'arrivée de la carte, quand vous posez une autre carte, à la mort, au début ou à la fin de votre tour. Le joueur fait ses choix (cibles, options) au moment du déclenchement. Un effet à l'arrivée se déclenche à chaque pose de la carte ; si elle revient en main puis est reposée, il se déclenche de nouveau.
> 2. **Capacité d'attaque** (active) : le personnage l'utilise **à la place de son attaque normale**, une fois par tour, avec les mêmes conditions que l'attaque (pas le tour de sa pose, sauf hâte). Elle est faite pour des effets modestes et répétables.
> 3. **Passif** : toujours actif tant que la carte est en jeu et non réduite au silence.
>
> Une mention explicite prime : « tous les N tours », « usage unique ».
> Règle d'équilibrage : un effet utilisable à chaque tour ne pioche pas plus d'une carte, ne donne pas de bonus permanent cumulable à plusieurs cartes et ne contrôle pas plusieurs cartes adverses.
> Raison : la pioche (Epok, Le maître des clés), la récupération (Smith) et les bonus de masse (Le Mulo, Epok) deviendraient sinon des moteurs incontrôlables (constaté au playtest 1).

**Section « Mots-clés et déclenchements » : lignes modifiées et ajoutées**

| Mot-clé | Ancien | Nouveau |
|---|---|---|
| Active | Utilisable une fois par carte posée, pendant votre tour | **Capacité d'attaque** : remplace l'attaque normale du personnage, une fois par tour |
| À l'arrivée | Se déclenche une fois quand la carte est posée | Inchangé ; c'est le déclencheur par défaut des effets puissants |
| *(nouveau)* Quand vous posez une carte | — | Se déclenche quand son propriétaire pose une autre carte (filtre possible : famille, catégorie) |
| *(nouveau)* Quand l'adversaire pose une carte | — | Idem, pour une carte posée par l'adversaire |
| *(nouveau)* Début / fin de votre tour | Implicite | Déclencheurs explicites ; la fin de tour est ajoutée au moteur |
| *(nouveau)* Quand il attaque, est attaqué, détruit une carte | Implicite dans le moteur | Déclencheurs nommés dans le vocabulaire |
| *(nouveau)* Hâte | — | Peut attaquer le tour où il est posé |
| *(nouveau)* Jusqu'à N | — | Choisir de 0 à N cibles ; c'est la lecture par défaut de « choisissez N ». Seul « exactement N » impose le nombre |

Ajout : *Le vocabulaire des déclencheurs est extensible : un nouvel événement s'ajoute au moteur sans toucher aux cartes existantes.*

**Section « Turn Structure » : chrono**

ANCIEN : « Chrono : 75 secondes par tour… »
NOUVEAU : « Chrono : 75 secondes par tour **dans tous les modes (en ligne, solo, hot seat)**, toujours visible (sablier et secondes). À 0, les choix en attente sont résolus par défaut (aucune cible pour « jusqu'à N »), puis le tour se termine. En hot seat, le chrono démarre quand le joueur lève l'écran de passage. En solo, le Grimoire joue en quelques secondes. »

**Section « Game Modes » et « Out of Scope »**

ANCIEN : « Hors périmètre : classé, draft, campagne, IA… » et « Jamais : … IA … »
NOUVEAU : ajout au MVP de **« Solo contre le Grimoire » : un adversaire automatique qui joue des coups légaux, pour s'entraîner** ; retrait de « IA » des listes hors périmètre. Une IA stratégique reste hors périmètre. Hot seat ajouté au MVP (il existe déjà).

**Section « Points tranchés par Root »**

Ajout : « 5. Capacités (révisé au playtest 1, 2026-11-22) : effets déclenchés par défaut, capacités d'attaque à la place de l'attaque, choix de 0 à N cibles par défaut. Remplace le point 3. »

### 4.2 Architecture (`_bmad-output/game-architecture.md`)

- **P1 — Triggers** : `active`, `passive`, `onPlay`, `onDeath`, … deviennent `onPlay`, `onAllyPlayed(filter)`, `onEnemyPlayed(filter)`, `onDeath`, `startOfTurn`, `endOfTurn`, `onAttack`, `onAttacked`, `onKill`, `reaction`, `attackAbility` (remplace l'attaque, `usedAttack` partagé), `passive`, `cycle(n)`. Les modificateurs `oncePerGame` et `cooldown` sont conservés. Un **registre d'événements** relie chaque événement moteur aux capacités abonnées.
- **Cibles** : `targets: { count, min = 0 }` (`min = count` pour « exactement N »). Le moteur ne complète plus jamais au hasard une sélection incomplète.
- **Timers** : le moteur porte la durée du tour (`rules.ts`). Le serveur reste maître en ligne ; en solo et en hot seat, la session locale arme le même chrono. Le serveur envoie le **temps restant en ms**, pas une heure absolue.
- **Reconnexion** : jeton de siège conservé en `localStorage`, indexé par code de salle. Rejoindre par code avec un jeton valide reprend le siège. « Quitter » est une déconnexion qui laisse 90 s pour revenir ; seul « Abandonner » met fin à la partie. Une salle d'attente ne disparaît pas au premier départ : elle expire après 10 minutes (cf. story 6.2).

### 4.3 Données de cartes : capacités de personnage à reclasser

Les sorts instantanés sont déjà résolus une seule fois : ils ne changent pas.

| Carte | Capacité (texte actuel) | Proposé |
|---|---|---|
| Le maître des clés | Regarde 6 cartes de votre deck, en choisit 3 | **À l'arrivée**, choisissez **jusqu'à 3** |
| Epok | Piochez 3 cartes | **À l'arrivée** |
| Epok | Matrix +30 ATQ / +50 PV | **À l'arrivée** (cartes en jeu à ce moment) |
| Le Mulo | Matrix +40 ATQ / +50 PV | **À l'arrivée** |
| Le Mulo | Femme en robe rouge : chaque ennemi attaque ses voisins | **Capacité d'attaque, tous les 2 tours** |
| Smith | Absorbe 50 % de PV/ATQ de toutes les cartes | **À l'arrivée** |
| Smith | Récupère jusqu'à 15 cartes du cimetière | **À l'arrivée**, jusqu'à 15 au choix |
| Tank | Choisit 3 cartes et les renvoie en main | **À l'arrivée**, **jusqu'à 3** (0 possible) |
| L'ange sans ailes (choix) | 3 cartes du deck adverse OU 1 carte gratuite | **À l'arrivée**, choix exclusif |
| Switch | Bouclier 40 à toutes vos cartes | **À l'arrivée** |
| Dozer | Guérit toutes vos cartes | **À l'arrivée** |
| Trinity | 2 attaques pendant 2 tours + dé | **À l'arrivée** |
| Néo | Fait venir Trinity | **À l'arrivée** |
| Cypher | Vos cartes copient ses PV/ATQ | **À l'arrivée** (valeurs du moment) |
| Sentinelles | Absorbe l'ATQ de vos cartes 1 tour (usage unique) | **Capacité d'attaque, usage unique** (bug : `oncePerGame` manquait) |
| Kevin Copeland | Retire tous les effets d'une carte (une fois par partie) | Inchangé, devient capacité d'attaque |
| Heather et Megan Vandergeld | Un ennemi perd 30 ATQ jusqu'à la fin de la partie | **Capacité d'attaque**, chaque tour |
| Les Chevaliers qui disent « Ni ! » | Silence un ennemi 1 tour | **Capacité d'attaque**, chaque tour |
| Topper Harley | Tous les 2 tours : attaque une carte protégée, sans riposte | Inchangé (déjà une attaque, tous les 2 tours) |
| Ramada Thompson | Topper +40/+40 jusqu'à la fin du tour | **Capacité d'attaque**, chaque tour |

Passifs à surveiller : **Amiral Benson** (+20 ATQ à vos Hot Shots! à chaque début de tour, sans durée : cumul permanent). Proposé : bonus **jusqu'à la fin du tour**.

**Patsy, capacité « Clip-clop »**
ANCIEN : « Arthur peut attaquer dès son arrivée (voir « Au galop ! ») »
NOUVEAU : « Tant que Patsy est sur votre table, **Arthur** a la hâte. » Le nom « Au galop ! » devient un lien qui ouvre la carte d'Arthur.

### 4.4 UX

- **Cadres par catégorie** : un cadre distinct pour personnage, sort (instantané ou persistant), équipement et terrain, avec un ruban de type sur la face (« Sort », « Terrain »…). Les sorts n'ont ni écusson ATQ ni écusson PV. La différence doit rester lisible en miniature dans la main.
- **Icône de déclencheur** devant chaque capacité (arrivée, attaque, passif, mort, réaction…), avec sa définition en un appui.
- **Glossaire** : appui sur un mot-clé (hâte, silence, bouclier, poison…) → bulle de définition ; appui sur un nom de capacité ou de carte cité (« Au galop ! », « Trinity ») → ouvre la carte. Un écran « Règles et mots-clés » est accessible depuis le menu.
- **Choix « jusqu'à N »** : compteur « 2 / 3 », bouton « Valider » actif dès le minimum atteint (0 par défaut), bouton « Aucune cible ».
- **Chrono** : sablier et secondes sur le bandeau de tour, alerte visuelle et sonore à 10 s, dans tous les modes.
- **En ligne** : « Quitter » affiche « Vous pourrez revenir pendant 90 s avec le code » ; un bouton « Abandonner » distinct demande confirmation. Les erreurs sont distinctes : salle introuvable, salle complète, partie en cours (« reprendre ? »).

### 4.5 Epics : nouvel epic 11 « Corrections du playtest 1 »

Dans `epics.md`, FR10 et FR17 sont réécrits selon 4.1. FR ajoutés : **FR24** (solo contre le Grimoire), **FR25** (glossaire et renvois), **FR26** (choix de 0 à N).

**Story 11.1 : Débloquer le solo quand le Grimoire commence**
- **Given** une partie solo dont le premier joueur tiré au sort est le Grimoire, **When** la partie démarre, **Then** le Grimoire joue son tour et passe la main.
- Test de non-régression sur 300 graines : aucune partie bloquée.

**Story 11.2 : Revenir dans une partie en ligne**
- **Given** un joueur (hôte ou invité) qui a quitté ou perdu la connexion il y a moins de 90 s, **When** il saisit le code ou rouvre le lien, même dans un nouvel onglet, **Then** il retrouve son siège et la partie à l'identique.
- « Quitter » n'abandonne plus la partie. « Abandonner » demande confirmation.
- Une salle d'attente survit au départ de l'hôte pendant 10 min.
- Messages d'erreur distincts selon le cas.
- Le test e2e couvre : hôte qui part et revient, invité qui part et revient, nouvel onglet.

**Story 11.3 : Chrono dans tous les modes**
- **Given** une partie en ligne, solo ou hot seat, **Then** le sablier et les secondes restantes sont visibles. À 0, les choix en attente sont résolus par défaut, puis le tour se termine.
- En hot seat, le chrono démarre à la levée de l'écran de passage.
- En ligne, l'affichage est correct malgré un décalage d'horloge de ±2 min (temps restant envoyé par le serveur).

**Story 11.4 : Modèle de capacités : déclencheurs et capacités d'attaque**
- Le schéma de cartes adopte les familles de capacités et les déclencheurs de 4.2. `support.ts` refuse tout déclencheur inconnu.
- Une capacité d'attaque consomme l'attaque du tour et suit l'éligibilité de l'attaque (hâte comprise).
- `endOfTurn`, `onAllyPlayed` et `onEnemyPlayed` sont implémentés et testés.
- Le journal indique le déclencheur (« À l'arrivée d'Epok : … »).

**Story 11.5 : Choisir de 0 à N cibles**
- Les cibles et choix dans le deck acceptent `min..count`, avec `min = 0` par défaut.
- Le moteur ne complète plus jamais au hasard.
- Le client affiche un compteur, un bouton « Valider » et « Aucune cible ».

**Story 11.6 : Réencoder les capacités des 51 cartes**
- Le contenu applique le tableau 4.3, y compris le texte de Patsy, Benson borné au tour et les Sentinelles en usage unique.
- Les textes de cartes utilisent le nouveau vocabulaire (« À l'arrivée : … », « Attaque : … »).
- `cards.test.ts` est mis à jour.
- La simulation des 200 parties est relancée, et son rapport compare la durée moyenne des parties avant et après.

**Story 11.7 : Distinguer les catégories de cartes**
- Cadres et rubans par catégorie, icônes de déclencheur.
- Test visuel en main, en socle et en fiche, sur mobile portrait et sur ordinateur.

**Story 11.8 : Glossaire et renvois**
- Appui sur un mot-clé : définition. Appui sur un nom de carte ou de capacité cité : ouverture de la carte.
- Écran « Règles et mots-clés » généré depuis le vocabulaire du GDD (une seule source dans le code).

**Ordre :** 11.1 → 11.2 → 11.3 → 11.4 → 11.5 → 11.6 → 11.7 → 11.8. L'epic 11 passe avant les epics 8, 9 et 10. L'epic 9 (import des ~500 cartes) dépend de 11.4.

## 5. Passage à l'implémentation

- **Portée : modérée.** Pas de refonte de l'architecture : nouvel epic et mise à jour des documents.
- **Responsables :**
  - Développeur (agent Game Dev) : stories 11.1 à 11.8.
  - Rédaction des documents (GDD, architecture, epics, `sprint-status.yaml`) : faite dans le cadre de ce workflow, après approbation.
  - Root : valide les nouveaux textes des cartes (tableau 4.3), puis refait un playtest.
- **Critères de réussite :**
  - 0 partie solo bloquée sur 300 graines.
  - Chrono visible dans les 3 modes.
  - Reconnexion par code réussie pour l'hôte et l'invité, dans un nouvel onglet.
  - Aucune capacité ne pioche plus d'une carte par tour.
  - « Jusqu'à N » accepte 0.
  - Tous les tests verts, simulation 200/200 parties terminées.
  - Playtest 2 de Root sans « dispute de règles ».
- **Déploiement :** après chaque push sur `main`, lancer le workflow Pages à la main (les déclenchements automatiques de GitHub Actions ne marchent pas pour le moment).
