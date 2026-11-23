---
baseline_commit: 9a25211
---

# Story 14.2: Main repliée derrière le bouton éventail, vue compacte

Status: done

## Story

As a joueur sur téléphone,
I want ouvrir et fermer ma main d'un bouton,
So that chaque carte soit facile à toucher sans cacher la table.

## Acceptance Criteria

**Given** la table compacte
**Then** il n'y a plus de rangée de main en bas : mon bandeau porte un bouton « éventail + pastille » (trois cartes en
éventail, nombre de cartes en pastille rouge ; ouvert : l'éventail s'écarte, couleurs inversées), au moins 44 px
touchables
**And** le bouton ouvre la main dans un panneau opaque, sans en-tête ni bouton de fermeture, posé par-dessus le bas de
mon camp ; le plateau ne bouge pas et ne change pas de taille ; le même bouton la referme
**And** vue compacte : les faces entières des cartes (`CardView`) sur une ligne qui défile horizontalement, sans
défilement vertical
**And** toucher une carte ouvre la fiche actuelle (avec « Jouer ») ; « Jouer » referme la main pour laisser voir la
table pendant la pose
**And** la main reste fermée quand je pioche : la pastille s'anime ; la pioche et le retour en main visent le bouton
quand la main est fermée
**And** les e2e jouent une carte en ouvrant la main ; planches `scripts/compare-demo.mjs` à jour

Hors périmètre : vue détaillée et carte complète (14.3), réglage « Main ouverte » (14.4). Le panneau est un conteneur
`.hand.hand-panel > .hand-row` : 14.3 pourra y ajouter un second mode (classe sur le panneau, hauteur propre).

## Tasks / Subtasks

- [x] `Table.tsx` : état `handOpen` ; bouton `button.hand-btn` (SVG éventail, `span.hand-badge`, `aria-expanded`,
  `aria-controls="cc-hand"`) au bout de mon bandeau, table compacte seulement ; mon compteur « Main » retiré de mon
  bandeau (l'adversaire garde le sien) (AC 1)
- [x] Panneau `div.hand.hand-panel[role=region][aria-label="Ta main"]` dans `.side.mine`, en position absolue en bas
  du camp ; les cartes (`handCards`, mêmes `CardView` que la rangée d'ordinateur) dans `.hand-row` (AC 2, 3)
- [x] Fermeture : « Jouer » (`playFromHand`), changement de joueur (deux sur ce téléphone), début d'un choix de cibles
  (AC 4)
- [x] `director.ts` : `myHand()` = panneau ouvert, sinon bouton ; pioche et retour en main visent le bouton quand la
  main est repliée, puis `popBadge` (AC 5)
- [x] `mobile-table.css` : plus de rangée de main ; les camps se partagent la hauteur ; cartes et plaques agrandies ;
  styles du bouton (maquette `Bouton-main.dc.html`, option 1) et du panneau (maquette `F-compacte`)
- [x] e2e : `e2e/hand.ts` (`openHand`), specs qui jouent une carte mises à jour ; nouveaux tests (bouton, plateau
  immobile, « Jouer » referme, pioche vers le bouton et pastille, deux sur ce téléphone, pas de défilement avec 10
  cartes) ; `compare-demo.mjs` et `perf-phone.mjs` ouvrent la main
- [x] `scripts/compare-desktop.mjs` avant/après ; captures 390 × 844 et 360 × 640 main fermée et ouverte ; planches
  `compare-demo` (pose d'un personnage, sort)
- [x] `pnpm typecheck`, `pnpm test`, e2e complet

## Dev Notes

- Table compacte seulement (`COMPACT_QUERY`) : ordinateur, tablette et paysage gardent la rangée `.hand > .hand-fan`
  telle quelle (même balisage, `handCards` partagé).
- Hauteur : `--fixed` compte 5 espaces (plus de rangée de main), `--zh = clamp(24px, 8dvh - 24px, 30px)`,
  `--cw = min(76px, --cwmax, (100dvh - --fixed - 2 × --side-x) / 5.6)` ; `.side` en `flex: 1 1 auto`, contenu centré.
- Panneau : `height: min(58%, 116 × 1.4 + 18 px)` du camp, `container-type: size`, cartes de largeur
  `(100cqh - 18px) / 1.4` ; noms ≥ 8 px (`max(8px, 9.5cqw)`).
- Le metteur en scène garde `handSeen` (`noteHand`) : une carte jouée depuis le panneau part de l'endroit où elle était,
  même si le panneau s'est refermé.

### References

- `_bmad-output/planning-artifacts/epics.md` → Epic 14, Story 14.2
- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-11-23-table-v2.md`
- `docs/design/mobile-table-v2/Bouton-main.dc.html`, `F-compacte.dc.html`, `F-compacte-360.dc.html`,
  `rendus/F-compacte.png`, `rendus/F-compacte-360.png`, `rendus/F-reglages.png`
- Story 14.1 (`14-1-table-sans-zoom-rangees-terrains-et-sorts.md`)

## Dev Agent Record

### Agent Model Used

Agent dev (Claude Code)

### Debug Log References

- Captures (hors des dossiers suivis), scène `?scene=pleine` : 390 × 844 cartes de la table 70 px, plaques 30 px,
  panneau 180 px, cartes de la main 116 px ; 360 × 640 cartes 56 px, plaques 27 px, panneau 133 px, cartes de la main
  82 px ; 430 × 932 cartes 76 px. Aucun défilement vertical, camp inchangé à l'ouverture. Comparées aux rendus F.
- `scripts/compare-desktop.mjs` (build 9a25211 contre build après, `VITE_SCENES=1`) : tout à 0,000 % sauf bureau-table
  0,002 % (braises, même bruit qu'en 14.1). Ordinateur et tablette inchangés.
- Planches `compare-demo` (pose-personnage, sort) regardées : la carte part de sa place dans le panneau, refermé.

### Completion Notes List

- Bouton éventail + pastille au bout de mon bandeau, panneau opaque par-dessus le bas de mon camp, rangée de cartes
  entières qui défile horizontalement ; « Jouer » referme la main.
- Pioche et retour en main volent jusqu'au bouton quand la main est repliée, et la pastille grossit un instant.
- Cartes de la table et plaques agrandies avec la place rendue par la rangée de main.
- Choix par défaut listés dans `a-valider-par-root.md`.
- Tests : `pnpm typecheck` OK ; `pnpm test` 313/313 ; e2e complet 55/55
  (`E2E_SERVER_PORT=2867 E2E_CLIENT_PORT=5474`). Pas de simulation de 200 parties (ni moteur ni cartes touchés).

### File List

- apps/client/src/ui/Table.tsx
- apps/client/src/ui/director.ts
- apps/client/src/styles/mobile-table.css
- e2e/hand.ts
- e2e/mobile-table.spec.ts
- e2e/play-draw.spec.ts
- e2e/glossary.spec.ts
- e2e/target-prompt.spec.ts
- e2e/spotlight-removal.spec.ts
- e2e/triggers-spells.spec.ts
- e2e/online-duel.spec.ts
- e2e/online-rejoin.spec.ts
- e2e/constructed.spec.ts
- scripts/compare-demo.mjs
- scripts/perf-phone.mjs
- _bmad-output/implementation-artifacts/14-2-main-repliee-bouton-eventail-vue-compacte.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/a-valider-par-root.md

### Change Log

- 2026-11-23 : story créée puis implémentée (main repliée derrière le bouton éventail, vue compacte).
