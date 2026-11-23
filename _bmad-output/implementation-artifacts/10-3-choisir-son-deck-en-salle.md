---
baseline_commit: b701087
---

# Story 10.3: Choisir son deck en salle

Status: done

## Story

As a joueur,
I want sélectionner un deck sauvegardé,
so that la partie l'utilise.

## Acceptance Criteria

1. **Nouveau mode sur l'accueil.** Dans le choix « Pioche » de l'accueil, une 3ᵉ option **« Decks construits »**
   (« Chacun joue son deck de 50 cartes. »), visible si je suis connecté et que le serveur a `decks: true`. Sous
   l'option, un sélecteur « Mon deck » liste mes decks **valides** ; aucun deck valide → l'option est grisée avec
   « Construis d'abord un deck valide » et un lien vers « Mes decks ». Dernier deck choisi gardé sur l'appareil.
2. **En ligne.** **Given** je crée une salle en « Decks construits » avec un deck valide **When** mon ami la rejoint
   (par code, lien ou invitation 8.3) **Then** il doit être connecté et choisir l'un de ses decks valides dans la
   salle d'attente (« Choisis ton deck ») avant que la partie commence ; la partie démarre quand les deux decks sont
   choisis ; **chaque pioche est le deck de son joueur** (moteur `constructed`, 10.1). Un invité sans compte, ou un
   compte sans deck valide, voit « Cette salle se joue en decks construits : connecte-toi et construis un deck
   valide. » et ne prend pas de siège.
3. **Le serveur fait foi.** Le client n'envoie que **l'identifiant** du deck ; le serveur le lit dans la base pour le
   compte du siège (session vérifiée) et le revalide (`validateDeck`) ; deck d'un autre compte, supprimé ou invalide →
   refus avec un message français. Le deck est figé au début de la partie (le modifier ensuite ne change pas la partie
   en cours).
4. **Contre le Grimoire.** En solo, « Decks construits » : je joue mon deck ; le Grimoire joue **50 cartes jouables
   tirées au hasard** (graine de la partie). Hot seat : l'option n'est pas proposée (GDD `[ASSUMPTION]` validée).
5. **Affichage.** La salle d'attente et le bandeau de début de partie indiquent le mode (« Decks construits ») ; la
   pioche affichée sur la table est celle du joueur (comme en decks aléatoires). Le journal n'affiche jamais le contenu
   du deck adverse (vues masquées inchangées).
6. **Historique (8.4).** Le mode « Decks construits » s'affiche correctement dans l'historique.
7. **Compatibilité.** Un ancien client qui crée une salle continue d'obtenir `shared` / `randomSplit` ; un ancien
   client qui rejoint une salle en `constructed` reçoit un refus lisible (pas de partie cassée). Le nouveau client
   face à un ancien serveur ne montre pas l'option.

## Tasks / Subtasks

- [x] **Protocole** — `RoomOptions.deckId?: number` ; `LobbyMessage` gagne `needDeck?: boolean` / `deckChosen?:
      [boolean, boolean]` (facultatifs) ; message client → serveur `chooseDeck { deckId }` pour la salle d'attente.
