---
baseline_commit: 3879b3ea6ad047fe7f2974a09706123975ee5f7d
---

# Story 10.1: Règles de construction

Status: review

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

- [x] **Cartes** — `packages/cards/src/deck.ts` (+ export dans `index.ts`) (AC 1)
  - [x] `DECK_SIZE = 50`, `validateDeck(ids, catalog, playable)` (la liste des cartes jouables est passée en
        paramètre pour que `packages/cards` ne dépende pas du moteur — l'architecture interdit `cards → engine` ;
        le moteur exporte `playableCardIds`). Erreurs triées : taille, puis doublons, inconnues, non jouables.
  - [x] Tests `packages/cards/src/deck.test.ts` : deck valide (50 cartes jouables distinctes), 49, 51, doublon, inconnue,
        non jouable, plusieurs erreurs à la fois, textes français.
- [x] **Moteur** — `packages/engine` (AC 2, 3)
  - [x] `DeckMode` (`types.ts`) : ajouter `'constructed'` ; `CreateGameOptions.decks?: [string[], string[]]`.
  - [x] `state/create.ts` : en `constructed`, valider chaque deck (exception `invalid deck for player N: <codes>`),
        créer les instances par joueur (`owner` = le joueur), mélanger chaque pioche avec la graine, `sharedDeck` vide.
  - [x] Partout où le code teste `mode === 'shared'` ou `mode === 'randomSplit'` (`turn/turn.ts` pioche et remélange,
        `play/abilities.ts` choix dans le deck, `effects/run.ts` `opponentPile`), traiter `constructed` comme
        `randomSplit` (pioches personnelles). Préférer un utilitaire `ownPiles(mode)` à des `||` dispersés.
  - [x] Le bot (`bot.ts`) et `timeout.ts` n'ont rien de spécifique au mode : vérifier.
  - [x] Tests (`engine.test.ts` ou `constructed.test.ts`) : création, pioche dans son deck, remélange depuis son
        cimetière, effet « deck adverse », refus d'un deck invalide, même carte dans les deux decks.
- [x] **Protocole** — `packages/protocol` : `DeckMode` est réexporté depuis le moteur ; vérifier que le serveur
      (`room.ts` : `options.mode === 'randomSplit' ? … : 'shared'`) **refuse** toujours `constructed` tant que 10.3
      n'existe pas (pas de deck à fournir) : une salle demandée en `constructed` reste en `shared`.
- [x] **Simulation** (AC 4) — `simulate.test.ts` : ajouter la variante `constructed` (deux decks de 50 tirés parmi
      les cartes jouables avec la graine de la partie) ; garder les assertions existantes.
