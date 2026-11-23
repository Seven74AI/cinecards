---
baseline_commit: 45f6c030581110b7c511d39d2330c02a7f5e9e9e
---
# Story 8.4: Historique

Status: done

## Story

As a joueur,
I want voir mes dernières parties,
so that je suive mes résultats.

## Acceptance Criteria

1. **Enregistrement.** Chaque partie **en ligne** terminée où au moins un joueur est connecté à son compte est
   enregistrée par le serveur pour chaque joueur connecté : adversaire (pseudo, et son compte s'il en a un ; sinon
   « Invité » suivi du pseudo saisi), résultat de mon point de vue, mode de pioche, nombre de tours, date et durée.
2. **Résultats.** `victoire`, `défaite`, `nulle` (double K.O.), `abandon` (j'ai abandonné), `abandon adverse`
   (l'autre a abandonné, ou n'est pas revenu dans les 90 s : affiché « Victoire · abandon adverse »). Le résultat vient
   de l'état final du moteur (`winner`, événement `conceded`), jamais du client.
3. **Écran « Historique ».** Depuis l'accueil, connecté : bouton « Historique » à côté de « Amis ». Il montre mon
   **bilan** (victoires, défaites, nulles ; abandons comptés dans victoires / défaites) et les **20 dernières
   parties**, de la plus récente à la plus ancienne : résultat (pastille de couleur + mot), adversaire, mode
   (« Pioche commune » / « Decks aléatoires »), date relative en français (« il y a 5 min », « hier », sinon
   « 12 nov. ») et nombre de tours. État vide : « Aucune partie en ligne pour l'instant. »
4. **Pas pendant la partie.** Une partie interrompue sans fin (salle détruite sans vainqueur, cas anormal) n'est pas
   enregistrée. Une partie solo ou hot seat n'est pas enregistrée (le serveur n'en est pas l'arbitre).
5. **Compatibilité.** Route et migration nouvelles seulement ; bouton caché si `/api/health` n'a pas `history: true`.

## Tasks / Subtasks

- [x] **Base** — prochaine migration ajoutée à `MIGRATIONS` (`apps/server/src/db/db.ts`) après celles de 8.1, 8.2 et
      8.3 ; ne jamais modifier une migration livrée (AC 1)
  - [x] `games(id INTEGER PRIMARY KEY, mode TEXT NOT NULL, turns INTEGER NOT NULL, started_at INTEGER NOT NULL,
        ended_at INTEGER NOT NULL)` et `game_players(game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
        seat INTEGER NOT NULL, account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL, nickname TEXT NOT NULL,
        result TEXT NOT NULL CHECK(result IN ('win','loss','draw','conceded','opponent_conceded')), PRIMARY KEY
        (game_id, seat))` + index `(account_id, game_id DESC)`.
  - [x] `apps/server/src/db/games.ts` : `recordGame(...)` (une transaction), `recentGames(accountId, 20)`,
        `record(accountId)` (bilan).
  - [x] Test : migration depuis la version précédente sans perte.
- [x] **Serveur** (AC 1, 2, 4)
  - [x] `apps/server/src/room.ts` / `duel.ts` : quand le duel passe à `finished` (une seule fois), si au moins un siège
        a un compte (`accounts[seat]`, 8.1), enregistrer la partie : `started_at` = début du duel, `turns` = somme
        des `turnNumber` des joueurs ou le compteur de tours du moteur, résultat par siège depuis `state.winner` et
        l'événement `conceded` (et le forfait de `holdSeat` après 90 s, qui passe par `duel.concede(seat)`).
        Le pseudo enregistré est celui du siège (`names[seat]`).
  - [x] Injection comme pour les comptes (`roomConfig`), pour que `server.test.ts` sans base continue de marcher.
  - [x] `GET /api/history` (Bearer) → `{ record: { wins, losses, draws }, games: [{ id, result, opponent: {
        nickname, isGuest }, mode, turns, endedAt, durationMs }] }` ; `/api/health` ajoute `history: true`.
- [x] **Client** (AC 3, 5)
  - [x] `apps/client/src/account/HistoryPanel.tsx` (portail dans `<body>`, comme `AccountPanel` / `FriendsPanel`) ;
        `api.ts` : `history(token)` ; dates relatives avec `Intl.RelativeTimeFormat('fr')` et
        `Intl.DateTimeFormat('fr', { day: 'numeric', month: 'short' })`.
  - [x] `ui/Home.tsx` : bouton « Historique » à côté de « Amis » (garder `.account-line` et « Connecté : <pseudo> »).
- [x] **Tests** (AC 1-5)
  - [x] Serveur `apps/server/src/history.test.ts` : via WebSocket (comme `server.test.ts`), deux comptes jouent jusqu'à
        un abandon → chacun a une ligne avec le bon résultat ; un compte contre un invité → une seule ligne, adversaire
        « invité » ; forfait après le délai de reconnexion (2 s en test) → `opponent_conceded` ; deux invités → rien ;
        bilan ; ordre et limite de 20.
  - [x] Client : formatage des dates relatives et des résultats.
  - [x] e2e `e2e/history.spec.ts` : deux comptes, une partie en ligne terminée par « Abandonner » ; l'historique de
        chacun montre le bon résultat et l'adversaire.

## Dev Notes

- Les parties se terminent dans le moteur (`state.phase === 'finished'`, `state.winner: PlayerId | 'draw'`) ; l'abandon
  émet `{ type: 'conceded', player }` (`packages/engine/src/apply.ts`). `Duel.finished` existe
  (`apps/server/src/duel.ts`). Le forfait après 90 s passe par `duel.concede(seat)` dans `holdSeat` (`room.ts`).
- `DuelRoom.accounts[seat]` (8.1) donne le compte de chaque siège ; 8.3 y ajoute la présence « en partie » : se brancher
  au même endroit (fin de partie) sans dupliquer la détection.
- Panneaux, `serverFeatures()` et boutons de l'accueil : suivre exactement le modèle livré par 8.2 / 8.3.
- Choix à noter dans `a-valider-par-root.md` : seulement les parties en ligne ; abandon compté dans le bilan comme
  victoire / défaite ; 20 parties affichées (toutes gardées en base).
- Définition de fini : `pnpm typecheck`, `pnpm test`, `PW_CHANNEL=chromium pnpm e2e -- --trace off` (ports dédiés).
  Pas de moteur ni de cartes touchés. Après livraison : vérifier une partie réelle entre deux comptes de test sur
  `https://cinecards.sevend.io`.

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.4]
- [Source: _bmad-output/implementation-artifacts/8-1-compte-avec-pseudo-et-mot-de-passe.md], [8-3-liste-d-amis-et-invitation-directe.md]
- [Source: AGENTS.md]

