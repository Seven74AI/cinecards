---
baseline_commit: 78525c023a64a64bc33e0940b1e63fdf7a749931
---

# Story 8.1: Compte avec pseudo et mot de passe

Status: review

## Story

As a joueur,
I want créer un compte avec un pseudo et un mot de passe,
so that je retrouve mon profil sur n'importe quel appareil.

## Acceptance Criteria

1. **Création.** **Given** l'accueil, onglet « En ligne » **When** j'ouvre « Créer un compte » et saisis un pseudo
   libre et un mot de passe **Then** le compte est créé, je suis connecté, et un **code de secours** s'affiche
   **une seule fois**, avec « Copier », « Imprimer » et une case « J'ai noté mon code » à cocher pour continuer.
2. **Règles.** Pseudo de 3 à 16 caractères (lettres, accents compris, chiffres, espace, `-`, `_`), espaces de
   début et de fin retirés, unique **sans tenir compte des majuscules ni des accents composés** (NFC).
   Mot de passe de 8 caractères au moins (128 au plus). Chaque refus est dit en français, sous le champ concerné :
   « Ce pseudo est déjà pris. », « 3 à 16 caractères : lettres, chiffres, espace, - et _. »,
   « 8 caractères au moins. ».
3. **Connexion.** **Given** un compte **When** je me connecte avec mon pseudo (majuscules indifférentes) et mon mot de
   passe, sur cet appareil ou un autre **Then** je suis connecté. Un mauvais couple donne toujours le même message
   (« Pseudo ou mot de passe incorrect. ») sans dire lequel est faux. Après **10 essais ratés en 15 min** sur un
   pseudo, les essais suivants sont refusés jusqu'à la fin de la fenêtre (« Trop d'essais. Réessaie dans N min. »).
4. **Session.** La session reste ouverte sur l'appareil (rechargement, nouvel onglet, fermeture du navigateur) tant
   qu'elle sert au moins une fois tous les **90 jours** ; « Se déconnecter » la ferme sur cet appareil (le jeton est
   effacé côté serveur et côté client). Un jeton expiré ou inconnu ramène à l'état « invité » sans erreur bloquante.
5. **Pseudo dans les salles.** **Given** je suis connecté **When** je crée ou rejoins une salle **Then** mon pseudo de
   compte est utilisé (le champ « Ton pseudo » est remplacé par « Connecté : Pseudo ») ; le **serveur** prend le
   pseudo du compte à partir du jeton (le client ne peut pas jouer sous le pseudo d'un autre compte) et retient
   l'identifiant du compte du siège (pour l'historique, story 8.4).
6. **Code de secours.** **Given** mon pseudo et mon code de secours **When** j'ouvre « Mot de passe oublié ? » et
   choisis un nouveau mot de passe **Then** il remplace l'ancien, toutes mes autres sessions sont fermées, je suis
   connecté, et un **nouveau** code de secours s'affiche une fois (l'ancien ne marche plus). Les essais ratés comptent
   dans la même limite que la connexion.
7. **Invité.** **Given** pas de compte **When** je joue (solo, hot seat, en ligne) **Then** tout marche comme avant :
   le champ « Ton pseudo », le jeu par code ou lien, la reprise de siège (11.2). Les e2e existants passent sans
   changement.
8. **Persistance.** Les comptes et sessions survivent à un redémarrage et à une reconstruction du serveur
   (fichier SQLite sur un volume Docker). Le serveur fait une copie de la base une fois par jour et garde les
   7 dernières.
9. **Compatibilité d'une version.** Le nouveau serveur accepte les anciens clients (options de salle sans jeton).
   Le nouveau client face à un serveur sans `/api/health` (ancien serveur, ou serveur absent) **cache** les
   boutons de compte et garde le mode invité.

## Tasks / Subtasks