- [x] **Serveur** — `apps/server/src/room.ts`, `duel.ts` (AC 2, 3, 5, 7)
  - [x] `onCreate` : accepter `mode: 'constructed'` **seulement** avec une session et un `deckId` valide du créateur
        (sinon `shared` comme aujourd'hui pour les anciens clients ; si `constructed` est demandé sans deck valide :
        refus à l'entrée, `onJoin` qui lève une erreur avec un message français).
  - [x] `onJoin` du second joueur en `constructed` : session requise ; s'il donne `deckId` valide, il est pris ; sinon
        siège pris mais partie en attente de `chooseDeck`. Démarrage quand les deux decks sont validés.
  - [x] `Duel` : passer `decks` à `createGame` (`mode: 'constructed'`).
  - [x] Lecture du deck : la couche `db/decks.ts` de 10.2, revalidée avec `validateDeck` + `playableCardIds`.
- [x] **Client** — `ui/Home.tsx`, `ui/Lobby.tsx`, `net/online.ts`, `game/session.ts` (AC 1, 2, 4, 5)
  - [x] Option « Decks construits » + sélecteur (decks valides via `GET /api/decks` de 10.2) ; `localStorage` du dernier
        choix (try/catch).
  - [x] Salle d'attente : « Choisis ton deck » pour le second joueur, état « en attente du deck de Pseudo ».
  - [x] Solo : `localSession` accepte `decks` ; deck du Grimoire = 50 cartes jouables tirées avec la graine
        (fonction pure testée, dans `packages/engine` ou `packages/cards` : `randomDeck(playable, seed)`).
- [x] **Tests**
  - [x] Serveur (WebSocket) : salle `constructed` entre deux comptes avec decks valides → chaque pioche correspond à son
        deck (via les vues : nombre de cartes de la pioche, cartes piochées appartenant au deck) ; deck d'un autre
        compte refusé ; invité refusé ; ancien client (sans `deckId`) → `shared` ; le deck modifié après le début ne
        change pas la partie.
  - [x] Engine / cards : `randomDeck` (50 cartes distinctes, jouables, déterministe par graine).
  - [x] e2e `e2e/constructed.spec.ts` : deux comptes avec un deck valide chacun (créés via l'API pour aller vite),
        A crée une salle « Decks construits », B rejoint et choisit son deck, la partie démarre ; solo « Decks
        construits » démarre contre le Grimoire.
  - [x] **Simulation de 200 parties** (le moteur est utilisé dans un nouveau mode en partie réelle) : doit passer.
- [x] Mettre à jour `a-valider-par-root.md` (section « Epics 8 et 10 ») : second joueur choisit dans la salle
      d'attente ; dernier deck gardé sur l'appareil ; refus des invités en salle construite.

## Dev Notes

- Moteur : `createGame(catalog, { seed, mode: 'constructed', decks: [d0, d1] })` (10.1) lève une exception sur un deck
  invalide : valider avant pour renvoyer un message propre au joueur.
- `room.ts` aujourd'hui : `this.mode = options?.mode === 'randomSplit' ? 'randomSplit' : 'shared'` ; `startDuel()` quand
  les deux sièges sont pris ; `accounts[seat]` (8.1) ; invitations (8.3) lisent `mode` de la salle.
- 10.2 livre la table `decks`, `db/decks.ts`, `GET /api/decks` (avec `valid`).
- Définition de fini : `pnpm typecheck`, `pnpm test` (simulation comprise), `PW_CHANNEL=chromium pnpm e2e --
  --trace off` (ports dédiés).

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 10.3]
- [Source: _bmad-output/planning-artifacts/gdds/gdd-cinecards-2026-11-22/gdd.md#Deck Building]
- [Source: _bmad-output/implementation-artifacts/10-1-regles-de-construction.md], [10-2-ecran-de-construction.md]
- [Source: AGENTS.md]

## Dev Agent Record

### Agent Model Used

Agent de développement (gds-dev-story)

### Debug Log References

- `pnpm typecheck` : vert. `pnpm test` : 37 fichiers, 276 tests verts.
- Simulations de 200 parties : shared / randomSplit 200/200 finies (victoires 103/97, 5537 tours, plus longue 77 tours) ; constructed 200/200 finies (victoires 97/103, 5717 tours, plus longue 64 tours).
- e2e : premier passage de `e2e/constructed.spec.ts`, 2 échecs : l'accueil lisait les decks avant que le test ne les enregistre par l'API (option grisée) → rechargement de la page après l'enregistrement. Ensuite `E2E_SERVER_PORT=2667 E2E_CLIENT_PORT=5274 PW_CHANNEL=chromium pnpm e2e -- --trace off` : 49/49 verts.
- Avertissement React « <button> cannot contain a nested <button> » vu pendant l'e2e : il vient de `Table` / `CardView` (`MiniArt`), code non touché ici.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- **Protocole** : `RoomOptions.deckId` et `RoomOptions.pickDeck` (ajout hors story : le nouveau client annonce qu'il sait choisir son deck en salle d'attente ; sans lui ni `deckId`, une salle construite refuse l'entrée, c'est ainsi qu'un ancien client est refusé proprement au lieu d'occuper un siège inutilisable) ; `LobbyMessage.needDeck` / `deckChosen` / `deckId` (seulement en salle construite) ; message client `chooseDeck { deckId }` ; message serveur `deckRefused { message }` ; `DECK_REFUSED_CODE = 4210` (code de l'erreur d'entrée, message en français). `/api/health` ajoute `constructed: true` (ajout hors story : un serveur 10.2 a déjà `decks: true` mais ne sait pas jouer les decks ; le nouveau client cache l'option sans `constructed`).
- **Serveur** : `DeckService.playDeck(compte, id)` (relit le deck du compte, revalide avec `validateDeck` + `playableCardIds`, messages français) et `hasPlayDeck(compte)` ; branchés dans `roomConfig.decks`. `DuelRoom` : `constructed` accepté seulement avec `roomConfig.decks` (sinon `shared` / `randomSplit` comme avant) ; le créateur doit avoir une session et un `deckId` valide, sinon `ServerError(4210)` et la salle vide est fermée ; le second joueur doit être connecté et soit donner un `deckId` valide, soit `pickDeck` avec au moins un deck valide ; `chooseDeck` vérifie et met à jour la salle d'attente ; au démarrage, les deux decks sont relus et revalidés (un deck supprimé / invalide entre-temps est refusé et la salle attend) et cette copie est passée à `Duel` → `createGame({ mode: 'constructed', decks })`. Vues masquées inchangées (pioches et main adverses déjà cachées) ; le message de salle ne donne que « deck choisi ou non ». L'historique enregistre `constructed`.
- **Moteur** : `randomDeck(playable, seed)` (50 cartes distinctes, déterministe, indépendant de l'ordre de la liste), exporté par `@cinecards/engine`.
- **Client** : option « Decks construits » sur l'accueil (connecté, serveur `decks` + `constructed`), sélecteur « Mon deck » (decks valides côté serveur et côté client, par nom), grisée sans deck valide avec « Construis d'abord un deck valide · Mes decks » ; liste relue au retour de « Mes decks » ; dernier deck gardé (`cinecards.deck`, try/catch). Hot seat grisé en mode construit. Solo : mon deck contre `randomDeck(PLAYABLE, graine)`. En ligne : `deckId` envoyé à la création (et pour « Inviter » depuis « Amis ») ; à l'entrée, `pickDeck: true` ; un refus 4210 affiche le message du serveur. Salle d'attente : « Pioche : <mode> », « deck prêt » / « choisit son deck… » par siège, « Choisis ton deck » (radios + « Jouer ce deck »), « Ton deck : Nom · Changer », « En attente du deck de Pseudo… », refus affichés. Journal : « La partie commence (decks construits). » ; historique « Decks construits » ; encart d'invitation « … en decks construits ».
- **Tests** : `apps/server/src/constructed.test.ts` (6 : deux comptes, chaque pioche = son deck, deck d'un autre compte / inconnu refusé, vues sans cartes adverses, deck modifié après le début sans effet, historique `constructed` ; `deckId` à l'entrée ; invité, compte sans deck valide et ancien client refusés, siège resté libre ; création refusée ; deck supprimé en salle d'attente rattrapé au démarrage ; anciens clients `shared` / `randomSplit` sans champs de deck) ; `packages/engine/src/random-deck.test.ts` (4) ; `apps/client/src/decks/playable.test.ts` (2) ; `online.test.ts` (refus 4210) ; `history.test.ts` ; e2e `e2e/constructed.spec.ts` (3 : salle construite entre deux comptes jusqu'à la table et au journal, invité refusé, option grisée → Mes decks → solo contre le Grimoire, hot seat grisé, dernier deck gardé).
- **Captures** 390 × 844 (×1) dans `screens/10-3/` : `home-decks-construits.png`, `home-sans-deck-valide.png`, `lobby-choisis-ton-deck.png` ; corrigé après examen : sélecteur « Mon deck » centré et étroit → aligné à gauche, pleine largeur ; lien « Mes decks » doré illisible sur le parchemin et renvoyé à la ligne → encre, en ligne.
- Documents : GDD (`[ASSUMPTION]` salle construite + index) et `a-valider-par-root.md` (section « Epics 8 et 10 »).
- Limite connue : un ancien client refusé n'affiche que son message générique « Connexion au serveur impossible… » (il ne lit pas le message du serveur) ; pas de partie cassée.

### File List

- `packages/protocol/src/index.ts`
- `packages/engine/src/random-deck.ts` (nouveau)
- `packages/engine/src/random-deck.test.ts` (nouveau)
- `packages/engine/src/index.ts`
- `apps/server/src/room.ts`
- `apps/server/src/duel.ts`
- `apps/server/src/main.ts`
- `apps/server/src/decks/decks.ts`
- `apps/server/src/api/http.ts`
- `apps/server/src/constructed.test.ts` (nouveau)
- `apps/server/src/accounts.test.ts`
- `apps/server/src/friends.test.ts`
- `apps/client/src/App.tsx`
- `apps/client/src/ui/Home.tsx`
- `apps/client/src/ui/Lobby.tsx`
- `apps/client/src/net/online.ts`
- `apps/client/src/net/online.test.ts`
- `apps/client/src/game/session.ts`
- `apps/client/src/game/describe.ts`
- `apps/client/src/decks/playable.ts` (nouveau)
- `apps/client/src/decks/playable.test.ts` (nouveau)
- `apps/client/src/account/api.ts`
- `apps/client/src/account/session.ts`
- `apps/client/src/account/historyFormat.ts`
- `apps/client/src/account/history.test.ts`
- `apps/client/src/account/InviteToast.tsx`
- `apps/client/src/styles.css`
- `e2e/constructed.spec.ts` (nouveau)
- `_bmad-output/implementation-artifacts/screens/10-3/home-decks-construits.png` (nouveau)
- `_bmad-output/implementation-artifacts/screens/10-3/home-sans-deck-valide.png` (nouveau)
- `_bmad-output/implementation-artifacts/screens/10-3/lobby-choisis-ton-deck.png` (nouveau)
- `_bmad-output/planning-artifacts/gdds/gdd-cinecards-2026-11-22/gdd.md`
- `_bmad-output/implementation-artifacts/a-valider-par-root.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/10-3-choisir-son-deck-en-salle.md`

## Change Log

- 2026-11-23 — Story 10.3 implémentée : mode « Decks construits » en ligne (deck choisi par son id, relu, revalidé et figé par le serveur ; second joueur qui choisit en salle d'attente ; invités, comptes sans deck et anciens clients refusés) et en solo (mon deck contre 50 cartes tirées avec la graine), `randomDeck`, `/api/health` `constructed: true`, tests serveur / moteur / client / e2e, captures. Statut : review.
- 2026-11-23 — Revue : decks lus et revalidés par le serveur pour le compte du siège, figés au début ; écrans vérifiés ; typecheck, 276 tests (simulations 200/200 dans les deux familles de modes), e2e 49/49. Story terminée ; epic 10 terminé.
