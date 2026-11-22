# Mettre CineCards en ligne

Deux morceaux :

1. **Le site** (le jeu dans le navigateur) — hébergé gratuitement sur **GitHub Pages**.
2. **Le serveur de duel** (pour jouer à distance) — sur **ton VPS**, avec Docker.

Le jeu local (deux joueurs sur un téléphone, ou contre le Grimoire) marche sans serveur.

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

Vérification :

```bash
curl https://cinecards.sevend.io/health   # répond "ok"
```

Mise à jour après des changements : `git pull && docker compose up -d --build`.

## 2. Le site sur GitHub Pages

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
pnpm dev:client      # site sur http://localhost:5173
pnpm test            # tests unitaires (moteur, cartes, serveur)
pnpm e2e             # duel complet avec deux navigateurs
```

## Réglages du serveur

| Variable | Défaut | Rôle |
|---|---|---|
| `PORT` | 2567 | port d'écoute |
| `CONTENT_DIR` | `content/sets` | dossier des cartes JSON |
| `DATA_DIR` | `./data` (`/app/data` dans Docker) | dossier de la base des comptes (`cinecards.db`) et de ses copies |
| `CLIENT_ORIGINS` | `https://seven74ai.github.io` | sites autorisés à appeler `/api/*` (liste séparée par des virgules ; `http://localhost:*` est toujours permis) |

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

## Mise à jour automatique du serveur

Sur le VPS, un minuteur systemd (`deploy/systemd/cinecards-autodeploy.timer`) lance
`deploy/autodeploy.sh` toutes les 5 minutes. Le script récupère `main` et ne reconstruit le
serveur que si le commit a changé, puis vérifie `/health`. L'installation est décrite dans
`HANDOFF-HERMES.md`. Pour suspendre les mises à jour : `systemctl stop cinecards-autodeploy.timer`.

Les push sur `main` ne déclenchent pas GitHub Actions pour l'instant : lancer le workflow
« Deploy client to GitHub Pages » à la main (onglet Actions → Run workflow).
