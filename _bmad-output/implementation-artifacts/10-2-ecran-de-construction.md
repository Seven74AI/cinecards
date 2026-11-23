# Story 10.2: Écran de construction

Status: ready-for-dev

## Story

As a joueur,
I want composer mon deck avec des filtres,
so that je joue mes cartes préférées.

## Acceptance Criteria

1. **Maquette retenue : B · Grille unique** (Root, 2026-11-23), plus l'écran commun « Mes decks ».
   Référence visuelle : `docs/design/deck-builder/B-grille-unique.dc.html` et ses captures
   (`B-grille-unique.png`, `B-grille-unique-filtres.png`, `B-grille-unique-deck.png`), `Mes-decks.dc.html`
   (`Mes-decks.png`, `Mes-decks-supprimer.png`). Le rendu doit suivre la maquette (disposition, barre du bas,
   feuilles, coches, textes) en réutilisant les vrais composants du jeu (`CardView`).
2. **Mes decks.** Connecté, depuis l'accueil (bouton « Mes decks » dans `.account-line`, à côté de « Amis » /
   « Historique ») : liste de mes decks enregistrés sur mon compte, chacun avec son nom, son statut (« Valide » ou la
   première erreur : « Il manque 3 cartes », « 1 carte de trop »…), « Modifier », « Copier », « Supprimer » (avec
   confirmation) et « Nouveau deck ». Au plus 20 decks par compte. Sans compte : le bouton n'apparaît pas.
3. **Construire (B).** Grille de 3 colonnes de **vraies cartes** (`CardView`) ; une **coche dorée** sur les cartes
   du deck ; **toucher = ajouter ou retirer** ; appui long (ou bouton « i ») = fiche de la carte (la fiche existante
   `openCard`). Barre fixe en bas : « N / 50 », barre de progression, première erreur (« Il manque 3 cartes »), et
   « Voir le deck › ». En haut : retour, nom du deck modifiable (crayon), « ⋯ » (Copier, Supprimer), « Enregistrer ».
4. **Filtres et recherche.** Champ « Rechercher une carte » (nom, sans accents ni casse) et bouton « Filtres · N »
   qui ouvre une feuille : **Film** (liste avec recherche, plusieurs choix), **Catégorie** (personnage, sort,
   équipement, terrain), **Rareté**, **Coût** (0 à 9+) ; puces des filtres actifs sous la recherche (× pour
   retirer) ; « N cartes · tri : coût » avec tri par coût, nom ou film. Interrupteur « Masquer mon deck ».
