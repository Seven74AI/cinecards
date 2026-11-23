---
baseline_commit: 3c244e59179e3b2871a3174d606c0a7ab19d6463
---

# Story 10.2: Écran de construction

Status: done

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

- [x] **Base** — migration suivante ajoutée **à la fin** de `MIGRATIONS` (`apps/server/src/db/db.ts`) ; ne jamais
      modifier une migration livrée. **Attention :** la story 8.4 (historique) ajoute aussi une migration en parallèle ;
      la tienne doit rester la dernière du tableau (au moment de fusionner, elle passera après celle de 8.4) et son
      test d'upgrade part de « la version précédente » (`MIGRATIONS.length - 1`), pas d'un numéro en dur.
  - [x] `decks(id INTEGER PRIMARY KEY, account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        name TEXT NOT NULL, cards TEXT NOT NULL /* JSON string[] */, created_at INTEGER NOT NULL, updated_at INTEGER
        NOT NULL)` + index `account_id`.
  - [x] `apps/server/src/db/decks.ts`.
- [x] **API** — `apps/server/src/api/http.ts` (+ service) (AC 2, 6, 9)
  - [x] `GET /api/decks` → `{ decks: [{ id, name, cards, valid, errors, updatedAt }] }` ; `POST /api/decks`
        `{ name, cards }` → `201 { deck }` ; `PUT /api/decks/:id` → `200 { deck }` ; `DELETE /api/decks/:id` → `204`.
        Nom : 1 à 30 caractères (espaces retirés), défaut « Nouveau deck ». `cards` : 0 à 60 identifiants **connus**
        (inconnus → `400 unknown_card`), doublons retirés ; `valid` / `errors` calculés avec `validateDeck` et
        `playableCardIds`. 20 decks au plus (`409 deck_limit`). Un compte ne voit et ne modifie que ses decks.
        `PUT` ajoute `PUT` à `Access-Control-Allow-Methods`. `/api/health` ajoute `decks: true`.
- [x] **Client** — `apps/client/src/decks/` (AC 1-8)
  - [x] `DecksScreen.tsx` (Mes decks) et `DeckBuilder.tsx` (B) : écrans plein écran (pas une fenêtre), ouverts depuis
        l'accueil, avec retour vers l'accueil ; style et palette du jeu (reprendre les styles de la maquette dans
        `styles.css`, préfixe `.deck-`).
  - [x] Filtres purs et testés (`filters.ts`) : recherche sans accents, film, catégorie, rareté, coût, tri.
  - [x] Utiliser `CATALOG` / `PLAYABLE` (`game/catalog.ts`), `CardView` (taille adaptée à 3 colonnes), la fiche
        (`useRefs().openCard`), `validateDeck` (`@cinecards/cards`), `account/api.ts` pour les appels.
  - [x] `ui/Home.tsx` : bouton « Mes decks » dans `.account-line` (garder « Connecté : <pseudo> »).
- [x] **Tests**
  - [x] Serveur : migration, routes, validation serveur, limites, isolation entre comptes.
  - [x] Client : filtres et tri.
  - [x] e2e `e2e/decks.spec.ts` : compte → Mes decks → Nouveau deck → filtrer par film → ajouter des cartes → compteur
        et erreur → ajouter jusqu'à 50 → « Valide » → enregistrer → retour : le deck est listé « Valide » ; copier ;
        supprimer avec confirmation.
- [x] **Captures** 390 × 844 (×1) de Mes decks, du constructeur, de la feuille Filtres et de la feuille Mon deck, et
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

Agent de développement (gds-dev-story)

### Debug Log References

