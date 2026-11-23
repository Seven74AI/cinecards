# Story 10.1: Règles de construction

Status: ready-for-dev

## Story

As a Root,
I want que chaque deck compte exactement 50 cartes uniques,
so that le mode soit équilibré.

## Acceptance Criteria

1. **Validation partagée.** Une fonction pure `validateDeck(cardIds, catalog)` (dans `packages/cards`, utilisable par le
   client et le serveur) renvoie `{ ok: true }` ou la liste des erreurs, chacune avec un code et un texte français :
   - `size` : « Il manque N cartes (50 exactement). » / « N cartes de trop (50 exactement). »
   - `duplicate` : « « Nom » est en double : une seule copie par carte. » (une erreur par carte en double)
   - `unknown` : « Carte inconnue : id. »
   - `unplayable` : « « Nom » n'est pas encore jouable. » (carte non prise en charge par le moteur, `playableCardIds`)
   Règle de Root (2026-11-22) : **exactement 50 cartes, un seul exemplaire de chaque**.
2. **Mode de jeu `constructed`.** Le moteur accepte `mode: 'constructed'` avec un deck **par joueur**
   (`decks: [string[], string[]]` dans `CreateGameOptions`) : chaque joueur pioche dans son propre deck mélangé ; une
   pioche vide se reforme à partir du cimetière de son propriétaire (comme `randomSplit`) ; les effets qui visent « le
   deck adverse » (L'ange sans ailes, « piochez les 3 prochaines cartes du deck ADVERSE ») prennent la pioche de
   l'adversaire (comme `randomSplit`). Les deux decks peuvent contenir la même carte (une copie chacun).
3. **Refus moteur.** `createGame` en `constructed` refuse (exception claire) un deck qui ne passe pas `validateDeck` :
   le serveur ne lancera jamais une partie avec un deck invalide.
4. **Équilibre et non-régression.** La simulation de 200 parties (`packages/engine/src/simulate.test.ts`) passe toujours
   pour `shared` et `randomSplit`, et une variante `constructed` (decks de 50 cartes tirées avec la graine) passe aussi :
   200/200 parties terminées, sans exception ni boucle.
5. **Rien de visible pour l'instant.** Pas d'écran (story 10.2), pas de choix en salle (10.3). Les modes existants ne
   changent pas.

## Tasks / Subtasks

- [ ] **Cartes** — `packages/cards/src/deck.ts` (+ export dans `index.ts`) (AC 1)
  - [ ] `DECK_SIZE = 50`, `validateDeck(ids, catalog, playable)` (la liste des cartes jouables est passée en
        paramètre pour que `packages/cards` ne dépende pas du moteur — l'architecture interdit `cards → engine` ;
        le moteur exporte `playableCardIds`). Erreurs triées : taille, puis doublons, inconnues, non jouables.
  - [ ] Tests `packages/cards/src/deck.test.ts` : deck valide (50 cartes jouables distinctes), 49, 51, doublon, inconnue,
        non jouable, plusieurs erreurs à la fois, textes français.
- [ ] **Moteur** — `packages/engine` (AC 2, 3)
  - [ ] `DeckMode` (`types.ts`) : ajouter `'constructed'` ; `CreateGameOptions.decks?: [string[], string[]]`.
  - [ ] `state/create.ts` : en `constructed`, valider chaque deck (exception `invalid deck for player N: <codes>`),
        créer les instances par joueur (`owner` = le joueur), mélanger chaque pioche avec la graine, `sharedDeck` vide.
  - [ ] Partout où le code teste `mode === 'shared'` ou `mode === 'randomSplit'` (`turn/turn.ts` pioche et remélange,
        `play/abilities.ts` choix dans le deck, `effects/run.ts` `opponentPile`), traiter `constructed` comme
        `randomSplit` (pioches personnelles). Préférer un utilitaire `ownPiles(mode)` à des `||` dispersés.
  - [ ] Le bot (`bot.ts`) et `timeout.ts` n'ont rien de spécifique au mode : vérifier.
  - [ ] Tests (`engine.test.ts` ou `constructed.test.ts`) : création, pioche dans son deck, remélange depuis son
        cimetière, effet « deck adverse », refus d'un deck invalide, même carte dans les deux decks.
- [ ] **Protocole** — `packages/protocol` : `DeckMode` est réexporté depuis le moteur ; vérifier que le serveur
      (`room.ts` : `options.mode === 'randomSplit' ? … : 'shared'`) **refuse** toujours `constructed` tant que 10.3
      n'existe pas (pas de deck à fournir) : une salle demandée en `constructed` reste en `shared`.
- [ ] **Simulation** (AC 4) — `simulate.test.ts` : ajouter la variante `constructed` (deux decks de 50 tirés parmi
      les cartes jouables avec la graine de la partie) ; garder les assertions existantes.
- [ ] **Documents** : GDD (section Deck Building) déjà à jour ; ajouter à `a-valider-par-root.md` (section « Epics 8
      et 10 ») les textes d'erreur et le comportement « deck adverse » en mode construit.

## Dev Notes

- Architecture : `packages/cards` = schéma, chargement et règles de deck (« Card schema, deck modes ») ; `engine → cards`
  (types seulement) ; **jamais `cards → engine`**. D'où la liste des cartes jouables passée en paramètre.
- `createGame` (`packages/engine/src/state/create.ts`) : aujourd'hui `cardIds` (par défaut toutes les cartes
  jouables), mélange unique, puis `shared` (pioche commune) ou `randomSplit` (moitiés). `newInstance(state, id, 0, …)`
  crée avec `owner` 0 : en `constructed`, créer avec le bon propriétaire.
- 51 cartes jouables aujourd'hui (`cards.test.ts` : `playableCardIds(MVP)` a 51 éléments) : un deck valide = toutes
  sauf une. Les tests ne doivent pas supposer 51 (prendre `playable.slice(0, 50)`).
- Le moteur touche aux règles : **la simulation de 200 parties est obligatoire** (AGENTS.md).
- Définition de fini : `pnpm typecheck`, `pnpm test` (simulation comprise), `PW_CHANNEL=chromium pnpm e2e --
  --trace off` (ports dédiés : un autre agent travaille en parallèle sur l'epic 8 ; utiliser 2677 / 5284).

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 10.1]
- [Source: _bmad-output/planning-artifacts/gdds/gdd-cinecards-2026-11-22/gdd.md#Deck Building]
- [Source: _bmad-output/game-architecture.md#Architectural Boundaries, Epic to Architecture Mapping (E8 → cards, engine)]
- [Source: AGENTS.md]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created

### File List
