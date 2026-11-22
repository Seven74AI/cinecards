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

Chrono : 75 s par tour, 5 s pour une réaction, 90 s pour revenir après une déconnexion
(sinon défaite). Ces valeurs sont dans `packages/engine/src/rules.ts`.

## Mise à jour automatique du serveur

Sur le VPS, un minuteur systemd (`deploy/systemd/cinecards-autodeploy.timer`) lance
`deploy/autodeploy.sh` toutes les 5 minutes. Le script récupère `main` et ne reconstruit le
serveur que si le commit a changé, puis vérifie `/health`. L'installation est décrite dans
`HANDOFF-HERMES.md`. Pour suspendre les mises à jour : `systemctl stop cinecards-autodeploy.timer`.

Les push sur `main` ne déclenchent pas GitHub Actions pour l'instant : lancer le workflow
« Deploy client to GitHub Pages » à la main (onglet Actions → Run workflow).