- [x] **Base de données** — `apps/server/src/db/` (AC 8)
  - [x] `db.ts` : `openDb(path)` avec `DatabaseSync` de `node:sqlite` ; `path = ':memory:'` pour les tests ;
        `PRAGMA journal_mode = WAL`, `PRAGMA foreign_keys = ON` ; migrations numérotées appliquées au démarrage
        selon `PRAGMA user_version` (migration 1 = tables ci-dessous). Création du dossier `DATA_DIR` si absent.
  - [x] Tables (migration 1) :
        `accounts(id INTEGER PRIMARY KEY, nickname TEXT NOT NULL, nickname_key TEXT NOT NULL UNIQUE,
        password_hash TEXT, recovery_hash TEXT NOT NULL, created_at INTEGER NOT NULL)` — `password_hash` peut être
        NULL (compte à clé d'accès seule, story 8.2) ;
        `sessions(token_hash TEXT PRIMARY KEY, account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        created_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL)`.
  - [x] `accounts.ts` : fonctions pures autour de la base (créer, trouver par pseudo, vérifier, changer le mot de
        passe, remplacer le code de secours) ; `sessions.ts` : créer, lire (et repousser `last_seen_at`, au plus une
        écriture par heure), supprimer une, supprimer toutes celles d'un compte, purger les sessions de plus de 90 j.
  - [x] `backup.ts` : `VACUUM INTO 'DATA_DIR/backups/cinecards-AAAA-MM-JJ.db'` au démarrage si la copie du jour
        manque, puis toutes les 24 h ; garder les 7 plus récentes. Rien en `:memory:`.
- [x] **Authentification** — `apps/server/src/auth/` (AC 2, 3, 4, 6)
  - [x] `password.ts` : `scrypt` de `node:crypto` (sel aléatoire de 16 octets, `N=16384, r=8, p=1`, clé de 64 octets),
        stocké `scrypt$N$r$p$selBase64$hashBase64` ; vérification avec `timingSafeEqual`. Version asynchrone
        (`util.promisify(scrypt)`) pour ne pas bloquer la boucle des salles.
  - [x] `tokens.ts` : jeton de session = 32 octets aléatoires en base64url ; stocké en **SHA-256** (jamais en clair).
        Code de secours = 16 caractères de l'alphabet sans sosies de `codes.ts` (`ABCDEFGHJKMNPQRSTUVWXYZ23456789`),
        affiché en 4 groupes `XXXX-XXXX-XXXX-XXXX` ; comparé sans tirets ni casse ; stocké en SHA-256 (entropie
        ≈ 79 bits, pas besoin de scrypt).
  - [x] `nickname.ts` : `normalizeNickname` (trim, NFC, espaces multiples réduits à un) et `nicknameKey`
        (`toLocaleLowerCase('fr')`) ; regex `^[\p{L}\p{N} _-]{3,16}$` (flag `u`).
  - [x] `limiter.ts` : fenêtre glissante en mémoire, 10 échecs / 15 min par `nickname_key` (connexion et code de
        secours partagés) ; le succès ne remet pas à zéro les échecs récents. Pseudo inconnu : on calcule quand même
        un scrypt factice pour un temps de réponse comparable.
- [x] **API HTTP** — `apps/server/src/api/` et `main.ts` (AC 1-6, 9)
  - [x] Même serveur et même port, préfixe `/api/`, à brancher dans le `httpServer.emit` existant de `main.ts`
        (comme `/health`) **avant** les routes de Colyseus. JSON seulement, corps limité à 8 Ko, réponses
        `application/json; charset=utf-8`.
  - [x] CORS : `Access-Control-Allow-Origin` = l'origine de la requête **seulement** si elle est dans
        `CLIENT_ORIGINS` (variable d'env., liste séparée par des virgules ; défaut
        `https://seven74ai.github.io`) **ou** est `http://localhost:*` / `http://127.0.0.1:*` ; `Vary: Origin` ;
        réponse aux `OPTIONS` (méthodes `GET, POST, DELETE`, en-têtes `Authorization, Content-Type`, `Max-Age 600`).
        Pas de cookies (`credentials` non utilisés).
  - [x] Routes :
        `GET /api/health` → `200 {"ok":true,"accounts":true}` (détection par le client) ;
        `POST /api/accounts` `{nickname,password}` → `201 {token, account:{id,nickname}, recoveryCode}` ;
        `POST /api/sessions` `{nickname,password}` → `200 {token, account}` ;
        `GET /api/me` (Bearer) → `200 {account}` ou `401` ;
        `DELETE /api/sessions/current` (Bearer) → `204` ;
        `POST /api/recover` `{nickname, recoveryCode, newPassword}` → `200 {token, account, recoveryCode}`.
  - [x] Erreurs : `{ "error": code, "message": texte français }` avec `400 invalid_nickname | invalid_password |
        bad_json`, `401 bad_credentials | unauthorized`, `409 nickname_taken`, `429 too_many_attempts`
        (+ `retryAfterSeconds`), `404 not_found`, `500 server_error` (journalisé, sans détail au client).
  - [x] `startServer(port, contentDir, opts?)` : accepte `dataDir` (défaut `process.env.DATA_DIR ?? './data'`,
        `':memory:'` possible) et l'expose à la salle (comme `roomConfig.catalog`).
- [x] **Salle** — `apps/server/src/room.ts`, `packages/protocol` (AC 5, 9)
  - [x] `RoomOptions` gagne `session?: string` (optionnel : rétrocompatible).
  - [x] `onJoin` : si `options.session` désigne une session valide, `names[seat]` = pseudo du compte et
        `accounts[seat]` = id du compte ; sinon comportement actuel (`cleanName(options.nickname)`). Un jeton invalide
        ne refuse pas l'entrée (le joueur entre en invité).
  - [x] La reprise de siège (11.2, `allowReconnection`) ne change pas.
- [x] **Déploiement** (AC 8)
  - [x] `Dockerfile` : `ENV DATA_DIR=/app/data`, `RUN mkdir -p /app/data`.
  - [x] `deploy/docker-compose.yml` : volume nommé `cinecards-data:/app/data` (déclaré en bas du fichier) ;
        `CLIENT_ORIGINS` non requis (défaut correct).
  - [x] `docs/deploy.md` : variables `DATA_DIR` et `CLIENT_ORIGINS` dans le tableau ; où est la base, les copies
        quotidiennes, comment récupérer une copie (`docker compose cp`), et l'avertissement « ne pas faire
        `docker compose down -v` ».
  - [x] `.gitignore` : `data/`.
- [x] **Client** — `apps/client/src/account/` (AC 1-7, 9)
  - [x] `api.ts` : `API_URL` déduit de `SERVER_URL` (`ws://` → `http://`, `wss://` → `https://`) ; `fetch` avec
        `Authorization: Bearer` ; `accountsAvailable()` = `GET /api/health` (délai 4 s, résultat mis en cache pour la
        visite ; échec → `false`).
  - [x] `session.ts` : jeton dans `localStorage['cinecards.account']` `{token, nickname, id}` (try/catch comme
        `net/config.ts`) ; hook `useAccount()` (état : `unknown | guest | {nickname,id}`) qui vérifie `/api/me` au
        démarrage (401 → oubli du jeton ; erreur réseau → garder l'état connu, ne pas déconnecter).
  - [x] Écrans (dans le style existant : `.home-panel.parchment`, `.field`, `.btn`, `.overlay`) : panneau
        « Créer un compte », « Se connecter », « Mot de passe oublié ? », et l'écran du code de secours
        (code en grand, police à chasse fixe, `Copier`, `Imprimer` qui n'imprime que le code et le pseudo via une
        feuille `@media print`, case « J'ai noté mon code », bouton « Continuer » actif seulement quand elle est
        cochée). Champs avec `<label>`, `autocomplete="username"` / `"new-password"` / `"current-password"`, bouton
        « Afficher » pour le mot de passe. Cibles de 44 px. Pas de nouvelle direction visuelle : pas de maquette.
  - [x] Accueil (`ui/Home.tsx`) : dans l'onglet « En ligne », si les comptes sont disponibles : connecté → ligne
        « Connecté : **Pseudo** · Se déconnecter » à la place du champ « Ton pseudo » ; invité → le champ reste,
        avec deux liens « Se connecter » / « Créer un compte ». `Start` `create`/`join` porte `session?: string`.
  - [x] `net/online.ts` : passer `session` dans les options de `create` et `joinById` (et rien de plus :
        `reconnect` garde le siège).
  - [x] Textes en français, tutoiement (comme la table).
- [x] **Tests** (AC 1-9)
  - [x] `apps/server/src/accounts.test.ts` (base `:memory:`) : création, pseudo pris (casse et accents NFC),
        validation des pseudos et mots de passe, connexion, mauvais mot de passe, limite de 10 essais (horloge
        injectée), session lue puis expirée à 90 j, déconnexion, code de secours (nouveau mot de passe, ancien code
        refusé, autres sessions fermées), migrations rejouées sur une base existante (idempotence), mot de passe jamais
        stocké en clair, jeton jamais stocké en clair.
  - [x] Même fichier, via HTTP sur `startServer` (comme `server.test.ts`) : routes et codes d'erreur, CORS
        (origine autorisée, refusée, `OPTIONS`), corps trop gros, salle : pseudo pris du compte, jeton invalide = invité.
  - [x] `apps/client/src/account/*.test.ts` : `API_URL`, stockage du jeton, normalisation affichée du code.
  - [x] e2e `e2e/accounts.spec.ts` : créer un compte (code affiché, case à cocher), se déconnecter, se reconnecter
        dans un **autre** contexte de navigateur (= autre appareil), créer une salle et voir le pseudo du compte chez
        l'adversaire invité, « Mot de passe oublié ? » avec le code, ancien code refusé. Pseudo unique par test
        (`Test-${Date.now() % 1e6}`). Le serveur e2e utilise une base jetable : `playwright.config.ts` passe
        `DATA_DIR` = dossier temporaire (`os.tmpdir()`).
  - [x] Les e2e existants restent verts sans modification (invité).

## Dev Notes

### Contexte et décisions
- Proposition approuvée : `_bmad-output/planning-artifacts/sprint-change-proposal-2026-11-22-epics-8-10.md`.
  Root veut **deux** façons de se connecter ; cette story fait le pseudo + mot de passe et le **socle** (base, API,
  session). La clé d'accès (WebAuthn) arrive en 8.2 et réutilise tout : ne rien coder de WebAuthn ici, mais garder
  `password_hash` nullable et le code de secours commun.
- ADR-008 (`_bmad-output/game-architecture.md`) : `node:sqlite`, pas `@colyseus/database` (Postgres/PGlite et
  `@colyseus/auth`, écartés).
- Hypothèses déjà validées par Root avec la proposition (`a-valider-par-root.md`, section « Epics 8 et 10 ») :
  pseudo 3-16, mot de passe ≥ 8, 10 essais / 15 min, session 90 j, un code de secours remplacé à chaque usage.
  Tout autre choix fait pendant la story s'ajoute à cette section.

### État actuel des fichiers touchés (à préserver)
- `apps/server/src/main.ts` : `startServer(port, contentDir)` charge le catalogue, crée un `http.Server` dont
  `emit` est surchargé pour répondre à `/health` avant Colyseus, puis `new Server({ transport: new
  WebSocketTransport({ server }) })`. **Garder** `/health` en texte `ok` (le healthcheck Docker et
  `autodeploy.sh` l'utilisent). Les tests appellent `startServer(port)` et `server.gracefullyShutdown(false)` :
  fermer la base dans ce chemin aussi (ou à `process.exit`), sans casser `server.test.ts`.
- `apps/server/src/room.ts` : `DuelRoom.onJoin(client, options)` lit `options.nickname` via `cleanName` ;
  `seats`, `names` indexés par siège ; `holdSeat` / `allowReconnection` (11.2) et l'expiration des salles vides
  (10 min) ne doivent pas bouger. `onJoin` est synchrone aujourd'hui : `node:sqlite` est synchrone, la lecture de
  session y tient sans `async`.
- `packages/protocol/src/index.ts` : `RoomOptions { mode?, nickname? }` → ajouter `session?`. Champ optionnel =
  rétrocompatible dans les deux sens.
- `apps/client/src/ui/Home.tsx` : onglets « Sur cet appareil » / « En ligne », champ « Ton pseudo »
  (`localStorage['cinecards.nick']`), `onStart({kind:'create'|'join', …, nickname})`. Les e2e (`online-duel`,
  `online-rejoin`) cherchent `getByLabel('Ton pseudo')` et les boutons « Créer un duel et inviter » / « Rejoindre » :
  **ne pas les renommer** ; en invité, le champ doit rester tel quel.
- `apps/client/src/App.tsx` : `start(s)` construit `OnlineStart` et importe `net/online.ts` à la demande (le SDK
  Colyseus est chargé seulement en ligne : garder `account/api.ts` **sans** import du SDK).
- `apps/client/src/net/config.ts` : `SERVER_URL` (vide = en ligne désactivé) et le stockage des jetons de siège ;
  reprendre le même style de `try/catch` sur `localStorage`.
- `apps/client/src/net/online.ts` : `watchSeatToken` (correctif du 2026-11-22) : ne pas y toucher hormis l'ajout
  de `session` aux options.

### Sécurité (à respecter)
- Jamais de mot de passe, jeton ou code de secours en clair en base ni dans les journaux.
- Les messages d'échec de connexion ne disent pas si le pseudo existe ; création : « pseudo pris » est
  acceptable (il faut bien le dire), la limite d'essais protège la connexion.
- `Authorization: Bearer` seulement ; pas de jeton dans l'URL.
- Le serveur ne fait confiance qu'au jeton pour le pseudo d'un compte (AC 5).
- Pas de cookies : client (`github.io`) et serveur (`sevend.io`) sont sur deux sites ; Safari bloque les cookies
  tiers.

### Bibliothèques
- Aucune dépendance nouvelle : `node:sqlite` (`DatabaseSync`, `prepare().run/get/all`, `exec`), `node:crypto`
  (`scrypt`, `randomBytes`, `createHash`, `timingSafeEqual`), `node:http` déjà utilisé.
- `node:sqlite` : sans option en Node 22.13+ et 24 (l'image Docker est `node:24-alpine`, la machine de dev en 22.23) ;
  il affiche un `ExperimentalWarning`, déjà masqué par `--no-warnings` dans les scripts `start`/`dev` et le `CMD`
  Docker. Les types sont dans `@types/node` 22. Vitest le charge sans réglage.
- `VACUUM INTO` est pris en charge par la version de SQLite fournie avec Node.

### Tests et définition de fini
- `pnpm typecheck`, `pnpm test`, `PW_CHANNEL=chromium pnpm e2e -- --trace off` (ports e2e dédiés si plusieurs
  agents : `E2E_SERVER_PORT` / `E2E_CLIENT_PORT`). Pas de moteur ni de cartes touchés : la simulation de 200 parties
  n'est pas requise.
- Tester l'horloge (sessions de 90 j, fenêtre de 15 min) avec une horloge injectée, pas avec des `sleep`.
- Après livraison : vérifier `https://cinecards.sevend.io/api/health` (le serveur se redéploie en ~5 min) et que les
  comptes survivent à un redéploiement (créer un compte de test, attendre le déploiement suivant, se reconnecter ;
  supprimer ensuite le compte de test n'est pas possible par l'API : utiliser un pseudo `ZZ-test-…`).

### Project Structure Notes
- Nouveaux dossiers conformes à l'architecture amendée : `apps/server/src/{db,auth,api}`,
  `apps/client/src/account`. L'architecture décrit `apps/server/src/rooms` mais le code réel est
  `apps/server/src/room.ts` : suivre le code réel.

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.1]
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-11-22-epics-8-10.md]
- [Source: _bmad-output/game-architecture.md#Decision Summary (Persistence, Authentication, HTTP API) et ADR-008]
- [Source: _bmad-output/planning-artifacts/gdds/gdd-cinecards-2026-11-22/gdd.md#Game Modes]
- [Source: _bmad-output/implementation-artifacts/11-2-revenir-dans-une-partie-en-ligne.md] (reprise de siège à ne pas casser)
- [Source: AGENTS.md] (autonomie, définition de fini, livraison sur `main`, Pages, compatibilité d'une version)

## Dev Agent Record

### Agent Model Used

Agent dev (workflow gds-dev-story)

### Debug Log References

- `pnpm typecheck` : vert. `pnpm test` : 21 fichiers, 180 tests verts.
- `E2E_SERVER_PORT=2667 E2E_CLIENT_PORT=5274 PW_CHANNEL=chromium pnpm e2e -- --trace off` : 39 tests verts
  (un premier passage a vu `mobile-table` 360 × 640 échouer de 0,35 px sous charge ; vert relancé seul et au passage complet suivant, sans lien avec la story).

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- Base : `apps/server/src/db` (`openDb` avec `node:sqlite`, WAL, clés étrangères, migrations par `PRAGMA user_version`,
  tables `accounts` / `sessions` + index `sessions_account`), dépôts `accounts.ts` / `sessions.ts` (lecture de session
  qui repousse `last_seen_at` au plus une fois par heure, expiration à 90 j), `backup.ts` (`VACUUM INTO` daté UTC,
  7 copies gardées ; `startMaintenance` au démarrage puis toutes les heures, avec la purge des sessions).
- Authentification : `apps/server/src/auth` — scrypt asynchrone (N=16384, r=8, p=1, sel 16 o, clé 64 o, format
  `scrypt$N$r$p$sel$hash`, `timingSafeEqual`), scrypt factice pour un pseudo inconnu ; jetons 32 o base64url stockés en
  SHA-256 ; code de secours 16 caractères sans sosies (`ALPHABET` exporté de `codes.ts`) en SHA-256 ; pseudo normalisé
  (NFC, trim, espaces réduits) et clé `toLocaleLowerCase('fr')` ; limiteur 10 échecs / 15 min partagé connexion + secours.
  `AccountService` (horloge injectée) regroupe création, connexion, `accountOf` (synchrone, pour `onJoin`), déconnexion,
  récupération (nouveau mot de passe, toutes les sessions fermées, nouvelle session, nouveau code).
- API : `apps/server/src/api/http.ts` branchée dans le `httpServer.emit` de `main.ts` après `/health` (toujours `ok` en
  texte) et avant Colyseus ; JSON, corps ≤ 8 Ko (413 `too_large`), CORS `CLIENT_ORIGINS` (défaut GitHub Pages) +
  `http://localhost:*` / `127.0.0.1:*`, `Vary: Origin`, `OPTIONS` 204. `startServer(port, contentDir, { dataDir,
  clientOrigins, now })` ; la base se ferme dans `onShutdown`. Les tests serveur tournent avec `DATA_DIR=':memory:'`
  (`apps/server/vitest.config.ts`).
- Salle : `RoomOptions.session?` ; `onJoin` prend le pseudo du compte d'une session valide et retient son id
  (`accountOf(seat)` pour 8.4) ; jeton invalide = invité. Reprise de siège inchangée.
- Déploiement : `DATA_DIR=/app/data` dans le Dockerfile, volume nommé `cinecards-data`, `docs/deploy.md` (variables,
  copies, `docker compose cp`, restauration, avertissement `down -v`), `.gitignore` `data/`.
- Client : `apps/client/src/account` — `api.ts` (sans SDK Colyseus, `accountsAvailable` 4 s en cache), `session.ts`
  (`localStorage['cinecards.account']`, magasin + `useAccount`, `/api/me` au démarrage : 401 oublie, erreur réseau garde),
  `AccountDialog.tsx` (Se connecter / Créer un compte / Mot de passe oublié ?, erreurs sous le champ, « Afficher »,
  écran du code avec Copier / Imprimer (`body.print-code` + `@media print`) / case « J’ai noté mon code » / Continuer).
  Accueil : « Connecté : Pseudo · Se déconnecter » ou le champ « Ton pseudo » + liens ; tout est caché si `/api/health`
  échoue. `session` passé à `create` / `joinById` dans `net/online.ts` (rien d'autre n'y change).
- Tests : `apps/server/src/accounts.test.ts` (20 tests : règles, scrypt, codes, migrations rejouées, copies, service avec
  horloge injectée, rien en clair, HTTP, CORS, corps trop gros, salle), `apps/client/src/account/account.test.ts`,
  e2e `e2e/accounts.spec.ts` ; `playwright.config.ts` donne au serveur e2e un `DATA_DIR` jetable dans `os.tmpdir()`.
- Choix hors story listés dans `a-valider-par-root.md` (section « Epics 8 et 10 »).

### File List

- `.gitignore`
- `Dockerfile`
- `deploy/docker-compose.yml`
- `docs/deploy.md`
- `playwright.config.ts`
- `e2e/accounts.spec.ts` (nouveau)
- `packages/protocol/src/index.ts`
- `apps/server/vitest.config.ts`
- `apps/server/src/main.ts`
- `apps/server/src/room.ts`
- `apps/server/src/codes.ts`
- `apps/server/src/accounts.test.ts` (nouveau)
- `apps/server/src/api/http.ts` (nouveau)
- `apps/server/src/auth/limiter.ts` (nouveau)
- `apps/server/src/auth/nickname.ts` (nouveau)
- `apps/server/src/auth/password.ts` (nouveau)
- `apps/server/src/auth/service.ts` (nouveau)
- `apps/server/src/auth/tokens.ts` (nouveau)
- `apps/server/src/db/accounts.ts` (nouveau)
- `apps/server/src/db/backup.ts` (nouveau)
- `apps/server/src/db/db.ts` (nouveau)
- `apps/server/src/db/sessions.ts` (nouveau)
- `apps/client/src/App.tsx`
- `apps/client/src/net/online.ts`
- `apps/client/src/ui/Home.tsx`
- `apps/client/src/styles.css`
- `apps/client/src/account/api.ts` (nouveau)
- `apps/client/src/account/session.ts` (nouveau)
- `apps/client/src/account/AccountDialog.tsx` (nouveau)
- `apps/client/src/account/account.test.ts` (nouveau)
- `_bmad-output/implementation-artifacts/a-valider-par-root.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-11-22 : story 8.1 implémentée (base SQLite, comptes pseudo + mot de passe, sessions, code de secours, API `/api/*`,
  pseudo du compte dans les salles, volume Docker et copies quotidiennes, écrans de compte) ; statut → review.
