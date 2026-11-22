---
baseline_commit: b277c68
---

# Story 13.2: Table sans défilement vertical sur mobile

Status: done

## Story

As a joueur sur téléphone,
I want voir toute la table sans faire défiler,
So that je garde l'œil sur la partie.

## Acceptance Criteria

**Given** une partie sur un téléphone en portrait (de 360 × 640 à 430 × 932)
**When** la table s'affiche, à n'importe quel moment de la partie
**Then** tout tient dans la hauteur visible (`100dvh`) sans défilement de la page : les deux camps, le bandeau de tour avec le chrono, les PV et pièces, et la main
**And** la disposition suit la maquette validée par Root, l'option **B · vue d'ensemble + zoom** (`docs/design/mobile-table/`) :
- **Vue d'ensemble :** les deux camps en grilles compactes 2×5, avec les 10 socles visibles (socles vides en runes pointillées) et une fine bande terrains/sorts par camp. Le bandeau de tour et le chrono sont au centre. La main est grande et déborde en éventail sur le bas de l'écran.
- **Zoom :** toucher un camp, choisir un attaquant ou recevoir une demande de cible agrandit le camp concerné, et l'autre se replie en bande de miniatures. Une barre de consigne indique l'action, le chrono et « Annuler », avec un retour « Vue d'ensemble ». Une demande de cible ouvre le zoom toute seule, et il se referme après l'action.
- **Transitions :** le passage d'une vue à l'autre est animé avec la couche de présentation de l'epic 12 (moins de 300 ms, fondu avec « réduire les animations »).

**And** les cibles tactiles mesurent toujours au moins 44 px, et les cartes restent lisibles (nom, coût, ATQ/PV)
**And** les tests e2e vérifient l'absence de défilement vertical à 390 × 844 et 360 × 640 (vue d'ensemble et zoom).

## Tasks / Subtasks