5. **Voir le deck.** Feuille « Mon deck » : compteur, erreurs, courbe de coût (0 à 9+), cartes groupées par
   catégorie ; toucher une carte la retire. Bouton grille / liste (liste compacte inspirée de l'option C).
6. **Règles.** Les erreurs viennent de `validateDeck` (`@cinecards/cards`, story 10.1) : exactement 50 cartes, une
   copie de chaque, cartes connues et jouables. Ajouter une carte déjà présente est impossible (c'est un retrait).
   On peut **enregistrer un deck incomplet** (statut affiché) ; seul un deck valide pourra être choisi en salle
   (story 10.3). Le serveur revalide à l'enregistrement (statut calculé côté serveur, cartes inconnues refusées).
7. **Quitter sans enregistrer.** Si le deck a changé, « retour » demande « Quitter sans enregistrer ? ».
8. **Téléphone d'abord.** 390 × 844 et 360 × 640 sans débordement horizontal ; seule la grille défile ; cibles de
   44 px ; la barre du bas ne cache pas la dernière rangée (marge en bas de la grille). Tablette / ordinateur : plus de
   colonnes (4 à 6), même logique.
9. **Compatibilité.** Nouvelles routes et nouvelle migration seulement ; bouton caché si `/api/health` n'a pas
   `decks: true`.

## Tasks / Subtasks

- [ ] **Base** — migration suivante ajoutée **à la fin** de `MIGRATIONS` (`apps/server/src/db/db.ts`) ; ne jamais
      modifier une migration livrée. **Attention :** la story 8.4 (historique) ajoute aussi une migration en parallèle ;
      la tienne doit rester la dernière du tableau (au moment de fusionner, elle passera après celle de 8.4) et son
      test d'upgrade part de « la version précédente » (`MIGRATIONS.length - 1`), pas d'un numéro en dur.
  - [ ] `decks(id INTEGER PRIMARY KEY, account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        name TEXT NOT NULL, cards TEXT NOT NULL /* JSON string[] */, created_at INTEGER NOT NULL, updated_at INTEGER
        NOT NULL)` + index `account_id`.
  - [ ] `apps/server/src/db/decks.ts`.
- [ ] **API** — `apps/server/src/api/http.ts` (+ service) (AC 2, 6, 9)
  - [ ] `GET /api/decks` → `{ decks: [{ id, name, cards, valid, errors, updatedAt }] }` ; `POST /api/decks`
        `{ name, cards }` → `201 { deck }` ; `PUT /api/decks/:id` → `200 { deck }` ; `DELETE /api/decks/:id` → `204`.
        Nom : 1 à 30 caractères (espaces retirés), défaut « Nouveau deck ». `cards` : 0 à 60 identifiants **connus**
        (inconnus → `400 unknown_card`), doublons retirés ; `valid` / `errors` calculés avec `validateDeck` et
        `playableCardIds`. 20 decks au plus (`409 deck_limit`). Un compte ne voit et ne modifie que ses decks.
        `PUT` ajoute `PUT` à `Access-Control-Allow-Methods`. `/api/health` ajoute `decks: true`.
- [ ] **Client** — `apps/client/src/decks/` (AC 1-8)
  - [ ] `DecksScreen.tsx` (Mes decks) et `DeckBuilder.tsx` (B) : écrans plein écran (pas une fenêtre), ouverts depuis
        l'accueil, avec retour vers l'accueil ; style et palette du jeu (reprendre les styles de la maquette dans
        `styles.css`, préfixe `.deck-`).
  - [ ] Filtres purs et testés (`filters.ts`) : recherche sans accents, film, catégorie, rareté, coût, tri.
  - [ ] Utiliser `CATALOG` / `PLAYABLE` (`game/catalog.ts`), `CardView` (taille adaptée à 3 colonnes), la fiche
        (`useRefs().openCard`), `validateDeck` (`@cinecards/cards`), `account/api.ts` pour les appels.
  - [ ] `ui/Home.tsx` : bouton « Mes decks » dans `.account-line` (garder « Connecté : <pseudo> »).
- [ ] **Tests**
  - [ ] Serveur : migration, routes, validation serveur, limites, isolation entre comptes.
  - [ ] Client : filtres et tri.
  - [ ] e2e `e2e/decks.spec.ts` : compte → Mes decks → Nouveau deck → filtrer par film → ajouter des cartes → compteur
        et erreur → ajouter jusqu'à 50 → « Valide » → enregistrer → retour : le deck est listé « Valide » ; copier ;
        supprimer avec confirmation.
- [ ] **Captures** 390 × 844 (×1) de Mes decks, du constructeur, de la feuille Filtres et de la feuille Mon deck, et
      360 × 640 du constructeur, dans `_bmad-output/implementation-artifacts/screens/10-2/` ; les comparer aux captures
      de la maquette B et corriger les écarts visibles.

## Dev Notes

- 10.1 a livré `validateDeck(ids, catalog, playable)` et `DECK_SIZE` dans `packages/cards` (et le sous-chemin
  `@cinecards/cards/deck` sans zod à l'exécution), le mode moteur `constructed`. Cette story n'utilise pas encore le
  mode en partie (c'est 10.3).
- 51 cartes jouables aujourd'hui : un deck valide = toutes sauf une. L'écran doit pourtant être pensé pour ~500 cartes
  (grille virtualisée inutile à 51, mais ne rien coder qui suppose « peu de cartes » : filtres, film avec recherche).
- Comptes, panneaux, `serverFeatures()`, `.account-line` : suivre le modèle des stories 8.1 à 8.3. 8.4 (historique)
  et 8.5 (émotes) sont développées en parallèle : garder les modifications de `Home.tsx`, `http.ts` et `db.ts`
  petites et locales.
- Choix à noter dans `a-valider-par-root.md` (section « Epics 8 et 10 ») : deck incomplet enregistrable ; 20 decks au
  plus ; appui long = fiche.
- Définition de fini : `pnpm typecheck`, `pnpm test`, `PW_CHANNEL=chromium pnpm e2e -- --trace off` (ports dédiés).

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 10.2]
- [Source: docs/design/deck-builder/README.md et maquettes B / Mes decks]
- [Source: _bmad-output/implementation-artifacts/10-1-regles-de-construction.md]
- [Source: AGENTS.md]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created

### File List