## Dev Agent Record

### Agent Model Used

Agent de dev (workflow `gds-dev-story`).

### Debug Log References

- `pnpm typecheck` : OK.
- `pnpm test` : 31 fichiers, 248 tests, tout vert.
- `E2E_SERVER_PORT=2667 E2E_CLIENT_PORT=5274 PW_CHANNEL=chromium pnpm e2e -- --trace off` : 42/42 (dont `history.spec.ts`).

### Completion Notes List

- Migration 4 ajoutée à `MIGRATIONS` (`games`, `game_players`, index `(account_id, game_id DESC)`), les trois
  migrations livrées sont intactes. Test de montée depuis une base version 3 (comptes, sessions, clés, amitiés) sans
  perte ; la suppression d'un compte garde l'historique de l'autre joueur (adversaire affiché comme invité).
- `db/games.ts` : `recordGame` (une transaction, rien ne reste si une ligne échoue), `recentGames(id, 20)`, `record(id)`.
- `Duel` (`duel.ts`) note `startedAt`, le siège de l'événement `conceded` (`concededBy`), `turns` (somme des
  `turnNumber`) et appelle `out.ended(duel)` une seule fois, au passage à `finished`, après l'envoi des vues.
  `DuelRoom.recordGame` (`room.ts`) transmet à `roomConfig.history` (injecté par `main.ts`, comme les comptes) si un
  siège au moins a un compte et que le moteur a un vainqueur ; le forfait de `holdSeat` passe par `duel.concede`, donc
  par le même chemin. Résultats par siège calculés par `seatResults(winner, concededBy)` depuis le moteur seul.
- `GET /api/history` (Bearer) → `{ record, games }` ; `/api/health` ajoute `history: true`.
- Client : `serverFeatures().history`, `useAccount().history`, `api.history(token)`, `HistoryPanel.tsx` (portail dans
  `<body>`), formatage dans `historyFormat.ts` (`Intl.RelativeTimeFormat('fr')`, `Intl.DateTimeFormat('fr')`).
  Bouton « Historique » à côté de « Amis » dans `.account-line`, tous deux sur une ligne `.account-social` sous
  « Connecté : <pseudo> » / « Se déconnecter » (texte inchangé).
- Changements limités dans les fichiers partagés avec 8.5 : `room.ts` (import, champ `history` de `roomConfig`, sortie
  `ended`, méthode `recordGame`), aucun changement dans `packages/protocol`, `ui/Table.tsx` ni `net/online.ts` (les
  types de l'historique sont dans `apps/server/src/history.ts` et `apps/client/src/account/api.ts`).
- Choix notés dans `a-valider-par-root.md` (4 lignes « Story 8.4 »).
- Capture 390×844 : `screens/8-4/history-390x844.png` (données de l'API simulées pour montrer chaque résultat) et
  `screens/8-4/account-line-390.png`.
- Pas encore fait (après livraison) : vérifier une partie réelle entre deux comptes de test sur cinecards.sevend.io.

### File List

- `apps/server/src/db/db.ts`
- `apps/server/src/db/games.ts` (nouveau)
- `apps/server/src/history.ts` (nouveau)
- `apps/server/src/history.test.ts` (nouveau)
- `apps/server/src/duel.ts`
- `apps/server/src/room.ts`
- `apps/server/src/main.ts`
- `apps/server/src/api/http.ts`
- `apps/server/src/accounts.test.ts`
- `apps/server/src/friends.test.ts`
- `apps/client/src/account/api.ts`
- `apps/client/src/account/session.ts`
- `apps/client/src/account/HistoryPanel.tsx` (nouveau)
- `apps/client/src/account/historyFormat.ts` (nouveau)
- `apps/client/src/account/history.test.ts` (nouveau)
- `apps/client/src/ui/Home.tsx`
- `apps/client/src/styles.css`
- `e2e/history.spec.ts` (nouveau)
- `_bmad-output/implementation-artifacts/screens/8-4/history-390x844.png` (nouveau)
- `_bmad-output/implementation-artifacts/screens/8-4/account-line-390.png` (nouveau)
- `_bmad-output/implementation-artifacts/a-valider-par-root.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/8-4-historique.md`

## Change Log

- 2026-11-23 — Story 8.4 implémentée : migration 4 (`games`, `game_players`), enregistrement des parties en ligne
  terminées par le serveur (résultats depuis le moteur), `GET /api/history`, `/api/health` avec `history: true`,
  panneau « Historique » (bilan + 20 dernières parties). Statut : review.
- 2026-11-23 — Revue : enregistrement seulement avec un vainqueur du moteur, écran vérifié ; typecheck, 248 tests, e2e 42/42. Story terminée.