- [x] `Table.tsx` : hook `useCompact()` (`(orientation: portrait) and (max-width: 699px)`) → classe `.table.compact` ; paysage, tablette et ordinateur gardent leur disposition (5.8).
- [x] Vue d'ensemble : héros sur une ligne (avatar, nom, main/pioche/cimetière, PV, pièces, barre de PV fine) ; camp = bouton-zone « Agrandir » (bande terrains/sorts + grille 2×5) ; bandeau au centre ; main en éventail qui déborde en bas. Tailles en `calc()` sur `dvh`/`vw` (aucun défilement de 360 × 640 à 430 × 932).
- [x] Zoom : état `zoom` (manuel : toucher le fond d'un camp ; automatique : attaquant choisi → camp adverse, demande de cibles → camp qui a le plus de cibles, carte terrain/sort choisie dans la main → mon camp). L'autre camp se replie en bande de miniatures (socles occupés seulement, « + N socles libres »), barre de consigne (titre, chrono, Annuler/Valider) et bouton « Vue d'ensemble ». Le zoom automatique se referme quand l'action a fini de se jouer (fin de la lecture de la couche de présentation), un zoom manuel se referme après une action.
- [x] Un seul DOM par camp (`.board.mine/.theirs`, `[data-iid]`) dans les deux vues : le metteur en scène, `SourceLines` et la lueur 13.1 ciblent les bons éléments sans changement.
- [x] Transition : `flipLayout()` dans `director.ts` (FLIP sur les cartes et les camps, 260 ms, `animate()` → fondu avec « réduire les animations »).
- [x] Fiche abaissée 13.3 : sur la table compacte, elle couvre exactement la zone sous mon camp (héros + main), au moins 120 px ; consigner la décision.
- [x] Main adverse : en compact, le nombre de cartes passe dans la ligne du héros ; `backToHand` vise ce compteur.
- [x] e2e `mobile-table.spec.ts` : pas de défilement vertical à 390 × 844 et 360 × 640, vue d'ensemble et zoom (manuel et sur attaque) ; cibles tactiles ≥ 44 px ; le zoom se referme après l'attaque. Les e2e existants restent verts.
- [x] Captures 390 × 844 (vue d'ensemble, zoom) et 360 × 640.

## Dev Notes

- Existant : `Table.tsx` empile topbar, héros, dos de la main adverse, zones, plateau, bandeau, plateau, zones, héros, main (défilement horizontal). `.table` a `min-height: 100dvh` et déborde à 360 × 640 (799 px). Large (`useWide`, ≥ 1100 px) et paysage (`max-height: 600px`) ont leurs propres règles.
- `director.ts` lit les positions au moment du temps fort (`getBoundingClientRect`) : ne pas changer de vue pendant une lecture → le zoom automatique attend que `pb.playing` soit faux.
- `SourceLines` cherche `.board [data-iid]` et `.zones [data-iid]` : garder ces classes.
- Cartes de plateau minuscules en vue d'ensemble : la cible tactile est le socle entier (≥ 44 px), le socle transmet le toucher à la carte.
- Scènes dev `?scene=...` (devscene.ts) pour les e2e.

### References

- `_bmad-output/planning-artifacts/epics.md` — Epic 13, story 13.2.
- `docs/design/mobile-table/B-ensemble.dc.html`, `B-zoom.dc.html`, README.
- Stories 12.1 (couche de présentation), 13.1 (lueur), 13.3 (traits, fiche abaissée).

## Dev Agent Record

### Completion Notes List

- `Table.tsx` : `useMedia(COMPACT_QUERY)` → `.table.compact zoom-none|mine|theirs` ; composant `Side` (vue d'ensemble / agrandi / replié) autour des `Zones` et du `Board` existants (même DOM, mêmes `data-iid`) ; zoom automatique (`autoSide`) : attaquant choisi et fiche fermée → camp adverse ; demande de cibles → camp qui en a le plus ; « Vue d'ensemble » ou toucher l'autre camp l'écarte (`dismissed`). Après une action, le zoom est tenu (`heldZoom`) jusqu'à la fin de la lecture (`pb.playing`), 6 s au plus ou un refus.
- Le socle entier transmet le toucher à sa carte (cible ≥ 44 px même quand la carte fait 47 px de large).
- `director.ts` : `captureLayout` / `flipLayout` (FLIP 260 ms sur les cartes, fondu des camps ; `animate()` ne garde que le fondu avec « réduire les animations »). `backToHand` vise le compteur « Main » du héros adverse quand la rangée de dos de cartes n'existe pas.
- `styles.css` : bloc « compact phone table » ; tailles en `min()`/`calc()` sur `100vw`/`100dvh` (cartes 47 px à 360 × 640, 63 px à 390 × 844 en vue d'ensemble ; 59 / 65 px agrandies) ; main en éventail (`--k`, pas ≥ 44 px, défilement horizontal au-delà) qui déborde du bas ; barre de consigne turquoise pendant un choix.
- Fiche abaissée (13.3) revue : sur la table compacte elle couvre exactement la zone sous mon camp (`--peek-h`, au moins 120 px) au lieu de 34 dvh ; ailleurs inchangée.
- e2e : `mobile-table.spec.ts` (390 × 844 et 360 × 640 : pas de défilement en vue d'ensemble, zoom manuel et zoom d'attaque, cibles ≥ 44 px, fermeture après l'attaque ; paysage et ordinateur sans table compacte). Ajustés : `glossary`, `target-prompt` (carte de main activée au clavier, son centre est couvert par la voisine dans l'éventail), `online-duel` (main adverse = compteur), `online-rejoin` (`.hand .card`).
- `pnpm typecheck` OK, `pnpm test` 136/136, `PW_CHANNEL=chromium pnpm e2e -- --trace off` 21/21. Captures 390 × 844 (vue d'ensemble, zoom, fiche abaissée), 360 × 640, 430 × 932, paysage.

### File List

- apps/client/src/ui/Table.tsx, director.ts, CardView.tsx, Icon.tsx
- apps/client/src/styles.css
- e2e/mobile-table.spec.ts (nouveau), glossary.spec.ts, target-prompt.spec.ts, online-duel.spec.ts, online-rejoin.spec.ts
- _bmad-output/implementation-artifacts/a-valider-par-root.md, sprint-status.yaml

## Change Log

- 2026-11-22 — Table compacte en portrait : vue d'ensemble + zoom (maquette B), transitions FLIP, fiche abaissée recalée (mode autonome).
