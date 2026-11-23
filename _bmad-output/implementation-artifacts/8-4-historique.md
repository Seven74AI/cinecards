# Story 8.4: Historique

Status: ready-for-dev

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

- [ ] **Base** — prochaine migration ajoutée à `MIGRATIONS` (`apps/server/src/db/db.ts`) après celles de 8.1, 8.2 et
      8.3 ; ne jamais modifier une migration livrée (AC 1)
  - [ ] `games(id INTEGER PRIMARY KEY, mode TEXT NOT NULL, turns INTEGER NOT NULL, started_at INTEGER NOT NULL,
        ended_at INTEGER NOT NULL)` et `game_players(game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
        seat INTEGER NOT NULL, account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL, nickname TEXT NOT NULL,
        result TEXT NOT NULL CHECK(result IN ('win','loss','draw','conceded','opponent_conceded')), PRIMARY KEY
        (game_id, seat))` + index `(account_id, game_id DESC)`.
  - [ ] `apps/server/src/db/games.ts` : `recordGame(...)` (une transaction), `recentGames(accountId, 20)`,
        `record(accountId)` (bilan).
  - [ ] Test : migration depuis la version précédente sans perte.
- [ ] **Serveur** (AC 1, 2, 4)
  - [ ] `apps/server/src/room.ts` / `duel.ts` : quand le duel passe à `finished` (une seule fois), si au moins un siège
        a un compte (`accounts[seat]`, 8.1), enregistrer la partie : `started_at` = début du duel, `turns` = somme
        des `turnNumber` des joueurs ou le compteur de tours du moteur, résultat par siège depuis `state.winner` et
        l'événement `conceded` (et le forfait de `holdSeat` après 90 s, qui passe par `duel.concede(seat)`).
        Le pseudo enregistré est celui du siège (`names[seat]`).
  - [ ] Injection comme pour les comptes (`roomConfig`), pour que `server.test.ts` sans base continue de marcher.
  - [ ] `GET /api/history` (Bearer) → `{ record: { wins, losses, draws }, games: [{ id, result, opponent: {
        nickname, isGuest }, mode, turns, endedAt, durationMs }] }` ; `/api/health` ajoute `history: true`.
- [ ] **Client** (AC 3, 5)
  - [ ] `apps/client/src/account/HistoryPanel.tsx` (portail dans `<body>`, comme `AccountPanel` / `FriendsPanel`) ;
        `api.ts` : `history(token)` ; dates relatives avec `Intl.RelativeTimeFormat('fr')` et
        `Intl.DateTimeFormat('fr', { day: 'numeric', month: 'short' })`.
  - [ ] `ui/Home.tsx` : bouton « Historique » à côté de « Amis » (garder `.account-line` et « Connecté : <pseudo> »).
- [ ] **Tests** (AC 1-5)
  - [ ] Serveur `apps/server/src/history.test.ts` : via WebSocket (comme `server.test.ts`), deux comptes jouent jusqu'à
        un abandon → chacun a une ligne avec le bon résultat ; un compte contre un invité → une seule ligne, adversaire
        « invité » ; forfait après le délai de reconnexion (2 s en test) → `opponent_conceded` ; deux invités → rien ;
        bilan ; ordre et limite de 20.
  - [ ] Client : formatage des dates relatives et des résultats.
  - [ ] e2e `e2e/history.spec.ts` : deux comptes, une partie en ligne terminée par « Abandonner » ; l'historique de
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

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created

### File List
