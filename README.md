# CineCards (titre provisoire)

Adaptation en ligne du jeu de cartes papier de Root : duels de cartes de films, thème « grimoire ».
Code en anglais, textes du jeu en français.

```bash
pnpm install
pnpm dev:client  # le jeu : http://localhost:5173 (duel local ou contre le Grimoire)
pnpm dev:server  # serveur en ligne : ws://localhost:2567
pnpm test        # moteur, cartes, serveur, client (77 tests)
pnpm typecheck
pnpm e2e         # duel en ligne complet avec deux navigateurs
```

- `packages/engine` — moteur de règles pur et déterministe, système d'effets, bot
- `packages/cards` — schéma et chargement des cartes (`content/sets/*.json`)
- `packages/protocol` — messages partagés client/serveur
- `apps/server` — serveur de duel (Colyseus) : salles par code, vues masquées, chrono, reconnexion
- `apps/client` — le jeu dans le navigateur (React + Vite), mobile d'abord
- `content/` — cartes et illustrations
- `docs/deploy.md` — mise en ligne (GitHub Pages + VPS) · `docs/simulation-report.md`

Planification BMAD : `_bmad-output/` (brief, GDD, architecture, epics, sprint-status, notes d'implémentation).
