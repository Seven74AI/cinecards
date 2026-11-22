---
baseline_commit: dfe526e8f23075dcb6c6a5f63861fc0089fc42da
---

# Story 8.6: Héberger le jeu sur cinecards.sevend.io

Status: review

## Story

As a Root,
I want que le jeu soit servi par mon VPS à l'adresse du serveur,
so that les clés d'accès soient liées à notre domaine et que le jeu se déploie en même temps que le serveur.

## Acceptance Criteria

1. **Le jeu à la même adresse que le serveur.** `GET https://cinecards.sevend.io/` sert le jeu (build Vite du client).
   Le client servi ainsi se connecte au serveur **de la même origine** (`wss://<hôte>` et `https://<hôte>/api`),
   sans `VITE_SERVER_URL`.
2. **Routes inchangées.** `/health` (texte `ok`), `/api/*`, le matchmaking Colyseus (`POST /matchmake/:method/:roomName`)
   et la mise à niveau WebSocket répondent comme avant. Les fichiers du jeu ne masquent aucune de ces routes.
3. **Un seul déploiement.** L'image Docker construit le client et le serveur ; `deploy/autodeploy.sh` (inchangé) met
   donc les deux à jour ensemble après un push sur `main`.
4. **Clés d'accès activées sur le nouveau site** (build Docker sans `VITE_PASSKEYS=off`) ; toujours coupées sur
   l'ancien site GitHub Pages.
