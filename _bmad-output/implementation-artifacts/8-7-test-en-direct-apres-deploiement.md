---
baseline_commit: d69c65d6bd3dd8b3c6c8ef98e103a2c4becd8346
---

# Story 8.7: Test en direct après chaque déploiement

Status: done

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

- [x] `scripts/smoke.mjs` (AC 1, 2, 5) — réutiliser les messages et routes existants (`packages/protocol`,
      `/api/accounts`, `/api/sessions`, `/api/friends`, `/api/decks`, salles `duel` et `hub`) ; le SDK Colyseus en Node
      fonctionne (déjà utilisé par `apps/server/src/server.test.ts`).
- [x] Route `GET /api/smoke` (`apps/server/src/api/http.ts`) (AC 3).
- [x] `deploy/autodeploy.sh` + `Dockerfile` + `docs/deploy.md` (AC 4) ; script racine `smoke` dans `package.json`.
- [x] Test vitest de bout en bout du script contre `startServer` en mémoire (AC 6).
- [x] `HANDOFF-CLAUDE.md` : lire `https://cinecards.sevend.io/api/smoke` (avec l'en-tête `CF-Access-Client-Id`) pour
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

### Debug Log

- Le script est à la racine (`scripts/`), dont les `node_modules` n'ont pas les paquets du serveur (et l'image Docker
  n'installe que les paquets filtrés) : `@colyseus/sdk`, `@cinecards/engine` et `@cinecards/cards/node` sont résolus
  avec `createRequire(apps/server/package.json)`. Les sources TypeScript du moteur demandent
  `--experimental-transform-types` (déjà dans la commande de l'AC 4 et dans `pnpm smoke`).
- Docker : le client est présent dans ce conteneur de développement mais pas le démon (`/var/run/docker.sock`
  absent, lancer `dockerd` refusé) : l'image n'a pas pu être construite ici. Le script a été lancé à la main contre un
  vrai serveur local (`DATA_DIR` sur disque, port 2687) : 11 étapes OK en 769 ms, `smoke-accounts.json` en 600.
- `bash -n deploy/autodeploy.sh` OK ; la fonction `smoke` a été essayée avec un faux `docker` (succès, échec avec
  étape, échec sans résultat) sous `set -euo pipefail` : le script continue et sort en 0 dans les trois cas.

### Completion Notes List

- Story créée à partir de la rétrospective et de la demande de Root (2026-11-23).
- `scripts/smoke.mjs` : 11 étapes chronométrées (`health`, `accounts`, `friends`, `presence`, `invite`, `duel`,
  `emote`, `concede`, `history`, `decks`, `constructed`) ; délai global 60 s (`SMOKE_TIMEOUT_MS`), 10 s par attente ;
  la première étape en échec arrête la suite ; nettoyage : quitte toutes les salles et ferme les deux sessions.
  Résultat `DATA_DIR/smoke.json` écrit de façon atomique (fichier temporaire puis renommage) ; mots de passe aléatoires
  dans `DATA_DIR/smoke-accounts.json` (600), écrits avant la création des comptes. Le commit vient de `SMOKE_COMMIT`
  (passé par autodeploy), sinon `git rev-parse HEAD`, sinon `null`. Dernière ligne : `smoke OK (…)` ou
  `smoke FAILED (étape: raison)`.
- Route `GET /api/smoke` : renvoie `smoke.json` ou `404` ; le fichier est donné par `ServerOptions.smokeFile`
  (défaut `DATA_DIR/smoke.json`, aucun pour `:memory:`).
- `deploy/autodeploy.sh` (toujours dans `main()`) : après `/health`, `timeout 90 docker compose exec -T -e
  SMOKE_COMMIT=… server node … scripts/smoke.mjs` ; journalise `cinecards: smoke OK on <sha>` ou
  `cinecards: smoke FAILED (<étape>: <raison>) on <sha>` (avec le détail des étapes) ; jamais d'annulation, sortie 0.
- `Dockerfile` : `COPY scripts/smoke.mjs` après le build du client (le cache de l'installation est gardé).
- `apps/server/src/smoke.test.ts` : serveur en mémoire (`:memory:` + `smokeFile` dans un dossier temporaire), le
  script lancé deux fois en processus enfant (comptes, amitié et deck réutilisés : 1 ami, 1 deck, 4 parties toutes
  contre `ZZ-fumee-b`), `/api/smoke` 404 puis 200 sans mot de passe ni jeton ; un passage contre un port fermé sort
  en 1 avec une seule étape `health` en échec.
- Choix de comportement notés dans `a-valider-par-root.md` (section « Story 8.7 (2026-11-23) »).
- Tests : `pnpm typecheck` OK ; `pnpm test` 38 fichiers, 278 tests OK ; `E2E_SERVER_PORT=2677 E2E_CLIENT_PORT=5284
  PW_CHANNEL=chromium pnpm e2e -- --trace off` 49 passed. Moteur et cartes non touchés : pas de simulation de 200 parties.
- Après livraison : lire `https://cinecards.sevend.io/api/smoke` (en-têtes Cloudflare Access) une fois le VPS à jour.

### File List

- `scripts/smoke.mjs` (nouveau)
- `apps/server/src/smoke.test.ts` (nouveau)
- `apps/server/src/api/http.ts`
- `apps/server/src/main.ts`
- `deploy/autodeploy.sh`
- `Dockerfile`
- `docs/deploy.md`
- `package.json`
- `HANDOFF-CLAUDE.md`
- `_bmad-output/implementation-artifacts/a-valider-par-root.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/8-7-test-en-direct-apres-deploiement.md`

### Change Log

- 2026-11-23 : test en direct après chaque déploiement (script de fumée, `GET /api/smoke`, autodeploy, test vitest de
  bout en bout) ; statut → review.
- 2026-11-23 — Revue : script et autodeploy relus (échec signalé sans retour arrière, `main()` gardé), typecheck, 278 tests, e2e 49/49 (agent). Non vérifié dans l'image Docker (pas de démon ici) : le premier passage sur le VPS fait foi via `/api/smoke`. Story terminée.