- [x] **Documents** : GDD (section Deck Building) déjà à jour ; ajouter à `a-valider-par-root.md` (section « Epics 8
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

Agent de développement (gds-dev-story).

### Debug Log References

- Le worktree n'avait pas de `node_modules` : `@cinecards/cards/deck` se résolvait vers la copie principale →
  `pnpm install --frozen-lockfile` dans le worktree.
- Un test de refus mal construit (le doublon n'en était pas un) corrigé ; aucune autre erreur.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- `packages/cards/src/deck.ts` : `DECK_SIZE = 50`, `validateDeck(ids, catalog, playable)` → `{ ok: true }` ou
  `{ ok: false, errors }` (code, texte français, `cardId`). Erreurs triées taille → doublons → inconnues → non jouables,
  chacune dans l'ordre du deck ; une seule erreur par carte en double, quel que soit le nombre de copies ; pluriel géré
  (« 1 carte », « 3 cartes »). Exporté par `index.ts` et par un nouveau sous-chemin pur `@cinecards/cards/deck`.
- Frontière d'architecture : le moteur importe `validateDeck` par `@cinecards/cards/deck` (fichier sans zod, qui
  n'importe que des types) ; `cards` n'importe jamais le moteur (la liste `playableCardIds` est passée en paramètre).
  Amendement noté dans `game-architecture.md` (Architectural Boundaries).
- Moteur : `DeckMode` = `'shared' | 'randomSplit' | 'constructed'` ; `CreateGameOptions.decks?: [string[], string[]]`.
  `createGame` en `constructed` : exception `constructed mode needs one deck per player` sans decks, sinon
  `invalid deck for player N: <codes>` (codes distincts dans l'ordre des erreurs, ex. `size, duplicate, unknown`) ;
  instances créées avec `owner` = le joueur, chaque pioche triée puis mélangée avec la graine (joueur 0 puis 1),
  `sharedDeck` vide. Le code `shared` / `randomSplit` est inchangé (déplacé dans `splitDeck`).
- Utilitaire `ownPiles(mode)` (`state/helpers.ts`) utilisé par `pileOf`, le remélange (cimetière du propriétaire,
  événement `deckReshuffled` avec le joueur), « deck ADVERSE » (`effects/run.ts`) ; `choose` (`play/abilities.ts`)
  passe par `pileOf`. `bot.ts` et `timeout.ts` n'ont rien de spécifique au mode (vérifié par grep).
- Protocole / serveur : `DeckMode` réexporté tel quel ; `room.ts` fait déjà
  `options.mode === 'randomSplit' ? 'randomSplit' : 'shared'`, donc une salle demandée en `constructed` reste en
  `shared` : aucune modification de `apps/`.
- Tests : `packages/cards/src/deck.test.ts` (6 tests : valide, 49 / 51, doublon, inconnue, non jouable, plusieurs
  erreurs + textes) ; `packages/engine/src/constructed.test.ts` (5 tests : création et propriétaires, même carte dans
  les deux decks, déterminisme, pioche dans son deck et remélange de son seul cimetière, « deck ADVERSE », refus de
  decks invalides y compris carte non jouable, modes existants inchangés).
- Simulation (`simulate.test.ts`) : la boucle est extraite dans `run(modeOf)` ; test existant inchangé
  (`shared`/`randomSplit` alternés, ≥ 190) : 200/200 finies (100 shared, 100 randomSplit), victoires 103/97,
  5537 tours, plus longue 77 tours. Nouveau test `constructed` (deux decks de 50 tirés parmi les jouables avec une
  graine dérivée de celle de la partie, assertion 200/200) : 200/200 finies, victoires 97/103, 5717 tours, plus longue
  64 tours.
- Documents : GDD (Deck Building + index des `[ASSUMPTION]`) et `a-valider-par-root.md` (textes d'erreur ; « deck
  ADVERSE » et même carte dans les deux decks).
- Définition de fini : `pnpm typecheck` OK ; `pnpm test` 27 fichiers, 220 tests OK ; e2e (ports 2677 / 5284)
  40/40 OK.

### File List

- `packages/cards/src/deck.ts` (nouveau)
- `packages/cards/src/deck.test.ts` (nouveau)
- `packages/cards/src/index.ts`
- `packages/cards/package.json` (sous-chemin `./deck`)
- `packages/engine/src/types.ts`
- `packages/engine/src/state/create.ts`
- `packages/engine/src/state/helpers.ts`
- `packages/engine/src/turn/turn.ts`
- `packages/engine/src/effects/run.ts`
- `packages/engine/src/play/abilities.ts`
- `packages/engine/src/constructed.test.ts` (nouveau)
- `packages/engine/src/simulate.test.ts`
- `_bmad-output/game-architecture.md`
- `_bmad-output/planning-artifacts/gdds/gdd-cinecards-2026-11-22/gdd.md`
- `_bmad-output/implementation-artifacts/a-valider-par-root.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/10-1-regles-de-construction.md`

## Change Log

- 2026-11-23 — Story 10.1 implémentée : `validateDeck` (50 cartes, un exemplaire, connues et jouables) dans
  `packages/cards`, mode `constructed` du moteur (un deck par joueur, pioche et remélange personnels, « deck ADVERSE »,
  refus des decks invalides), simulation de 200 parties en mode construit ; statut → review.
