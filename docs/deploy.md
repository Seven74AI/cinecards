# Mettre CineCards en ligne

Le jeu est à l'adresse **https://cinecards.sevend.io/**. Tout tient dans **un seul conteneur Docker
sur ton VPS** : le serveur de duel sert aussi les fichiers du jeu (story 8.6). La page, l'API des
comptes (`/api`) et les duels en ligne (`wss://`) ont donc la même adresse : les clés d'accès sont
liées à ce domaine, et le jeu et le serveur se mettent à jour ensemble.

L'ancien site **GitHub Pages** (`seven74ai.github.io/cinecards`) reste en ligne pendant la
transition, avec un bandeau « CineCards a déménagé » (voir plus bas).

## 1. Le serveur sur le VPS

Prérequis : Docker et Docker Compose installés. Le serveur est exposé via le **Cloudflare Tunnel**
`sevend-io-stream` (pas de port public, pas de Caddy) : la route `cinecards.sevend.io` →
`http://localhost:2567` est configurée dans le tunnel, et le conteneur publie `127.0.0.1:2567` en
loopback uniquement. HTTPS/WSS se terminent au edge Cloudflare.

```bash
git clone <ton dépôt> cinecards
cd cinecards/deploy
docker compose up -d --build
```

L'image construit le client (`VITE_SERVER_URL=same-origin` : le jeu se connecte au serveur de la
même adresse) et le serveur, qui sert ce client grâce à `CLIENT_DIR=/app/apps/client/dist`.

Vérification :

```bash
curl http://localhost:2567/health   # sur le VPS, répond "ok" (l'adresse publique est derrière Cloudflare Access)
curl -I https://cinecards.sevend.io/      # 200, text/html : le jeu
```

Mise à jour après des changements : `git pull && docker compose up -d --build`.

## 2. L'ancien site sur GitHub Pages

Le build Pages (`pages.yml`) garde le jeu jouable, sans clés d'accès (`VITE_PASSKEYS=off`), avec un
bandeau en haut de l'accueil vers la nouvelle adresse (`VITE_MOVED_TO=https://cinecards.sevend.io`,
le code d'invitation `?salle=` est conservé). Les comptes ne suivent pas d'un site à l'autre sur
l'appareil : on se reconnecte une fois sur le nouveau site.

1. Pousse le dépôt sur GitHub (branche `main`).
2. *Settings → Pages → Build and deployment → Source* : **GitHub Actions**.
3. *Settings → Secrets and variables → Actions → Variables* : crée la variable
   `CINECARDS_SERVER_URL` = `wss://cinecards.sevend.io`.
4. Chaque push sur `main` reconstruit le site (workflow `pages.yml`).

Sans la variable, le site fonctionne mais l'onglet « En ligne » est désactivé.

## En local (développement)

```bash
pnpm install
pnpm dev:server      # serveur sur ws://localhost:2567
pnpm dev:client      # site sur http://localhost:5173 (Vite ; CLIENT_DIR n'est pas utilisé en dev)
pnpm test            # tests unitaires (moteur, cartes, serveur)
pnpm e2e             # duel complet avec deux navigateurs
```

## Réglages du serveur

| Variable | Défaut | Rôle |
|---|---|---|
| `PORT` | 2567 | port d'écoute |
| `CONTENT_DIR` | `content/sets` | dossier des cartes JSON |
| `DATA_DIR` | `./data` (`/app/data` dans Docker) | dossier de la base des comptes (`cinecards.db`) et de ses copies |
| `CLIENT_ORIGINS` | `https://cinecards.sevend.io,https://seven74ai.github.io` | sites autorisés à appeler `/api/*` (liste séparée par des virgules ; `http://localhost:*` est toujours permis) |
| `CLIENT_DIR` | aucun (`/app/apps/client/dist` dans Docker) | dossier du client construit, servi à `/` ; sans lui, le serveur ne sert aucun fichier du jeu |

Côté client (au build) : `VITE_SERVER_URL` (adresse `wss://…` du serveur, ou `same-origin` pour celui
de la même adresse que la page), `VITE_PASSKEYS=off` (pas de clés d'accès), `VITE_MOVED_TO` (bandeau
de déménagement).

## Comptes et base de données

Les comptes (pseudo, mot de passe haché, sessions) sont dans un fichier SQLite,
`/app/data/cinecards.db`, sur le volume Docker nommé `cinecards-data` : ils survivent à un
redémarrage et à une reconstruction (`docker compose up -d --build`).

Le serveur en fait une copie par jour dans `/app/data/backups/cinecards-AAAA-MM-JJ.db` et garde
les 7 dernières. Pour récupérer une copie sur le VPS :

```bash
cd cinecards/deploy
docker compose exec server ls /app/data/backups
docker compose cp server:/app/data/backups/cinecards-2026-11-22.db ./
```

Pour restaurer : arrêter le serveur (`docker compose stop server`), copier la sauvegarde à la place
de la base (`docker compose cp ./cinecards-2026-11-22.db server:/app/data/cinecards.db`, puis supprimer
`cinecards.db-wal` et `cinecards.db-shm` s'ils existent), relancer (`docker compose start server`).

⚠️ Ne pas faire `docker compose down -v` : l'option `-v` supprime le volume, donc tous les comptes.
`docker compose down` (sans `-v`) ne touche pas aux données.

Vérification : `curl https://cinecards.sevend.io/api/health` répond `{"ok":true,"accounts":true}`.

Chrono : 75 s par tour, 5 s pour une réaction, 90 s pour revenir après une déconnexion
(sinon défaite). Ces valeurs sont dans `packages/engine/src/rules.ts`.

## Mise à jour automatique (jeu et serveur)

Sur le VPS, un minuteur systemd (`deploy/systemd/cinecards-autodeploy.timer`) lance
`deploy/autodeploy.sh` toutes les 5 minutes. Le script récupère `main` et ne reconstruit le
serveur (et donc le jeu) que si le commit a changé, puis vérifie `http://localhost:2567/health` sur le VPS (l'adresse publique est derrière Cloudflare Access depuis le 2026-11-23). L'installation est décrite dans
`HANDOFF-HERMES.md`. Pour suspendre les mises à jour : `systemctl stop cinecards-autodeploy.timer`.

Les push sur `main` ne déclenchent pas GitHub Actions pour l'instant : pour mettre à jour l'ancien
site, lancer le workflow « Deploy client to GitHub Pages » à la main (onglet Actions → Run workflow).
