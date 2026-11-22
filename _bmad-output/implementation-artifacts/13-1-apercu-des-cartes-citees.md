---
baseline_commit: 7877c70
---

# Story 13.1: Aperçu des cartes citées

Status: done

## Story

As a joueur,
I want voir un aperçu d'une carte citée dans un texte,
So that je comprenne la combinaison sans quitter la partie.

## Acceptance Criteria

**Given** un texte de carte qui cite une autre carte, entre guillemets ou par son nom d'usage (« Arthur », « Trinity », « Kevin »…, une table d'alias par carte dans les données)
**When** je touche ce nom (ou le survole sur ordinateur)
**Then** un aperçu de la carte citée s'affiche en surimpression : la carte en taille lisible et ses capacités, avec « Voir la fiche » et la fermeture d'un geste
**And** si la carte citée est en jeu, son socle s'illumine sur la table
**And** toutes les cartes du MVP qui citent une autre carte sont couvertes par un test (aucun nom cité non reconnu).

## Tasks / Subtasks

- [x] Données : champ optionnel `aliases: string[]` dans `CardSchema` (`packages/cards/src/schema.ts`) ; alias dans les sets (Arthur, Topper, Iffune, Marcus, Kevin, Smith, Sentinelles, A.P.U, Néo…). Le JSON reste lisible (une ligne `"aliases": [...]` après `name`).
- [x] `game/richtext.ts` : en plus des citations entre « », reconnaître les mentions sans guillemets (nom exact, partie avant « a.k.a », alias), sensibles à la casse, aux frontières de mots ; jamais la carte elle-même dans son propre texte ; formes ambiguës (deux cartes) ignorées.
- [x] `ui/Refs.tsx` : toucher un renvoi ouvre un **aperçu** (`CardPreview`) au-dessus de la fiche en cours (qui reste ouverte) : carte en grand, capacités (celle citée en surbrillance), « Voir la fiche » (pile de fiches : fermer revient à la précédente), fermeture par tap à l'extérieur, Échap ou ×. Sur ordinateur (souris), survol d'un renvoi : aperçu non modal après un court délai.
- [x] Table : le socle de la carte citée en jeu s'illumine (`.ref-glow`) ; la fiche en dessous s'efface pendant l'aperçu pour laisser voir la table ; l'aperçu se place sur la moitié de l'écran opposée au socle illuminé.
- [x] Tests : `richtext.test.ts` — chaque texte du MVP : toute citation « … » est résolue ou listée comme non-carte, tout mot à majuscule qui est un nom de carte est relié, table des renvois attendus. e2e `glossary.spec.ts` mis à jour (aperçu, « Voir la fiche », Échap) + un e2e en partie (socle illuminé). Captures 390 px.

## Dev Notes

- Existant (story 11.8) : `RefProvider` (une seule `CardInfo` qui remplaçait la précédente), `AbilityText` (boutons `.kw` / `.ref`), `segmentText` (citations « » seulement), `resolveReference` (nom exact, sans article, avant « a.k.a », ou unique nom contenant la citation).
- À préserver : `openCard` (collection de l'accueil → fiche complète), bulles de mots-clés, écran « Règles et mots-clés », sélection / attaque / cibles dans `Table.tsx` (l'aperçu ne touche pas au `mode`).
- Le serveur charge les mêmes JSON : `aliases` est optionnel, ignoré par le moteur ; pas de changement de protocole.
- Pas de changement de moteur ni de capacités : la simulation de 200 parties est relancée quand même (les JSON de cartes changent).

### References

- `_bmad-output/planning-artifacts/epics.md` — Epic 13, story 13.1 ; story 11.8 (`11-8-glossaire-et-renvois.md`).

## Dev Agent Record

### Completion Notes List

- `packages/cards/src/schema.ts` : `aliases?: string[]` (optionnel, ignoré par le moteur ; un ancien serveur l'enlève simplement). 18 alias dans les 4 sets.
- `game/richtext.ts` : `mentionForms` (nom, partie avant « a.k.a », alias ; ≥ 3 lettres) et une regex unique par catalogue (mise en cache), sensible à la casse, aux frontières de mots ; formes partagées par deux cartes ignorées ; la carte elle-même jamais reliée. Appliquée au texte hors citations « ».
- `ui/Refs.tsx` : `previewCard` / `hoverCard` / `previewId` dans le contexte ; `CardPreview` (carte 96 px, capacités, celle citée en surbrillance, « Voir la fiche », fermeture par tap extérieur, Échap ou ×) ; survol souris 250 ms, non modal ; fiches `CardInfo` empilées. `openCard` (collection) inchangé.
- `ui/Table.tsx` : `.ref-glow` sur le socle (personnages, terrains, sorts) de la carte prévisualisée. Pendant l'aperçu, la fiche mobile s'efface (`body.ref-peek`) et l'aperçu se place sur l'autre moitié, sans recouvrir le socle (hauteur limitée).
- Scène dev `?scene=renvois` (Patsy et Arthur ; Ramada et Topper en face).
- Tests : `richtext.test.ts` (+5 : Patsy → Arthur, jamais soi-même ni « la Matrice », table des renvois attendus, toute citation résolue ou listée, tout mot à majuscule qui appartient au nom d'une autre carte est relié) ; e2e `glossary.spec.ts` (aperçu par-dessus la fiche, Échap, « Arthur » sans guillemets, « Voir la fiche » puis retour à Patsy ; en partie : socle d'Arthur illuminé, tap à l'extérieur).
- `pnpm typecheck` OK, `pnpm test` 131/131 (simulation de 200 parties comprise), `PW_CHANNEL=chromium pnpm e2e -- --trace off` 15/15. Captures 390 px vérifiées.

### File List

- content/sets/holy-grail.json, hot-shots.json, matrix.json, white-chicks.json
- packages/cards/src/schema.ts
- apps/client/src/game/richtext.ts, richtext.test.ts, devscene.ts
- apps/client/src/ui/Refs.tsx, Table.tsx
- apps/client/src/styles.css
- e2e/glossary.spec.ts
- _bmad-output/implementation-artifacts/a-valider-par-root.md, sprint-status.yaml

## Change Log

- 2026-11-22 — Alias de cartes, renvois sans guillemets, aperçu des cartes citées avec socle illuminé (mode autonome).
