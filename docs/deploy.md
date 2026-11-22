# Mettre CineCards en ligne

Deux morceaux :

1. **Le site** (le jeu dans le navigateur) — hébergé gratuitement sur **GitHub Pages**.
2. **Le serveur de duel** (pour jouer à distance) — sur **ton VPS**, avec Docker.

Le jeu local (deux joueurs sur un téléphone, ou contre le Grimoire) marche sans serveur.

## 1. Le serveur sur le VPS

Prérequis : Docker et Docker Compose installés, un sous-domaine (par ex. `cinecards.tondomaine.fr`)
qui pointe vers l'IP du VPS (enregistrement DNS de type A), ports 80 et 443 ouverts.

```bash
git clone <ton dépôt> cinecards
cd cinecards/deploy
DOMAIN=cinecards.tondomaine.fr docker compose up -d --build
```

Caddy obtient le certificat HTTPS tout seul. Vérification :

```bash
curl https://cinecards.tondomaine.fr/health   # répond "ok"
```

Mise à jour après des changements : `git pull && DOMAIN=... docker compose up -d --build`.

## 2. Le site sur GitHub Pages

1. Pousse le dépôt sur GitHub (branche `main`).
2. *Settings → Pages → Build and deployment → Source* : **GitHub Actions**.
3. *Settings → Secrets and variables → Actions → Variables* : crée la variable
   `CINECARDS_SERVER_URL` = `wss://cinecards.tondomaine.fr`.
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