5. **Ancien site.** Sur `seven74ai.github.io/cinecards`, un bandeau en haut de l'accueil : « CineCards a déménagé :
   **cinecards.sevend.io** » avec un bouton « Y aller » (lien `https://cinecards.sevend.io/` en conservant
   `?salle=CODE` s'il est présent). Le jeu y reste jouable pendant la transition. Le bandeau n'apparaît que dans le build
   Pages (`VITE_MOVED_TO=https://cinecards.sevend.io` dans `pages.yml`).
6. **Fichiers statiques corrects.** Types MIME justes (`.html`, `.js`, `.css`, `.svg`, `.png`, `.webp`, `.woff2`,
   `.json`, `.mp3`/`.ogg` si présents, `.webmanifest`) ; `index.html` en `Cache-Control: no-cache` ; fichiers
   `assets/*` (noms avec empreinte) en `public, max-age=31536000, immutable` ; `HEAD` pris en charge ; chemin inconnu
   sans extension (lien `/?salle=…` ou rechargement) → `index.html` ; chemin inconnu avec extension → `404` ; aucun
   accès hors du dossier du client (`..`, chemins encodés, octet nul) ; en-têtes `X-Content-Type-Options: nosniff` et
   `Referrer-Policy: same-origin`.
7. **Comptes.** `cinecards.sevend.io` est une origine autorisée par défaut (`CLIENT_ORIGINS` défaut =
   `https://cinecards.sevend.io,https://seven74ai.github.io`). Les sessions de compte de l'ancien site ne suivent pas
   (stockage par origine) : on se reconnecte une fois, c'est attendu.
8. **Développement et tests inchangés.** `pnpm dev:client` / `pnpm dev:server`, les e2e (Vite + serveur sur des ports
   séparés) et `VITE_SERVER_URL` explicite marchent comme avant.

## Tasks / Subtasks

- [x] **Serveur : fichiers du jeu** — `apps/server/src/static.ts` + `main.ts` (AC 1, 2, 6)
  - [x] `createStatic(clientDir)` → gestionnaire `(req, res) => boolean` dans le même style que `createApi`
        (`apps/server/src/api/http.ts`). `clientDir` = `process.env.CLIENT_DIR` ; absent ou dossier inexistant →
        aucun fichier servi (le serveur marche comme aujourd'hui, utile en dev et dans les tests existants).
  - [x] Ordre dans le `httpServer.emit` de `main.ts` : `/health` → `/api/*` → **fichiers du jeu** (GET/HEAD seulement,
        jamais `/matchmake/*` ni une requête `upgrade`) → Colyseus. Les WebSocket passent par l'événement `upgrade`,
        pas `request` : ne pas y toucher.
  - [x] Résolution sûre : `decodeURIComponent` dans un `try`, refus des octets nuls, `path.resolve(clientDir, '.' +
        pathname)` puis vérifier que le résultat commence par `clientDir + sep` (ou égale `index.html`). Lire avec
        `fs.createReadStream` ; `Content-Length` depuis `stat`.
  - [x] Tests `apps/server/src/static.test.ts` (dossier temporaire avec `index.html`, `assets/app-abc123.js`) : types
        MIME, en-têtes de cache, `HEAD`, repli sur `index.html` pour `/salle-xyz` et `/?salle=AB12C`, `404` pour
        `/manque.js`, traversée refusée (`/../package.json`, `/%2e%2e/…`, `%00`), `/health`, `/api/health` et
        `POST /matchmake/…` intacts quand `CLIENT_DIR` est défini.
- [x] **Client : même origine** — `apps/client/src/net/config.ts`, `account/api.ts` (AC 1, 8)
  - [x] `SERVER_URL` : si `VITE_SERVER_URL === 'same-origin'` → `` `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}` `` ;
        sinon comportement actuel (valeur explicite, ou `localhost` → port 2567, ou vide = en ligne désactivé).
        `API_URL` en découle déjà (`apiUrl(SERVER_URL)`).
  - [x] Test unitaire de la déduction (fonction pure prenant `env` et `location`).
- [x] **Client : bandeau de déménagement** — `ui/Home.tsx` (AC 5)
  - [x] Si `import.meta.env.VITE_MOVED_TO` est défini : bandeau en tête de l'accueil (style parchemin existant, cible
        de 44 px), lien qui garde `?salle=`. Rien sinon.
- [x] **Image Docker** — `Dockerfile` (AC 3, 4)
  - [x] Copier aussi `apps/client` (sans `node_modules` ni `dist`) ; installer avec
        `pnpm install --frozen-lockfile --filter @cinecards/server... --filter @cinecards/client...` ;
        `VITE_SERVER_URL=same-origin pnpm --filter @cinecards/client build` ; `ENV CLIENT_DIR=/app/apps/client/dist`.
        Garder `node:24-alpine`, le `HEALTHCHECK` et le `CMD` actuels. Vérifier que `.dockerignore` (créer s'il manque)
        exclut `node_modules`, `**/dist`, `test-results`, `.claude`, `_bmad-output`.
  - [x] Si Docker n'est pas disponible dans l'environnement de dev, simuler l'image : `pnpm --filter @cinecards/client
        build` avec `VITE_SERVER_URL=same-origin`, puis `CLIENT_DIR=apps/client/dist DATA_DIR=<tmp> PORT=<p> pnpm
        --filter @cinecards/server start`, et vérifier dans Chromium (Playwright) : l'accueil s'affiche, un duel en ligne
        se crée et un second contexte le rejoint par code, un compte se crée, l'API répond sans CORS (même origine).
        Joindre deux captures (390×844) sous `_bmad-output/implementation-artifacts/screens/8-6/`.
- [x] **Origines et Pages** (AC 4, 5, 7)
  - [x] `DEFAULT_CLIENT_ORIGINS` (`apps/server/src/api/http.ts`) = `['https://cinecards.sevend.io',
        'https://seven74ai.github.io']`.
  - [x] `.github/workflows/pages.yml` : ajouter `VITE_MOVED_TO: https://cinecards.sevend.io` (garder
        `VITE_PASSKEYS: 'off'`).
- [x] **Documentation** (AC 3)
  - [x] `docs/deploy.md` : le jeu est servi par le serveur (`CLIENT_DIR`), adresse `https://cinecards.sevend.io/` ;
        GitHub Pages devient l'ancien site (bandeau) ; tableau des variables (`CLIENT_DIR`, `CLIENT_ORIGINS`).
  - [x] `AGENTS.md` : section « Ship » — le jeu se déploie avec le serveur (autodeploy) ; relancer Pages seulement pour
        l'ancien site. `HANDOFF-CLAUDE.md` : adresse du jeu.
  - [x] `a-valider-par-root.md` (section « Epics 8 et 10 ») : bandeau sans redirection automatique ; Pages gardé pendant
        la transition ; reconnexion de compte attendue après le déménagement.

## Dev Notes

### Pourquoi
- Décision de Root (2026-11-22) : le jeu passe sur un sous-domaine de son VPS, « cinecards » pour l'instant. Une clé
  d'accès est liée au domaine de la page (rpID = hôte du client, story 8.2) : il faut déménager **avant** que des clés
  existent. ADR-009 dans `_bmad-output/game-architecture.md`.
- Même origine pour la page, l'API et le WebSocket : plus de CORS pour le jeu lui-même, plus de décalage de version
  client / serveur (AGENTS.md demandait une compatibilité d'une version à cause de ce décalage ; elle reste utile pour
  l'ancien site pendant la transition).
- Aucun changement DNS ni tunnel : `cinecards.sevend.io` → `http://localhost:2567` existe déjà (Cloudflare Tunnel,
  `docs/deploy.md`). Cloudflare compresse les réponses : pas de gzip à coder.

### État actuel (à préserver)
- `apps/server/src/main.ts` : `startServer(port, contentDir, opts)` ; `httpServer.emit` surchargé : `/health` (texte
  `ok`, utilisé par le `HEALTHCHECK` Docker et `autodeploy.sh`), puis `createApi(...)` pour `/api/*`, puis Colyseus.
  Fermeture de la base dans `server.onShutdown`.
- `apps/server/src/api/http.ts` : `createApi`, `originAllowed`, `relyingParty` (8.2 : rpID = hôte de l'origine
  autorisée). Sur le nouveau site, l'origine est `https://cinecards.sevend.io` : elle doit être dans la liste par défaut.
- `apps/client/vite.config.ts` : `base: './'` (chemins relatifs) : le même build marche sous `/cinecards/` (Pages) et
  à la racine (VPS). Ne pas changer.
- `apps/client/src/net/config.ts` : `SERVER_URL` = `VITE_SERVER_URL ?? (localhost ? ws://host:2567 : '')`.
- `apps/client/src/account/passkeys.ts` : `PASSKEYS_ENABLED` = `VITE_PASSKEYS !== 'off'` (coupé dans `pages.yml`).
- `Dockerfile` : `node:24-alpine`, copie `packages`, `apps/server`, `content/sets`, installe le filtre serveur,
  `CMD node --experimental-transform-types --no-warnings apps/server/src/main.ts`, `DATA_DIR=/app/data` (8.1).
- `deploy/docker-compose.yml` : volume `cinecards-data` (ne pas toucher), port `127.0.0.1:2567`.
- `e2e` : `playwright.config.ts` lance le serveur et Vite séparément avec `VITE_SERVER_URL=ws://localhost:<port>` :
  inchangé (AC 8).

### Risques
- Le build du client dans l'image doit réussir sur le VPS (mémoire) : le build Vite actuel prend < 1 s, sans risque.
- Si l'image ne se construit pas, `autodeploy.sh` garde l'ancien conteneur et signale l'échec de santé : vérifier
  `https://cinecards.sevend.io/` et `/health` après livraison.

### Tests et définition de fini
- `pnpm typecheck`, `pnpm test`, `PW_CHANNEL=chromium pnpm e2e -- --trace off` (ports dédiés) + la vérification
  « image simulée » ci-dessus. Pas de moteur ni de cartes touchés.

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.6]
- [Source: _bmad-output/game-architecture.md#ADR-009, Decision Summary (Client hosting)]
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-11-22-epics-8-10.md#Addendum]
- [Source: docs/deploy.md] (tunnel Cloudflare, autodeploy)
- [Source: _bmad-output/implementation-artifacts/8-2-cle-d-acces-et-code-de-secours.md] (rpID, `VITE_PASSKEYS`)

## Dev Agent Record

### Agent Model Used

Agent de développement (Claude Code)

### Debug Log References

### Debug Log

- Premier `docker build` : échec à `pnpm install` (certificat du proxy de l'environnement de dev, `SELF_SIGNED_CERT_IN_CHAIN`),
  sans rapport avec le Dockerfile. Reconstruit avec une copie de test du Dockerfile qui ajoute seulement le certificat
  du proxy (`--build-context`, `NODE_EXTRA_CA_CERTS`, `--network host`) : image construite, client compris.
- e2e complète : 39/40, `play-draw` (animation sensible à la charge) en échec une fois ; relancée seule : 2/2 vertes.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- **Serveur** : `apps/server/src/static.ts` (`createStatic(clientDir)`, même style que `createApi`), branché dans
  `main.ts` après `/health` et `/api/*`, avant Colyseus (option `clientDir`, défaut `CLIENT_DIR`). GET/HEAD seulement,
  jamais une requête `upgrade` ; `/health`, `/api/*`, `/matchmake/*` et `/__*` (routes internes de Colyseus, ex.
  `/__healthcheck`) sont laissés au serveur. Décodage dans un `try`, octet nul refusé, `path.resolve` + vérification du
  préfixe `clientDir + sep`, `createReadStream`, `Content-Length` depuis `stat`. Cache : `.html` en `no-cache`,
  `assets/*` en `immutable` 1 an, autres fichiers 1 h. `nosniff` + `Referrer-Policy: same-origin`. Inerte sans dossier
  ou sans `index.html`.
- **Client** : `serverUrl(value, location)` pure dans `net/config.ts` (`same-origin` → `ws(s)://<hôte>`) ;
  `movedUrl(movedTo, search)` + bandeau `.moved-banner` en tête de l'accueil (`VITE_MOVED_TO`), bouton « Y aller » de
  44 px qui garde `?salle=CODE` (code limité à 8 caractères alphanumériques, mis en majuscules).
- **Origines** : `DEFAULT_CLIENT_ORIGINS` = `cinecards.sevend.io` + `seven74ai.github.io`. `pages.yml` : `VITE_MOVED_TO`.
- **Dockerfile** : copie `apps/client`, tout `content/` (le client importe `content/art`) et le glossaire
  `_bmad-output/planning-artifacts/glossaire-mots-cles.md` (importé par `game/glossary.ts`, non prévu par la story :
  sans lui le build du client échoue). `.dockerignore` réécrit : `apps/client` n'est plus exclu ; `_bmad-output` exclu
  sauf ce glossaire ; ajout de `.claude`, `.git`, `**/test-results`, `playwright-report`.
- **Vérification de l'image (Docker réel, pas seulement simulé)** : conteneur lancé (`-p 127.0.0.1:2687:2567`), état
  `healthy` ; `/health` = `ok`, `/` = `text/html` `no-cache` + en-têtes de sécurité, `/api/health` OK. Playwright
  Chromium 390×844 : accueil affiché, compte créé (code de secours), duel en ligne créé puis rejoint par code depuis un
  second contexte, l'adversaire voit le pseudo du compte ; WebSocket `ws://localhost:2687` et appels `/api/*` sur la
  même origine, aucune requête vers un autre hôte (hors Google Fonts, déjà présentes). Build « Pages » simulé
  (`VITE_MOVED_TO`, `VITE_PASSKEYS=off`) : bandeau visible, lien `https://cinecards.sevend.io/?salle=AB12C`.
  Captures : `screens/8-6/01-accueil-cinecards-sevend-io.png`, `02-duel-en-ligne-meme-origine.png`,
  `03-ancien-site-bandeau.png`.
- **Tests** : `static.test.ts` (7 tests : types MIME, cache, HEAD, repli `index.html`, 404, traversée `..`/`%2e%2e`/
  `%00`/encodage invalide, `/health`, `/api`, `/matchmake`, `/__healthcheck`, POST, inerte sans dossier) ;
  `config.test.ts` (4 tests : déduction de l'adresse, lien du bandeau). `pnpm typecheck` OK, `pnpm test` 208/208.
- Choix ajoutés à `a-valider-par-root.md` (section Epics 8 et 10) : bandeau sans redirection, Pages gardé, reconnexion
  attendue, règles de repli/404/cache.

### File List

- `apps/server/src/static.ts` (nouveau)
- `apps/server/src/static.test.ts` (nouveau)
- `apps/server/src/main.ts`
- `apps/server/src/api/http.ts`
- `apps/server/src/accounts.test.ts`
- `apps/client/src/net/config.ts`
- `apps/client/src/net/config.test.ts` (nouveau)
- `apps/client/src/ui/Home.tsx`
- `apps/client/src/styles.css`
- `Dockerfile`
- `.dockerignore`
- `.github/workflows/pages.yml`
- `docs/deploy.md`
- `AGENTS.md`
- `HANDOFF-CLAUDE.md`
- `_bmad-output/implementation-artifacts/a-valider-par-root.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/8-6-heberger-le-jeu-sur-cinecards-sevend-io.md`
- `_bmad-output/implementation-artifacts/screens/8-6/01-accueil-cinecards-sevend-io.png` (nouveau)
- `_bmad-output/implementation-artifacts/screens/8-6/02-duel-en-ligne-meme-origine.png` (nouveau)
- `_bmad-output/implementation-artifacts/screens/8-6/03-ancien-site-bandeau.png` (nouveau)

### Change Log

- 2026-11-22 : le serveur sert le jeu (`CLIENT_DIR`), client en même origine (`VITE_SERVER_URL=same-origin`), bandeau
  de déménagement sur Pages (`VITE_MOVED_TO`), image Docker client + serveur, origines par défaut, documentation.
  Statut : review.
