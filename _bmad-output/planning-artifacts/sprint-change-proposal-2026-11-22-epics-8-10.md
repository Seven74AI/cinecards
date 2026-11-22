---
title: "Sprint Change Proposal — comptes (epic 8) et decks construits (epic 10)"
project: cinecards
date: 2026-11-22
workflow: gds-correct-course
mode: batch
status: approuvé (Root, 2026-11-22)
scope: modéré
---

# Sprint Change Proposal — comptes (epic 8) et decks construits (epic 10)

## 1. Résumé

**Déclencheur :** décision de Root du 2026-11-22, après la clôture de l'epic 13 et la validation de tout
`a-valider-par-root.md` : faire maintenant les epics post-MVP 8 (comptes et amis) puis 10 (decks construits),
avant l'epic 9.

**Type :** nouvelle exigence et précision d'exigences (pas de bug).

**Décisions de Root :**
1. **Connexion (8.1)** : pas d'e-mail ni de Google pour l'instant. Deux façons de se connecter, au choix du joueur :
   une **clé d'accès** (passkey : Face ID, empreinte, code du téléphone) avec un **code de secours** à imprimer, et
   un **pseudo + mot de passe**.
2. **Decks construits (10.1)** : un deck compte **exactement 50 cartes** (ni moins, ni plus), **un seul exemplaire
   de chaque carte**.
3. **Ordre** : epic 8, puis epic 10, puis epic 9.

