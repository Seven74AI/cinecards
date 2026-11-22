---
baseline_commit: 6271653
---

# Story 12.5: Poser et piocher

Status: done

## Story

As a joueur,
I want voir les cartes voyager,
So that je sache qui joue quoi.

## Acceptance Criteria

**Given** une pose ou une pioche, à moi ou à l'adversaire
**When** elle se joue
**Then** la carte suit une trajectoire main → socle ou deck → main
**And** l'atterrissage est propre à la catégorie : éclat de runes pour un personnage, brûlure et effet pour un sort, onde de famille pour un terrain, éclat métallique pour un équipement
**And** l'adversaire voit un dos de carte quand il pioche.

## Tasks / Subtasks

- [x] `fx.ts` : `TIMING.play` 620 ms (vol en arc de la démo), `TIMING.draw` (pioche 0,5 s ; les pioches suivantes d'un même lot se chevauchent), sorts instantanés `spellCast`.
- [x] `present.ts` / `playback.ts` : `incoming` = cartes piochées dont le temps n'est pas encore joué (lot courant et lots en attente) ; la main (état réel) les cache jusqu'à leur temps.
- [x] `director.ts` : `noteHand()` (positions des cartes de ma main à chaque rendu) ; `cardPlayed` : la carte part de la main (la mienne : sa dernière position ; l'adverse : sa main / le compteur « Main » de son héros), monte en arc, grossit au-dessus du socle et s'y pose ; atterrissage : personnage = cercle de runes + poussière dorée + petit tremblement ; terrain = sceau qui s'imprime + onde verte ; équipement = éclat métallique (reflet + éclats argentés) ; sort instantané = la carte grandit au centre de la table et brûle (braises). `cardDrawn` : un dos de carte sort de la pioche, glisse vers la main et se retourne (chez moi, la vraie carte apparaît en se retournant ; chez l'adversaire, le dos reste un dos). `summoned` : la carte arrive de sa zone d'origine.
- [x] Tests : unitaires (`fx`, `present`), e2e `play-draw.spec.ts` (ordre des temps, carte posée animée, carte piochée cachée puis révélée), captures 390 px.

## Dev Notes

- La main suit l'état réel (`state`), le plateau l'état affiché (`shown`) : une carte jouée quitte la main tout de suite, d'où `noteHand()` pour retrouver son point de départ.
- `direct()` est appelé avant le rendu du temps : comme pour la mort, l'animation part dans un `requestAnimationFrame`.
- La table compacte (13.2) n'a pas de rangée de dos adverses : départ / arrivée sur le compteur du héros.

### References

- `_bmad-output/planning-artifacts/epics.md` — Epic 12, story 12.5 ; `retours-visuels-actions.md` (catalogue) ; `docs/design/animations/demo.html` (scène « Poser + À l'arrivée » : `flyCard`, `runeFlash`, pioche).

## Dev Agent Record

### Completion Notes List

- `fx.ts` : pose 620 ms (sort instantané 700 ms), pioche 420 ms (140 ms à partir de la 3ᵉ pioche d'un joueur dans un même lot), son « draw ».
- `present.ts` : `ShownView.incoming` + `drawnBy()` ; `playback.ts` ajoute les pioches des lots en attente. `Table.tsx` cache (opacité 0) les cartes de ma main encore « à venir ».
- `director.ts` : `noteHand()`, `flyIn` (arc de la démo), atterrissages `runeLanding` / `sealLanding` / `metalLanding`, `castSpell` (carte fantôme au centre qui brûle, braises), `drawn` (dos de carte deck → main puis retournement, `scale` individuel pour ne pas casser l'éventail), `summonedIn` (cimetière, main ou autre camp). Départ / arrivée adverse : rangée de dos, ou compteur « Main » du héros sur la table compacte.
- Scène dev `?scene=pose` (missile, Camelot, A.P.U en main).
- Tests : unitaire `12.5 play and draw` (present.test.ts), e2e `play-draw.spec.ts` (trajectoire de la carte posée image par image, cercle de runes, dos de carte pour les deux pioches, carte piochée cachée puis visible). `pnpm typecheck` OK, `pnpm test` 137/137, e2e 23/23. Captures 390 px (pose, pioche, sort).

### File List

- apps/client/src/game/fx.ts, present.ts, playback.ts, present.test.ts, devscene.ts
- apps/client/src/audio/sfx.ts
- apps/client/src/ui/director.ts, Table.tsx
- apps/client/src/styles.css
- e2e/play-draw.spec.ts
- _bmad-output/implementation-artifacts/a-valider-par-root.md, sprint-status.yaml

## Change Log

- 2026-11-22 — Trajectoires main → socle et deck → main, atterrissages par catégorie (mode autonome).
