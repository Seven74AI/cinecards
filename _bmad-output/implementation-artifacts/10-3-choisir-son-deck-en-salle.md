# Story 10.3: Choisir son deck en salle

Status: ready-for-dev

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

- [ ] **Protocole** — `RoomOptions.deckId?: number` ; `LobbyMessage` gagne `needDeck?: boolean` / `deckChosen?:
      [boolean, boolean]` (facultatifs) ; message client → serveur `chooseDeck { deckId }` pour la salle d'attente.
- [ ] **Serveur** — `apps/server/src/room.ts`, `duel.ts` (AC 2, 3, 5, 7)
  - [ ] `onCreate` : accepter `mode: 'constructed'` **seulement** avec une session et un `deckId` valide du créateur
        (sinon `shared` comme aujourd'hui pour les anciens clients ; si `constructed` est demandé sans deck valide :
        refus à l'entrée, `onJoin` qui lève une erreur avec un message français).
  - [ ] `onJoin` du second joueur en `constructed` : session requise ; s'il donne `deckId` valide, il est pris ; sinon
        siège pris mais partie en attente de `chooseDeck`. Démarrage quand les deux decks sont validés.
  - [ ] `Duel` : passer `decks` à `createGame` (`mode: 'constructed'`).
  - [ ] Lecture du deck : la couche `db/decks.ts` de 10.2, revalidée avec `validateDeck` + `playableCardIds`.
- [ ] **Client** — `ui/Home.tsx`, `ui/Lobby.tsx`, `net/online.ts`, `game/session.ts` (AC 1, 2, 4, 5)
  - [ ] Option « Decks construits » + sélecteur (decks valides via `GET /api/decks` de 10.2) ; `localStorage` du dernier
        choix (try/catch).
  - [ ] Salle d'attente : « Choisis ton deck » pour le second joueur, état « en attente du deck de Pseudo ».
  - [ ] Solo : `localSession` accepte `decks` ; deck du Grimoire = 50 cartes jouables tirées avec la graine
        (fonction pure testée, dans `packages/engine` ou `packages/cards` : `randomDeck(playable, seed)`).
- [ ] **Tests**
  - [ ] Serveur (WebSocket) : salle `constructed` entre deux comptes avec decks valides → chaque pioche correspond à son
        deck (via les vues : nombre de cartes de la pioche, cartes piochées appartenant au deck) ; deck d'un autre
        compte refusé ; invité refusé ; ancien client (sans `deckId`) → `shared` ; le deck modifié après le début ne
        change pas la partie.
  - [ ] Engine / cards : `randomDeck` (50 cartes distinctes, jouables, déterministe par graine).
  - [ ] e2e `e2e/constructed.spec.ts` : deux comptes avec un deck valide chacun (créés via l'API pour aller vite),
        A crée une salle « Decks construits », B rejoint et choisit son deck, la partie démarre ; solo « Decks
        construits » démarre contre le Grimoire.
  - [ ] **Simulation de 200 parties** (le moteur est utilisé dans un nouveau mode en partie réelle) : doit passer.
- [ ] Mettre à jour `a-valider-par-root.md` (section « Epics 8 et 10 ») : second joueur choisit dans la salle
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

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created

### File List