**Constat technique :** l'architecture prévoyait `@colyseus/database` sur SQLite. Vérifié sur npm le 2026-11-22 :
`@colyseus/database` 0.18 vise Postgres / PGlite (dépendances `postgres`, `@electric-sql/pglite`, `drizzle-orm`
en RC) et s'appuie sur `@colyseus/auth` (e-mail, OAuth), justement écartés par Root. Le module SQLite intégré à
Node (`node:sqlite`, Node 24 dans l'image Docker) suffit pour ce volume (quelques amis) sans service de plus.

## 2. Analyse d'impact

### Epics
| Epic | Impact |
|---|---|
| 8 Comptes et amis | Story 8.1 réécrite et scindée en deux (mot de passe, puis clé d'accès et code de secours) : 5 stories au lieu de 4. |
| 10 Decks construits | Règles fixées (50 exactement, cartes uniques) ; les decks sont enregistrés sur le compte, donc après l'epic 8. |
| 9 Pipeline de contenu | Repoussé après 10. Inchangé. |
| 1-7, 11-13 | Aucun changement. Les parties sans compte (invité) restent possibles partout. |

**Limite connue :** le jeu a 51 cartes jouables. Un deck de 50 cartes uniques est donc « toutes les cartes sauf
une » tant que l'epic 9 n'a pas importé les ~500 cartes de Root. Le mode est prêt pour ce moment-là.

### Artefacts
- **GDD** : modes de deck (règles de construction), modes de jeu (comptes), hors périmètre, index des hypothèses.
- **epics.md** : epics 8 et 10 réécrits, liste des epics, ordre.
- **Architecture** : persistance (`node:sqlite` au lieu de `@colyseus/database`), authentification, API HTTP,
  nouvelle salle `hub` (présence et invitations), ADR-008.
- **sprint-status.yaml** : clés des stories 8.x renumérotées (toutes en backlog, aucune perte).
- **Déploiement** : un volume Docker pour la base (`/app/data`), sinon elle serait effacée à chaque reconstruction.
- **UX** : écrans Compte, Amis, Historique, Decks ; maquette d'abord pour l'écran de construction (règle « maquette
  d'abord » des changements visuels).

### Impact technique
- Serveur : base SQLite, routes HTTP `/api/*` (CORS pour `seven74ai.github.io`), jeton de session.
- Client : session de compte, écrans, envoi du jeton à la salle.
- Moteur : un mode de deck `constructed` (une pioche de 50 cartes par joueur, choisie par lui).
- **Compatibilité d'une version** (AGENTS.md) : le nouveau serveur accepte les clients sans compte ; le nouveau
  client masque les fonctions de compte si le serveur ne répond pas à `/api/health`.

## 3. Approche recommandée

**Ajustement direct** dans le plan existant : réécriture des epics 8 et 10, sans retour en arrière.

- **Effort :** 8 stories (5 pour l'epic 8, 3 pour l'epic 10).
- **Risques :**
  - Les clés d'accès sont liées au domaine du site (`seven74ai.github.io`). Si le site change de domaine, elles ne
    marchent plus ; le code de secours ou le mot de passe restent alors la porte de sortie.
  - Une base perdue = comptes perdus. D'où le volume Docker et une copie de sauvegarde quotidienne sur le VPS.
- **Calendrier :** l'epic 9 attend la fin de l'epic 10.

## 4. Propositions de modification détaillées

### 4.1 Stories (epics.md)

**Epic 8 — ANCIEN :** 8.1 Connexion (e-mail ou Google) · 8.2 Liste d'amis et invitation directe · 8.3 Historique ·
8.4 Émotes.

**Epic 8 — NOUVEAU :**

**Story 8.1 : Compte avec pseudo et mot de passe**
As a joueur, I want créer un compte avec un pseudo et un mot de passe, So that je retrouve mon profil sur n'importe
quel appareil.
**Acceptance Criteria :**
- **Given** l'accueil **When** je crée un compte (pseudo unique, mot de passe) **Then** je suis connecté, mon pseudo
  remplit les salles et un **code de secours** s'affiche une fois (à imprimer ou copier).
- **Given** un compte **When** je me connecte sur un autre appareil **Then** la session reste ouverte (90 jours sans
  activité au plus) jusqu'à « Se déconnecter ».
- **Given** un code de secours **When** je l'utilise **Then** je choisis un nouveau mot de passe et un nouveau code
  remplace l'ancien.
- **Given** pas de compte **When** je joue **Then** tout marche comme avant (invité).
- Socle technique : base SQLite sur le serveur, volume Docker, sauvegarde quotidienne, routes `/api/*`.

**Story 8.2 : Clé d'accès et code de secours**
As a joueur, I want me connecter avec Face ID ou mon empreinte, So that je n'aie pas de mot de passe à retenir.
**Acceptance Criteria :**
- **Given** l'accueil **When** je crée un compte avec une clé d'accès **Then** mon appareil enregistre la clé et un
  code de secours s'affiche une fois.
- **Given** un compte (mot de passe ou clé) **When** j'ajoute une clé d'accès depuis « Mon compte » **Then** je peux
  me connecter avec elle ; je peux en avoir plusieurs (téléphone, ordinateur) et en retirer.
- **Given** une clé perdue **When** j'utilise mon code de secours **Then** je peux ajouter une nouvelle clé ou choisir
  un mot de passe, et un nouveau code remplace l'ancien.

**Story 8.3 : Liste d'amis et invitation directe** (ancienne 8.2)
As a joueur, I want inviter un ami de ma liste, So that je n'aie pas à partager de code.
**Acceptance Criteria :**
- **Given** le pseudo d'un joueur **When** je lui envoie une demande et qu'il l'accepte **Then** nous sommes amis
  (je peux refuser ou retirer un ami).
- **Given** un ami en ligne (point vert) **When** je l'invite **Then** il reçoit l'invitation en direct et rejoint ma
  salle d'un appui.

**Story 8.4 : Historique** (ancienne 8.3, inchangée sur le fond)
**Acceptance Criteria :** **Given** des parties en ligne terminées **When** j'ouvre l'historique **Then** adversaire,
résultat (victoire, défaite, nulle, abandon), mode et date des 20 dernières s'affichent, avec mon bilan.

**Story 8.5 : Émotes** (ancienne 8.4, inchangée sur le fond)
**Acceptance Criteria :** **Given** une partie en ligne **When** je choisis une réplique prédéfinie **Then**
l'adversaire la voit 3 s ; une réplique toutes les 3 s au plus ; je peux couper les répliques adverses.

**Epic 10 — ANCIEN 10.1 :** « Given les règles décidées avec Root When un deck est validé Then les règles sont
appliquées. »

**Epic 10 — NOUVEAU :**

**Story 10.1 : Règles de construction**
As a Root, I want que chaque deck compte exactement 50 cartes uniques, So that le mode soit équilibré.
**Acceptance Criteria :** **Given** un deck **When** il est validé (client et serveur) **Then** il est refusé s'il
n'a pas exactement 50 cartes, s'il contient deux fois la même carte, ou une carte inconnue ou non jouable ; chaque
erreur est dite en français. Le moteur sait jouer une partie où chaque joueur pioche dans son propre deck.

**Story 10.2 : Écran de construction** (inchangée sur le fond, précisée)
**Acceptance Criteria :** **Given** toutes les cartes **When** je filtre par film, catégorie, rareté, coût **Then**
j'ajoute ou retire des cartes, je vois le compteur « N / 50 » et les erreurs ; je nomme, enregistre, copie et
supprime mes decks (enregistrés sur mon compte). Maquette d'abord.

**Story 10.3 : Choisir son deck en salle** (inchangée sur le fond, précisée)
**Acceptance Criteria :** **Given** un deck valide enregistré **When** je crée ou rejoins une salle en mode « Decks
construits » **Then** je choisis mon deck et ma pioche est ce deck ; contre le Grimoire, il joue un deck de 50
cartes tirées au hasard.

### 4.2 GDD

**Deck Building — ANCIEN :** « Decks personnels construits | Chaque joueur compose son deck à partir de toutes les
cartes | Post-MVP (après comptes et import des ~500 cartes) » et « Règles de construction (taille, exemplaires) à
définir avec Root pour le mode construit. »

**NOUVEAU :** « Decks personnels construits | Chaque joueur compose son deck à partir de toutes les cartes jouables :
**exactement 50 cartes, un seul exemplaire de chaque** (règle de Root du 2026-11-22) | Post-MVP (epic 10, après les
comptes) ». Hypothèses :
- `[ASSUMPTION]` Il faut un compte pour enregistrer un deck.
- `[ASSUMPTION]` Le mode construit se joue en ligne et contre le Grimoire, qui reçoit 50 cartes au hasard. Pas en hot
  seat.
- `[ASSUMPTION]` Une pioche vide se reforme à partir du cimetière de son propriétaire, comme pour les decks personnels
  aléatoires.

**Game Modes — ANCIEN :** « Post-MVP : comptes (e-mail ou Google), liste d'amis… »
**NOUVEAU :** « Post-MVP : comptes (clé d'accès avec code de secours, ou pseudo et mot de passe ; pas d'e-mail ni
de Google pour l'instant), liste d'amis, invitation directe, historique des parties, émotes. Jouer sans compte
(invité) reste possible. »

Hypothèses de l'epic 8 (`[ASSUMPTION]`, listées dans `a-valider-par-root.md`) :
- Pseudo : 3 à 16 caractères (lettres, chiffres, espace, `-`, `_`), unique sans tenir compte des majuscules.
- Mot de passe : 8 caractères au moins. Au plus 10 essais ratés par quart d'heure et par pseudo.
- Session : 90 jours sans activité au plus, sur l'appareil.
- Code de secours : un seul code par compte, montré une fois à la création, remplacé à chaque usage.
- Historique : les parties **en ligne** seulement (le serveur en est l'arbitre), 20 dernières affichées.
- Émotes : 8 répliques écrites (pas d'extraits de films).

### 4.3 Architecture

- **Decision Summary, Persistence (post-MVP) — ANCIEN :** `@colyseus/database` on SQLite.
  **NOUVEAU :** `node:sqlite` (built into Node 24), one file at `DATA_DIR/cinecards.db` on a Docker volume, small
  repository module in `apps/server/src/db`, schema migrations by version number, daily copy on the VPS.
- **New: Authentication.** Passwords hashed with `node:crypto` scrypt (random salt). Passkeys through WebAuthn
  (`@simplewebauthn/server` and `@simplewebauthn/browser`), relying party = the client's host
  (`seven74ai.github.io`, `localhost` in dev). Opaque session token (random, stored hashed), sent as
  `Authorization: Bearer` to `/api/*` and in the room join options. No cookies: client and server are on different
  sites, and Safari blocks third-party cookies.
- **New: HTTP API** on the same server and port (`/api/...`), CORS limited to the client origin.
- **New: `hub` room** for logged-in players: presence of friends, real-time invitations.
- **ADR-008** `node:sqlite` rather than `@colyseus/database` (which targets Postgres and brings e-mail/OAuth auth)
  or an external database: no extra service on the VPS, fits a group of friends.
- **Epic mapping:** E6 Accounts → `apps/server/src/{db,auth,api}`, `apps/client/src/account` ; E8 Decks →
  `packages/cards` (rules), `packages/engine` (mode `constructed`), server database, client deck builder.

### 4.4 Déploiement
`deploy/docker-compose.yml` : volume `cinecards-data:/app/data` et `DATA_DIR=/app/data`. `docs/deploy.md` : où est
la base et comment la sauvegarder.

## 5. Passage à l'implémentation

**Portée : modérée.** Réorganisation du backlog et mise à jour des documents (ce workflow), puis implémentation par
l'agent dev, une story à la fois, dans l'ordre 8.1 → 8.5 → 10.1 → 10.3 (`gds-create-story` puis `gds-dev-story`).

**Critères de réussite :**
- Chaque story : `pnpm typecheck`, `pnpm test`, `pnpm e2e` au vert (plus la simulation de 200 parties pour 10.1 et
  10.3) ; poussée sur `main`, Pages relancé, serveur déployé.
- Un invité joue comme avant à chaque étape.
- Les comptes survivent à un redéploiement du serveur.
