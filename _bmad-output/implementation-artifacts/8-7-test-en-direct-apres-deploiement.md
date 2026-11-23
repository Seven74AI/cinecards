# Story 8.7: Test en direct après chaque déploiement

Status: ready-for-dev

## Story

As a Root,
I want que chaque déploiement soit vérifié de bout en bout sur le vrai serveur,
so that une régression en ligne (comptes, amis, invitations, duel, émotes, decks) se voie sans que je teste moi-même.

## Contexte

Rétrospective des epics 8 et 10 (`epic-8-retro-2026-11-23.md`, constat 9 et question ouverte) et demande de Root du
2026-11-23 (« réparer le test en direct derrière Cloudflare Access »). Depuis Cloudflare Access, le conteneur de
développement passe en HTTP (jeton de service) mais le proxy de session **perd la mise à niveau WebSocket** pour
`cinecards.sevend.io` (vérifié : la requête arrive au serveur sans `Upgrade` et reçoit l'accueil en 200, alors que le
même proxy fait 101 vers d'autres sites). Ouvrir Access à l'adresse sortante du conteneur est exclu (adresses Google
Cloud partagées et variables). Solution : le test tourne **sur le VPS**, dans le conteneur du jeu, contre
`http://localhost:2567`, après chaque déploiement, et son résultat est lisible en HTTP.

## Acceptance Criteria

1. **Script de fumée** `scripts/smoke.mjs` (Node, sans navigateur : `@colyseus/sdk` + `fetch`), lancé avec
   `SMOKE_URL` (défaut `http://localhost:2567`). Il vérifie dans l'ordre, chaque étape chronométrée :
   `/health` ; deux comptes de test **fixes** (`ZZ-fumee-a`, `ZZ-fumee-b`, mot de passe aléatoire gardé dans
   `DATA_DIR/smoke-accounts.json`, créés au premier passage puis réutilisés : pas d'accumulation de comptes) ;
   amitié entre eux (créée si absente) ; présence via la salle `hub` ; invitation de A vers B reçue en direct par B ;
   B rejoint, le duel démarre (vues reçues par les deux) ; une émote de A reçue par B ; abandon de B ; l'historique de A
   contient la partie ; un deck valide par compte (créé si absent, 50 cartes jouables) puis une salle « Decks
   construits » où les deux decks sont acceptés et la partie démarre, puis abandon.
2. **Résultat** écrit dans `DATA_DIR/smoke.json` : `{ ok, commit, startedAt, durationMs, steps: [{ name, ok, ms,
   error? }] }` ; le script sort en code 0 si tout passe, 1 sinon. Délai global 60 s ; une étape qui échoue arrête
   la suite et nettoie (quitte les salles).
3. **Lisible depuis l'extérieur** : `GET /api/smoke` renvoie le contenu de `smoke.json` (ou `404` s'il n'existe pas) ;
   rien de secret dedans (pas de mot de passe ni de jeton).
4. **Lancé après chaque déploiement** : `deploy/autodeploy.sh`, une fois `/health` au vert, exécute
   `docker compose exec -T server node --experimental-transform-types --no-warnings scripts/smoke.mjs` (ou équivalent)
   et journalise `cinecards: smoke OK` ou `cinecards: smoke FAILED (étape)`. Un échec du test **n'annule pas** le
   déploiement (il le signale) ; l'image contient le script (`Dockerfile` : `COPY scripts/smoke.mjs`).
5. **Les comptes de fumée ne gênent pas les joueurs** : pseudos préfixés `ZZ-`, ils ne font pas de demandes d'ami à
   d'autres comptes, et leurs parties n'apparaissent que dans leur propre historique.
6. **Exécutable en local** : `pnpm smoke` (script racine) contre un serveur lancé localement ; un test (`vitest`) lance
   le serveur en mémoire et exécute le script de bout en bout.

## Tasks / Subtasks

- [ ] `scripts/smoke.mjs` (AC 1, 2, 5) — réutiliser les messages et routes existants (`packages/protocol`,
      `/api/accounts`, `/api/sessions`, `/api/friends`, `/api/decks`, salles `duel` et `hub`) ; le SDK Colyseus en Node
      fonctionne (déjà utilisé par `apps/server/src/server.test.ts`).
- [ ] Route `GET /api/smoke` (`apps/server/src/api/http.ts`) (AC 3).
- [ ] `deploy/autodeploy.sh` + `Dockerfile` + `docs/deploy.md` (AC 4) ; script racine `smoke` dans `package.json`.
- [ ] Test vitest de bout en bout du script contre `startServer` en mémoire (AC 6).
- [ ] `HANDOFF-CLAUDE.md` : lire `https://cinecards.sevend.io/api/smoke` (avec l'en-tête `CF-Access-Client-Id`) pour
      vérifier un déploiement.

## Dev Notes

- `autodeploy.sh` est enveloppé dans `main()` (bash lit tout le fichier avant le `git merge`) : garder cette forme.
  Le contrôle de santé est déjà local (`http://localhost:2567/health`, commit `4b82630`).
- Le conteneur a les dépendances de développement (`pnpm install --prod=false`), donc `@colyseus/sdk`.
- Le serveur tourne avec `DATA_DIR=/app/data` (volume) : `smoke.json` et `smoke-accounts.json` y vivent.
- Définition de fini : `pnpm typecheck`, `pnpm test`, `PW_CHANNEL=chromium pnpm e2e -- --trace off` (ports dédiés).
  Après livraison : lire `/api/smoke` en direct (le VPS se met à jour en ~5 min).

### References
- [Source: _bmad-output/implementation-artifacts/epic-8-retro-2026-11-23.md]
- [Source: deploy/autodeploy.sh, Dockerfile, docs/deploy.md]
- [Source: AGENTS.md]

## Dev Agent Record

### Completion Notes List

- Story créée à partir de la rétrospective et de la demande de Root (2026-11-23).

### File List
