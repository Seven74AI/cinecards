# Story 11.7: Distinguer les catégories de cartes

Status: done

## Story

As a joueur,
I want reconnaître d'un coup d'œil un personnage, un sort, un équipement ou un terrain,
So that je ne confonde pas les cartes en main ou en jeu.

## Acceptance Criteria

**Given** une carte de chaque catégorie et de chaque rareté
**When** elle est affichée en main, en socle ou en fiche
**Then** la catégorie se lit au jeton de coût (blason, sceau de cire, écrou d'acier, losange vert, chacun avec son icône) et à la teinte du parchemin, comme sur la maquette D
**And** la rareté se lit à la gemme et aux ornements, comme sur les maquettes E et F : commune nue ; rare avec anneau gravé, équerres et liseré bleu ; épique avec pierre sertie, fleurons et halo violet ; légendaire avec laurier lumineux, filigrane, cadre ardent et reflet
**And** chaque capacité porte son étiquette de déclencheur (« À l'arrivée », « Attaque spéciale », « Passif », « Effet »…)
**And** toutes les catégories ont une rareté : le schéma sépare `rarity` (commune → légendaire) de `category`, les valeurs `spell`/`terrain` de rareté disparaissent, et les 13 sorts, équipements et terrains reçoivent une rareté proposée selon la courbe de coût, listée dans `a-valider-par-root.md`
**And** les ornements sont en SVG/CSS (pas d'images lourdes) ; les animations (laurier, reflet) s'arrêtent avec « réduire les animations »
**And** la différence reste lisible en miniature, en mobile portrait comme sur ordinateur, et la forme du jeton suffit sans les couleurs

## Tasks / Subtasks

- [x] Schéma : `RaritySchema` = common | rare | epic | legendary ; `spell`/`terrain` refusés (test du chargeur).
- [x] `content/sets/*.json` : rareté des 13 sorts / équipements / terrains selon la courbe du GDD (commune 1-3, rare 4-5, épique 6-8, légendaire 9+ ; terrains selon l'impact) ; `test-utils.ts` du moteur.
- [x] `CardView.tsx` : classes `cat-*` (teinte) et `r-*` ; jeton de coût par catégorie (forme en `clip-path`, icône SVG), anneau (rare+), pierre sertie (épique+), laurier (légendaire) ; équerres (rare), fleurons (épique+), filigrane et reflet (légendaire).
- [x] `styles.css` : port des maquettes D/E/F, tailles relatives à la carte (`container-type: inline-size`, unités `cqw`), icône du jeton masquée sous 90 px de large ; `prefers-reduced-motion` coupe laurier et reflet.
- [x] `CardSheet.tsx` : méta « Catégorie · Rareté · rôle · film » ; étiquette de déclencheur en pastille devant chaque capacité (« Attaque spéciale », « Effet » pour les sorts, « Passif »…).
- [x] Captures Playwright (main, socle, fiche ; 390 px portrait et ordinateur), vérifiées à l'œil.
- [x] `a-valider-par-root.md` : raretés proposées et choix d'étiquettes.

## Dev Notes

- Cartes et art sont empaquetés côté client (`apps/client/src/game/catalog.ts`) : pas de changement de protocole. Le serveur lit les mêmes JSON ; la rareté n'a pas d'effet sur les règles (seule la mise en avant « légendaire » côté client, `fx.ts`, s'applique désormais aussi aux sorts/terrains légendaires).
- Ne pas réutiliser le nom de classe `.seal` (déjà pris par les zones terrain de la table) : préfixer les jetons `tok-*`.
- Les zones terrain/sort (`.seal.filled .card`, `.rune.filled .card`) montrent une vignette sans nom ni coût : y masquer aussi le jeton et les ornements.
- `TRIGGERS.attack.label` devient « Attaque spéciale » (décision de Root, glossaire).

### References

- docs/design/card-frames/ (Jetons, Raretes, Ornements) ; GDD « Art Style » et « Raretés » ; glossaire-mots-cles.md (décisions de Root).

## Dev Agent Record

### Completion Notes List

- Jeton de coût porté des maquettes D/F (`clip-path` blason / hexagone / losange, sceau en `border-radius`), taille relative à la carte via `container-type: inline-size` (`--tk: clamp(20px, 30cqw, 40px)`) ; icône affichée à partir de 88 px de large. Rareté : liseré + halo (E), équerres / fleurons / filigrane / reflet en SVG-CSS et laurier SVG autour du jeton (F). Le reflet et le laurier s'arrêtent avec `prefers-reduced-motion`.
- `TRIGGERS.attack.label` → « Attaque spéciale » ; étiquettes calculées dans `game/labels.ts` (testé), affichées en pastille sur la fiche.
- Zone de la main : marge haute agrandie pour ne pas rogner jeton et laurier ; fiche : marge autour de la grande carte.
- Captures vérifiées (390 × 844 et 1440 × 900, deviceScaleFactor 1) : main, socles, fiches (légendaire, sort épique), collection.
- `pnpm typecheck` OK, `pnpm test` 113/113 (simulation 200 parties incluse), `PW_CHANNEL=chromium pnpm e2e -- --trace off` 6/6 (2026-11-22).

### File List

- packages/cards/src/schema.ts, parse.test.ts
- packages/engine/src/test-utils.ts, effects/triggers.ts
- content/sets/holy-grail.json, hot-shots.json, matrix.json, white-chicks.json
- apps/client/src/ui/CardView.tsx, CardSheet.tsx
- apps/client/src/game/labels.ts, labels.test.ts
- apps/client/src/styles.css
- _bmad-output/implementation-artifacts/a-valider-par-root.md, sprint-status.yaml

## Change Log

- 2026-11-22 — Catégorie au jeton de coût, rareté aux ornements, rareté pour toutes les catégories (mode autonome).
