---
baseline_commit: fff4d48b1d06d13f41c749d58cf9c396b017b714
---

# Story 8.2: Clé d'accès et code de secours

Status: review

## Story

As a joueur,
I want me connecter avec Face ID ou mon empreinte,
so that je n'aie pas de mot de passe à retenir.

## Acceptance Criteria

1. **Créer un compte avec une clé d'accès.** **Given** « Créer un compte » **When** je choisis « Avec une clé d'accès »,
   saisis un pseudo libre et valide la demande de mon appareil (Face ID, empreinte, code) **Then** le compte est créé
   **sans mot de passe**, je suis connecté et le code de secours s'affiche une fois (même écran que 8.1). Le pseudo
   n'est réservé qu'une fois la clé validée : annuler la demande de l'appareil ne crée rien.
2. **Se connecter avec une clé d'accès.** **Given** une clé enregistrée sur cet appareil (ou synchronisée : trousseau
   iCloud, gestionnaire Google) **When** j'appuie sur « Se connecter avec une clé d'accès » **Then** l'appareil
   propose mes clés pour CineCards et je suis connecté **sans saisir mon pseudo**. Clé inconnue ou retirée : « Cette clé
   d'accès n'est plus liée à un compte. »
3. **Gérer mes clés.** **Given** je suis connecté (compte à mot de passe ou à clé) **When** j'ouvre « Mon compte »
   **Then** je vois mes clés (nom de l'appareil, date d'ajout, dernière utilisation), je peux **ajouter** une clé
   (« Ajouter une clé d'accès ») et en **retirer** une (avec confirmation). Je ne peux pas retirer ma dernière façon de
   me connecter : sans mot de passe, la dernière clé ne se retire pas (« C'est ta seule façon de te connecter :
   ajoute d'abord une autre clé ou un mot de passe. »).
4. **Mot de passe depuis « Mon compte ».** Un compte sans mot de passe peut en **choisir** un ; un compte avec mot de
   passe peut le **changer** (ancien mot de passe demandé). Mêmes règles qu'en 8.1 (8 caractères au moins).
5. **Code de secours pour une clé perdue.** **Given** mon pseudo et mon code de secours **When** j'ouvre « Mot de passe
   ou clé perdus ? » **Then** je peux, au choix, choisir un nouveau mot de passe (comme 8.1) **ou** ajouter une
   nouvelle clé d'accès ; dans les deux cas toutes mes autres sessions sont fermées, je suis connecté et un nouveau code
   remplace l'ancien.
6. **Appareil sans clé d'accès.** Si le navigateur ne gère pas les clés d'accès (`browserSupportsWebAuthn()` faux),
   les boutons de clé sont cachés et le mot de passe reste proposé. Une demande annulée ou expirée par l'utilisateur
   ne montre pas d'erreur rouge (« Demande annulée. » discret) et laisse réessayer.
7. **Compatibilité.** L'API de 8.1 ne change pas pour les anciens clients (`POST /api/recover` avec `newPassword`
   marche comme avant). Le nouveau client ne montre les clés d'accès que si `GET /api/health` répond
   `"passkeys": true` (un serveur 8.1 répond sans ce champ : boutons cachés).

## Tasks / Subtasks

- [x] **Base** — migration 2 dans `apps/server/src/db/db.ts` (ne jamais modifier la migration 1) (AC 1-5)
  - [x] `ALTER TABLE accounts ADD COLUMN webauthn_user_id TEXT` (identifiant WebAuthn de l'utilisateur, 16 octets
        aléatoires en base64url, créé au premier ajout de clé ; jamais le pseudo ni l'id SQL) ;
        `CREATE TABLE passkeys (id TEXT PRIMARY KEY /* credential id base64url */, account_id INTEGER NOT NULL
        REFERENCES accounts(id) ON DELETE CASCADE, public_key BLOB NOT NULL, counter INTEGER NOT NULL,
        transports TEXT /* JSON */, rp_id TEXT NOT NULL, name TEXT NOT NULL, created_at INTEGER NOT NULL,
        last_used_at INTEGER)` + index sur `account_id`.
  - [x] `apps/server/src/db/passkeys.ts` : insérer, lister par compte, trouver par id, mettre à jour compteur et
        `last_used_at`, supprimer (en vérifiant le compte), compter par compte.
  - [x] Test : une base créée par la migration 1 avec un compte existant passe en version 2 sans perte.
- [x] **WebAuthn côté serveur** — `apps/server/src/auth/passkeys.ts` (AC 1, 2, 3, 5)
  - [x] Dépendance `@simplewebauthn/server` (v14, Node ≥ 22). Lire les types installés pour la signature exacte
        (`generateRegistrationOptions`, `verifyRegistrationResponse`, `generateAuthenticationOptions`,
        `verifyAuthenticationResponse`) : les noms de champs ont changé entre les versions majeures.
  - [x] **Partie de confiance** déduite de l'en-tête `Origin` de la requête, **seulement** si l'origine est autorisée
        (`originAllowed` de `api/http.ts`) : `rpID` = nom d'hôte de l'origine (`seven74ai.github.io`, `localhost`),
        `expectedOrigin` = l'origine. Origine absente ou refusée → `403 origin_not_allowed`. `rpName` = « CineCards ».
        `rp_id` est enregistré avec la clé et doit correspondre à la connexion.
  - [x] **Défis** en mémoire (`Map`), clé = identifiant de cérémonie aléatoire renvoyé au client, durée de vie
        5 min, usage unique (supprimé à la vérification, réussie ou non), purge périodique ; au plus 1 000 défis en
        attente (les plus vieux sautent).
  - [x] Inscription : `residentKey: 'required'` (clé découvrable : connexion sans pseudo), `userVerification:
        'preferred'`, `attestationType: 'none'`, `excludeCredentials` = clés déjà liées au compte, `userName` = pseudo,
        `userDisplayName` = pseudo, `userID` = `webauthn_user_id`. Nom de la clé : déduit du `User-Agent`
        (« iPhone », « iPad », « Mac », « Android », « Windows », « Linux », sinon « Appareil ») ; pas de saisie.
  - [x] Connexion : `allowCredentials` vide (découvrable), `userVerification: 'preferred'`. Vérifier avec la clé
        trouvée par `response.id` ; refuser si `rp_id` diffère ; mettre à jour le compteur (un compteur à 0 des clés
        synchronisées est normal : ne pas le traiter comme un clonage).
- [x] **API** — `apps/server/src/api/http.ts` et `auth/service.ts` (AC 1-5, 7)
  - [x] `GET /api/health` → `{ ok: true, accounts: true, passkeys: true }`.
  - [x] Création par clé : `POST /api/passkeys/register/options` `{ nickname }` (sans session) → vérifie le pseudo
        (validité, libre) → `{ ceremony, options }` ; `POST /api/passkeys/register/verify` `{ ceremony, response }` →
        revérifie que le pseudo est libre, crée le compte (`password_hash` NULL) et la clé dans **une transaction**
        → `201 { token, account, recoveryCode }`.
  - [x] Ajout d'une clé (session requise) : les deux mêmes routes avec `Authorization: Bearer` et sans `nickname` →
        `verify` renvoie `201 { passkey }`.
  - [x] Connexion : `POST /api/passkeys/login/options` → `{ ceremony, options }` ; `POST /api/passkeys/login/verify`
        `{ ceremony, response }` → `{ token, account }` ; clé inconnue → `401 unknown_passkey`.
  - [x] Compte : `GET /api/account` (Bearer) → `{ account, hasPassword, passkeys: [{ id, name, createdAt,
        lastUsedAt }] }` ; `DELETE /api/passkeys/:id` (Bearer) → `204`, ou `409 last_login_method` ;
        `POST /api/password` (Bearer) `{ currentPassword?, newPassword }` → `204` (ancien mot de passe exigé s'il en
        existe un, comptant dans la limite d'essais de 8.1 ; un changement ferme les **autres** sessions).
  - [x] Code de secours : `POST /api/recover` accepte `newPassword` **facultatif** : absent → seulement la vérification
        du code, la fermeture des sessions, une nouvelle session et un nouveau code (le client enchaîne alors sur
        l'ajout d'une clé, avec cette session). Avec `newPassword` : comportement 8.1 inchangé.
  - [x] Erreurs en français dans le format de 8.1 (`{ error, message }`) : `origin_not_allowed`, `ceremony_expired`
        (« La demande a expiré. Réessaie. »), `passkey_failed` (« La clé d'accès n'a pas pu être vérifiée. »),
        `unknown_passkey`, `last_login_method`, `bad_credentials` (ancien mot de passe faux).
- [x] **Client** — `apps/client/src/account/` (AC 1-6)
  - [x] Dépendance `@simplewebauthn/browser` (v14 ; même version majeure que le serveur) : `startRegistration({
        optionsJSON })`, `startAuthentication({ optionsJSON })`, `browserSupportsWebAuthn()`. **Chargée à la
        demande** (`import()` au premier appui) pour ne pas alourdir l'accueil.
  - [x] `api.ts` : fonctions des nouvelles routes ; `accountsAvailable()` devient une lecture de `/api/health` qui
        expose aussi `passkeys`.
  - [x] `AccountDialog.tsx` : « Se connecter » propose en premier « Se connecter avec une clé d'accès » (si
        disponible), puis le formulaire pseudo + mot de passe ; « Créer un compte » propose « Avec une clé d'accès
        (recommandé) » ou « Avec un mot de passe » ; « Mot de passe oublié ? » devient « Mot de passe ou clé perdus ? »
        avec, après le code, le choix « Nouveau mot de passe » / « Nouvelle clé d'accès ». `NotAllowedError` /
        `AbortError` = annulation (AC 6).
  - [x] Nouveau panneau « Mon compte » (`AccountPanel.tsx`), ouvert depuis la ligne « Connecté : Pseudo » de
        l'accueil (le pseudo devient un bouton « Mon compte »). Contenu : liste des clés, « Ajouter une clé
        d'accès », « Retirer », « Choisir un mot de passe » ou « Changer le mot de passe », « Se déconnecter ».
        Style existant (`.overlay`, `.card-panel.parchment`, `.btn`, `.field`), rendu par **portail dans `<body>`**
        comme `AccountDialog` (correctif de revue 8.1 : sinon la fenêtre s'ouvre hors de vue sur téléphone).
        Cibles de 44 px, textes en français (tutoiement).
- [x] **Tests** (AC 1-7)
  - [x] Serveur (`apps/server/src/passkeys.test.ts`) : migration 1 → 2, partie de confiance (origine autorisée,
        refusée, absente), défi à usage unique et expiré (horloge injectée), refus de retirer la dernière façon de se
        connecter, `POST /api/recover` sans `newPassword`, `POST /api/password` (avec et sans mot de passe existant),
        `GET /api/account`. Les vérifications cryptographiques elles-mêmes sont couvertes par l'e2e (authentificateur
        virtuel) : ne pas réécrire un authentificateur logiciel.
  - [x] e2e `e2e/passkeys.spec.ts` avec l'**authentificateur virtuel de Chromium** via CDP
        (`const cdp = await context.newCDPSession(page); await cdp.send('WebAuthn.enable');
        await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal',
        hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } })`) :
        créer un compte par clé (code de secours affiché), se déconnecter, se reconnecter par clé sans pseudo, ajouter
        un mot de passe dans « Mon compte », retirer la clé, refus de retirer la dernière façon, « Mot de passe ou clé
        perdus ? » → nouvelle clé dans un autre contexte (nouvel authentificateur). L'origine e2e est
        `http://localhost:<port>` (WebAuthn accepte `localhost` sans HTTPS).
  - [x] Les e2e de 8.1 (`accounts.spec.ts`) et tous les autres passent sans changement.

## Dev Notes

### Ce que 8.1 a livré (à réutiliser, ne pas refaire)
- `apps/server/src/db/db.ts` : `MIGRATIONS` (tableau, une entrée par version, **ne jamais modifier une migration
  livrée** : la base de production est déjà en version 1), `openDb`, `migrate` (transaction par migration).
- `apps/server/src/db/accounts.ts` : `AccountRow` (`password_hash` déjà nullable), `insertAccount` (avec
  `ON CONFLICT DO NOTHING` → `null` si pseudo pris), `findAccountByKey/ById`, `setPasswordHash`, `setRecoveryHash`.
- `apps/server/src/auth/service.ts` : `AccountService` (horloge injectée) avec `create`, `login`, `accountOf`
  (synchrone, utilisé par `onJoin`), `logout`, `recover`, `openSession` (privé), limiteur d'essais partagé
  (`Limiter`, 10 / 15 min par pseudo), messages `MESSAGES`. Ajouter les méthodes de clé ici ou dans un
  `PasskeyService` qui reçoit le même `Db`, la même horloge et `openSession`.
- `apps/server/src/api/http.ts` : `createApi(service, origins)` (routage `switch` sur `METHOD path`, `readJson` limité
  à 8 Ko → 413, CORS par `originAllowed`, réponses `{ error, message }`). Les routes à paramètre
  (`DELETE /api/passkeys/:id`) demandent un petit test de préfixe avant le `switch`. Ajouter `DELETE` est déjà dans
  `Access-Control-Allow-Methods`.
- `apps/server/src/main.ts` : `startServer(port, contentDir, { dataDir, clientOrigins, now })`, base fermée à
  l'arrêt. `apps/server/vitest.config.ts` : `DATA_DIR=':memory:'`.
- Client : `account/api.ts` (`call()`, `API_URL`, `accountsAvailable`, `formatRecoveryCode`), `account/session.ts`
  (`signIn`, `useAccount`, stockage `cinecards.account`), `account/AccountDialog.tsx` (modes `login | create |
  recover`, écran du code de secours `RecoveryScreen`, **portail dans `<body>`**), `ui/Home.tsx` (ligne
  `.account-line` « Connecté : Pseudo » + « Se déconnecter » ; liens « Se connecter » / « Créer un compte » en
  invité). Les e2e de 8.1 cherchent `.account-line` et le texte « Connecté : <pseudo> » : garder ce texte.
- Revue de 8.1 : la fenêtre s'ouvrait sous l'accueil (un ancêtre crée un bloc conteneur pour `position: fixed`) ;
  d'où le portail. Le code de secours se coupe entre les groupes seulement (`.recovery-code > span`).

### Pourquoi ces choix
- Clé **découvrable** (`residentKey: 'required'`) : c'est ce qui permet « se connecter sans pseudo » (AC 2), et c'est
  le comportement attendu par iOS et Android pour les passkeys.
- `rpID` = hôte du **client** (pas du serveur `cinecards.sevend.io`) : WebAuthn lie la clé au site où la page tourne.
  Conséquence (dans la proposition approuvée) : si le site change de domaine, les clés ne marchent plus ; le mot de
  passe ou le code de secours restent la porte de sortie.
- Pas d'attestation (`'none'`) : on ne filtre pas les modèles d'appareils.
- Défis en mémoire : un redémarrage du serveur annule seulement les cérémonies en cours (5 min).

### Sécurité
- Vérifier `expectedOrigin` et `expectedRPID` à chaque vérification ; ne jamais faire confiance à un `rpID` envoyé par
  le client.
- Une clé n'est retirée que par son compte (`WHERE id = ? AND account_id = ?`).
- Le défi est à usage unique, même en cas d'échec.
- Aucune clé publique ni identifiant de clé dans les journaux.

### Choix à noter dans `a-valider-par-root.md` (section « Epics 8 et 10 »)
- Nom de clé déduit de l'appareil, sans saisie ; on ne peut pas retirer sa dernière façon de se connecter ;
  changer de mot de passe ferme les autres sessions ; « Mot de passe ou clé perdus ? ».

### Tests et définition de fini
- `pnpm typecheck`, `pnpm test`, `PW_CHANNEL=chromium pnpm e2e -- --trace off` (ports dédiés). L'authentificateur
  virtuel CDP n'existe que sous Chromium : c'est le canal e2e du projet.
- Pas de moteur ni de cartes touchés : pas de simulation de 200 parties.
- Après livraison : vérifier `GET https://cinecards.sevend.io/api/health` (`passkeys: true`) et que le compte de test
  créé en 8.1 (`ZZ-test-8399`, voir le rapport de livraison de 8.1) se connecte toujours après le redéploiement
  (la migration 2 a tourné sur la base de production sans perte).

### Project Structure Notes
- Nouveaux fichiers : `apps/server/src/db/passkeys.ts`, `apps/server/src/auth/passkeys.ts`,
  `apps/server/src/passkeys.test.ts`, `apps/client/src/account/AccountPanel.tsx`, `e2e/passkeys.spec.ts`.
- Dépendances nouvelles (prévues par l'architecture, ligne « Authentication ») : `@simplewebauthn/server` dans
  `apps/server`, `@simplewebauthn/browser` dans `apps/client`. Mettre à jour `pnpm-lock.yaml`
  (`pnpm install` puis vérifier `pnpm install --frozen-lockfile`, utilisé par le Dockerfile).

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.2]
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-11-22-epics-8-10.md]
- [Source: _bmad-output/game-architecture.md#Decision Summary (Authentication) et ADR-008]
- [Source: _bmad-output/implementation-artifacts/8-1-compte-avec-pseudo-et-mot-de-passe.md] (socle, revue)
- [Source: AGENTS.md]

## Dev Agent Record

### Agent Model Used

Agent de développement Claude Code (gds-dev-story).

### Debug Log References

- `pnpm e2e` complet : deux passages ont eu chacun un échec de `play-draw.spec.ts` (compte d'images d'animation sous charge, 4 cœurs partagés avec d'autres worktrees ; partie locale, sans lien avec les comptes). Le fichier passe seul, et le troisième passage complet est vert (40/40).

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- **Base** : migration 2 ajoutée à `MIGRATIONS` (colonne `accounts.webauthn_user_id`, table `passkeys`, index `passkeys_account`) ; migration 1 intacte. Test : une base créée par la seule migration 1 avec un compte et une session passe en version 2 sans perte (et une clé part avec son compte).
- **Serveur** : `auth/passkeys.ts` (`PasskeyService`, `Ceremonies`, `deviceName`) avec `@simplewebauthn/server` 14.1. Partie de confiance tirée de l'en-tête `Origin` autorisé (`relyingParty` dans `api/http.ts`), sinon `403 origin_not_allowed`. Défis en mémoire : 5 min, usage unique (retirés même en cas d'échec), 1 000 au plus, purge des expirés à chaque nouveau défi. Clé découvrable (`residentKey: 'required'`), `userVerification: 'preferred'` (donc `requireUserVerification: false` à la vérification), `attestationType: 'none'`, `excludeCredentials` = clés du compte pour ce site. Identifiant WebAuthn aléatoire (16 octets), créé au premier ajout de clé (ou à la création du compte par clé). Création par clé : compte (`password_hash` NULL) et clé dans une transaction, pseudo revérifié.
- **API** : `/api/health` → `passkeys: true` ; `POST /api/passkeys/register/options|verify` (sans session = nouveau compte, avec session = ajout), `POST /api/passkeys/login/options|verify`, `GET /api/account`, `DELETE /api/passkeys/:id` (204, 404, 409 `last_login_method`), `POST /api/password` (204 ; ancien mot de passe exigé s'il existe, compté dans la limite de 8.1 ; ferme les autres sessions). `POST /api/recover` : `newPassword` facultatif, comportement 8.1 inchangé quand il est envoyé.
- **Client** : `@simplewebauthn/browser` 14.0 chargé par `import()` au premier appui (chunk séparé de 13 Ko au build). `serverFeatures()` lit `/api/health` ; les boutons de clé n'apparaissent que si le serveur répond `passkeys: true` **et** que le navigateur gère WebAuthn (`webAuthnSupported()`, même test que `browserSupportsWebAuthn()` sans charger la bibliothèque). `AccountDialog` : bouton de clé en premier puis « ou avec … mot de passe » et le formulaire de 8.1, en connexion, création et récupération (« Mot de passe ou clé perdus ? »). Annulation (`NotAllowedError`, `AbortError`) = note discrète « Demande annulée. ». Nouveau panneau `AccountPanel` (« Mon compte », portail dans `<body>`), ouvert en touchant le pseudo de la ligne « Connecté : … » (texte inchangé) : clés (nom, date d'ajout, dernière utilisation, « Retirer » avec confirmation), « Ajouter une clé d'accès », « Choisir / Changer le mot de passe », « Se déconnecter ».
- **Tests** : `apps/server/src/passkeys.test.ts` (13 tests : migration 1→2, partie de confiance, défis usage unique / expiré / lié à l'origine, 1 000 défis, options d'inscription, dernière façon de se connecter, mot de passe avec et sans ancien, limite d'essais, recover sans `newPassword`, `GET /api/account`, routes HTTP) ; `apps/client/src/account/passkeys.test.ts` (3 tests) ; e2e `e2e/passkeys.spec.ts` avec l'authentificateur virtuel de Chromium (création par clé, pseudo déjà pris, connexion sans pseudo, refus de retirer la dernière façon, mot de passe choisi, clé retirée puis refusée à la connexion, clé rajoutée, code de secours → nouvelle clé sur un autre appareil, autres sessions fermées, deux clés listées).
- **Écart avec la tâche « e2e de 8.1 sans changement »** : le lien renommé « Mot de passe ou clé perdus ? » (demandé par la story) casse le sélecteur exact de `accounts.spec.ts` ; une seule ligne y change (regex qui accepte l'ancien et le nouveau libellé). Le reste de 8.1 passe tel quel parce que le formulaire à mot de passe reste sur le même écran que le bouton de clé.
- `apps/server/src/accounts.test.ts` : l'attendu de `/api/health` inclut `passkeys: true`.
- Choix notés dans `a-valider-par-root.md` (section « Epics 8 et 10 »).
- Captures téléphone (390×844) : `_bmad-output/implementation-artifacts/screens/8-2/` (connexion, création, récupération, accueil connecté, « Mon compte » avec une clé, refus de la dernière clé).
- À vérifier après livraison (non faisable ici) : `GET https://cinecards.sevend.io/api/health` (`passkeys: true`), connexion du compte de test de 8.1, et un essai réel sur iPhone (Face ID) et Android (empreinte) : Safari exige que la demande suive de près l'appui, or le client attend d'abord les options du serveur (aller-retour court).

### File List

- `apps/server/package.json` (dépendance `@simplewebauthn/server`)
- `apps/client/package.json` (dépendance `@simplewebauthn/browser`)
- `pnpm-lock.yaml`
- `apps/server/src/db/db.ts` (migration 2)
- `apps/server/src/db/accounts.ts`
- `apps/server/src/db/sessions.ts`
- `apps/server/src/db/passkeys.ts` (nouveau)
- `apps/server/src/auth/passkeys.ts` (nouveau)
- `apps/server/src/auth/service.ts`
- `apps/server/src/api/http.ts`
- `apps/server/src/accounts.test.ts`
- `apps/server/src/passkeys.test.ts` (nouveau)
- `apps/client/src/account/api.ts`
- `apps/client/src/account/session.ts`
- `apps/client/src/account/passkeys.ts` (nouveau)
- `apps/client/src/account/passkeys.test.ts` (nouveau)
- `apps/client/src/account/AccountDialog.tsx`
- `apps/client/src/account/AccountPanel.tsx` (nouveau)
- `apps/client/src/ui/Home.tsx`
- `apps/client/src/styles.css`
- `e2e/passkeys.spec.ts` (nouveau)
- `e2e/accounts.spec.ts` (sélecteur du lien de récupération)
- `_bmad-output/implementation-artifacts/screens/8-2/*.png` (nouveau)
- `_bmad-output/implementation-artifacts/a-valider-par-root.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/8-2-cle-d-acces-et-code-de-secours.md`

### Change Log

- 2026-11-22 — Story 8.2 implémentée : clés d'accès (création de compte, connexion sans pseudo, ajout et retrait dans « Mon compte »), mot de passe depuis « Mon compte », code de secours → nouvelle clé, migration 2. Statut : review.