- `pnpm typecheck` : vert. `pnpm test` : 31 fichiers, 251 tests verts.
- `E2E_SERVER_PORT=2687 E2E_CLIENT_PORT=5294 PW_CHANNEL=chromium pnpm e2e -- --trace off` : 43 tests verts (dont les 2 de `e2e/decks.spec.ts`).
- Premier passage de `decks.spec.ts` : le nom du film était un nœud de texte à côté du compteur (`getByText('Matrix', { exact: true })` introuvable) ; les titres complets des sets (« Monty Python : Sacré Graal ! ») ne collaient pas à la maquette → noms courts (`family`) et titre dans son propre `<span>`.
- Avertissement React « <button> cannot contain a nested <button> » : l'éventail de « Mes decks » utilisait `CardView` dans le bouton « Modifier » → miniature dédiée (`.deck-mini` : illustration + jeton de coût du jeu).
- Simulation de 200 parties non relancée : ni le moteur ni les cartes ne changent.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- **Base** : migration `decks` ajoutée à la fin de `MIGRATIONS` (+ index `decks_account`, `ON DELETE CASCADE`) ; `db/decks.ts` (liste, lecture, compte, ajout, mise à jour, suppression, toujours filtrés par compte). Test d'upgrade depuis `MIGRATIONS.length - 1`. Les tests qui figeaient la version 3 ou la réponse de `/api/health` suivent (`MIGRATIONS.length`, `decks: true`, `PUT`).
- **API** : `DeckService` (`apps/server/src/decks/decks.ts`) : `GET/POST /api/decks`, `PUT/DELETE /api/decks/:id`. Nom nettoyé (espaces, caractères de contrôle), 30 caractères au plus (`400 bad_name`), défaut « Nouveau deck » ; 0 à 60 cartes connues (`400 bad_cards` / `400 unknown_card`), doublons retirés ; `valid` / `errors` toujours calculés par `validateDeck` (`@cinecards/cards/deck`) avec `playableCardIds` du serveur ; 20 decks (`409 deck_limit`) ; un autre compte reçoit `404`. `PUT` ajouté aux méthodes CORS ; `/api/health` ajoute `decks: true`.
- **Client** : `serverFeatures().decks` et `useAccount().decks` ; bouton « Mes decks » dans `.account-line` (caché sans `decks: true`). `DecksScreen` (Mes decks : éventail, films, « N / 50 », statut, Modifier / Copier / Supprimer avec confirmation, « Nouveau », limite de 20) et `DeckBuilder` (maquette B : grille de vrais `CardView` en 3 colonnes, coche dorée / « + », toucher = ajouter ou retirer, appui long ou clic droit = fiche `openCard`, barre du bas « N / 50 », barre de progression, première erreur ou « Valide », « Voir le deck › » ; en haut retour, nom modifiable avec crayon, « ⋯ » Copier / Supprimer, « Enregistrer » ; feuille Filtres : film avec recherche, catégorie, rareté, coût, « Masquer mon deck », « Tout effacer », « Voir N cartes » ; puces actives avec × ; « N cartes · tri : coût » (coût, nom, film) ; feuille Mon deck : compteur, erreur, courbe 0 à 9+, groupes par catégorie, toucher = retirer, bouton grille / liste). « Quitter sans enregistrer ? » si le nom ou les cartes ont changé. Écrans plein écran (`position: fixed`), seule la grille (ou la liste) défile, cibles de 44 px, marge basse de la grille sous la barre ; 4 à 6 colonnes sur tablette et ordinateur.
- `CardView` reçoit une prop optionnelle `label` (nom accessible « Ajouter Tank » / « Retirer Tank ») ; `catalog.ts` exporte `SET_FAMILIES` (noms courts des films).
- **Tests** : serveur `decks.test.ts` (upgrade, service, limites, isolation, HTTP) ; client `decks/filters.test.ts` (recherche sans accents, filtres, tri, films, courbe, textes) ; e2e `e2e/decks.spec.ts` (parcours complet + 360 × 640 sans débordement, 3 colonnes, dernière rangée au-dessus de la barre, appui long = fiche).
- **Captures** (390 × 844 et 360 × 640, échelle 1) dans `screens/10-2/`, comparées aux captures de la maquette B / Mes decks ; écarts corrigés : noms coupés par la coche (marge droite du nom), lauriers de l'éventail masqués.
- Écarts gardés exprès : textes au tutoiement ; champs de saisie en 16 px (évite le zoom automatique de l'iPhone ; la maquette met 14-15 px) ; le jeton de coût d'un terrain affiche « 0 » (composant du jeu) au lieu de « – » ; « Masquer mon deck » et le bouton grille / liste n'existent pas dans la maquette (demandés par l'AC) ; la feuille « Mon deck » montre toutes les cartes (la maquette résumait « + 29 autres ») ; « Nouveau deck » en pointillés seulement quand la liste est vide.
- Choix notés dans `a-valider-par-root.md` (section « Epics 8 et 10 »).

### File List

- `apps/server/src/db/db.ts` (modifié : migration `decks` à la fin)
- `apps/server/src/db/decks.ts` (nouveau)
- `apps/server/src/decks/decks.ts` (nouveau)
- `apps/server/src/api/http.ts` (modifié : routes decks, `PUT` en CORS, `decks: true`)
- `apps/server/src/main.ts` (modifié : `DeckService`)
- `apps/server/src/decks.test.ts` (nouveau)
- `apps/server/src/accounts.test.ts` (modifié : `/api/health`, méthodes CORS)
- `apps/server/src/friends.test.ts` (modifié : version de schéma, `/api/health`)
- `apps/client/src/account/api.ts` (modifié : `decks` dans `serverFeatures`, appels decks)
- `apps/client/src/account/session.ts` (modifié : `decks` dans l'état)
- `apps/client/src/decks/DecksScreen.tsx` (nouveau)
- `apps/client/src/decks/DeckBuilder.tsx` (nouveau)
- `apps/client/src/decks/parts.tsx` (nouveau)
- `apps/client/src/decks/icons.tsx` (nouveau)
- `apps/client/src/decks/longPress.ts` (nouveau)
- `apps/client/src/decks/filters.ts` (nouveau)
- `apps/client/src/decks/filters.test.ts` (nouveau)
- `apps/client/src/ui/Home.tsx` (modifié : bouton « Mes decks », écran plein écran)
- `apps/client/src/ui/CardView.tsx` (modifié : prop `label`)
- `apps/client/src/game/catalog.ts` (modifié : `SET_FAMILIES`)
- `apps/client/src/styles.css` (modifié : styles `.deck-*`)
- `e2e/decks.spec.ts` (nouveau)
- `_bmad-output/implementation-artifacts/screens/10-2/*.png` (nouveau : `mes-decks.png`, `mes-decks-supprimer.png`, `builder.png`, `builder-filtres.png`, `builder-mon-deck.png`, `builder-mon-deck-liste.png`, `builder-360x640.png`, `builder-desktop.png`, `home-account-line.png`)
- `_bmad-output/implementation-artifacts/a-valider-par-root.md` (modifié)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modifié)
- `_bmad-output/implementation-artifacts/10-2-ecran-de-construction.md` (modifié)

## Change Log

- 2026-11-23 — Story 10.2 implémentée : decks enregistrés sur le compte (migration, API, validation serveur), écrans « Mes decks » et constructeur (maquette B), filtres, feuilles Filtres et Mon deck, tests serveur / client / e2e, captures. Statut : review.
