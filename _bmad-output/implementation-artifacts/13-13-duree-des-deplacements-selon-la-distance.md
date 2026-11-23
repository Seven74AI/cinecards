---
baseline_commit: 1304337
---

# Story 13.13: Durée des déplacements selon la distance

Status: done

## Story

As a joueur,
I want qu'une carte mette plus de temps à traverser toute la table qu'à frapper la carte d'en face,
So that les mouvements aient une vitesse naturelle au lieu de ralentir sur les courtes distances et de sauter sur les longues.

## Acceptance Criteria

Maquette validée par Root le 2026-11-23 (`docs/design/animations/maquette-13-13-a-13-15.html`, https://claude.ai/artifact/HjYL1PQArdUrPqSRRPMNon) :
référence = distance typique de chaque écran, bornes 0,7 – 1,4, ordinateur **et** téléphone.

1. **Given** un déplacement (charge d'attaque, carte posée depuis la main ou depuis la mise en avant, carte invoquée, pioche,
   retour en main, rayon ou orbe d'une capacité, cendres vers le cimetière) **Then** sa durée vaut sa durée actuelle ×
   `clamp(distance / référence, 0,7, 1,4)`, la distance étant mesurée à l'écran au moment où il part.
2. Références (px, distance typique mesurée dans la scène `pose`) : ordinateur attaque 300, pose 550, pioche 600, effet 300 ;
   table compacte du téléphone attaque 210, pose 320, pioche 200, effet 270. Constantes nommées dans `game/motion.ts`.
3. Le temps suivant commence à l'arrivée : la lecture (`Playback`) donne à chaque temps une fonction `retime(ms)` que le
   directeur appelle avec la durée mesurée ; `planBeats` reste pur et inchangé. Une carte qui meurt ou repart en main reste
   sur sa case jusqu'à la nouvelle fin.
4. Seule la partie déplacement change : l'élan de l'attaque (220 ms), les impacts, chiffres, fondus et la mise en avant
   gardent leur durée. Le sort qui grandit au centre de la table (`castSpell`) ne change pas (trajet presque constant).
5. `PHONE_TEMPO`, le réglage de vitesse (rapide, accéléré) et « réduire les animations » s'appliquent toujours ; vitesse
   instantanée : rien ne change.
6. Les e2e d'ordre des temps restent verts ; tests unitaires du facteur et du `retime` de la lecture.

## Tasks / Subtasks

- [x] `game/motion.ts` : `TRAVEL_BOUNDS` {0,7 ; 1,4}, `TRAVEL_REF` {desk, phone} × {attack, fly, draw, effect}, `travelFactor(d, ref)` pur.
- [x] `game/playback.ts` : `Cue.retime?(ms)` ; sur le temps qui porte la minuterie, appel synchrone (avant la minuterie) ou
      différé (dans un `requestAnimationFrame`) ; replanifie la minuterie, `endsAt` et la minuterie de la carte retenue.
- [x] `ui/director.ts` : `travelK(d, kind)` ; attaque (charge et retour × k, `retime(élan + charge)`), pose et invocation
      (vol × k), pioche, retour en main, rayons et orbes (k de la cible la plus lointaine), cendres.
- [x] Tests : `ui/anim.test.ts` ou `game/motion.test.ts` (facteur, bornes, références) ; `game/playback.test.ts` (retime
      synchrone et différé, carte retenue).
- [x] Choix par défaut dans `a-valider-par-root.md`.

## Dev Notes

### État actuel (lu dans le code)
- `game/fx.ts` `planBeats` : durées fixes par type d'événement (`TIMING`), × `PHONE_TEMPO` sur téléphone pour les déplacements.
- `game/playback.ts` `step()` : `ms = gap × rate`, `begin()` (minuterie des cartes retenues : `cardDestroyed`, `returnedToHand`),
  `onCue`, puis `setTimeout(step, ms)`. Plusieurs temps sans durée sont joués avec le suivant qui porte la minuterie.
- `ui/director.ts` `direct(cue)` : `lunge` (élan 220, charge 170, retour 380, × `tempo()`), `played`/`summonedIn` en rAF
  (`fly = min(ms, ENTRANCE)`), `drawn` (540 × tempo), `backToHand(ms)`, `abilityFired` (rayon 520 × tempo, orbe = gap − délai),
  `death` (cendres 700 + 40 i).
- Mesures (2026-11-23) : voir `planning-artifacts/sprint-change-proposal-2026-11-23.md`.

### À préserver
- Ordre des temps (`window.__ccBeats`, e2e `timing`), mise en scène téléphone (`stage`), sorts téléphone (`PHONE_SPELL`).
- Compatibilité : client seul, aucun message réseau.

### Garde-fous
- `retime` ignoré si un autre temps a commencé, si la lecture est en pause, ou pendant une mise en avant.
- Distances en pixels écran (avant division par l'échelle de mise en scène `ks`).
- Pas de nouvelle dépendance.

## Dev Agent Record

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- `travelFactor` (motion.ts) : distance ÷ référence, bornée 0,7 – 1,4 ; références par disposition (`TRAVEL_REF`).
- `Playback` : chaque temps reçoit `retime(ms)` ; appel pendant le temps (synchrone) ou une image plus tard ; la carte
  qui meurt ou repart en main reste sur sa case jusqu'à la nouvelle fin ; un `retime` périmé est ignoré.
- Directeur : charge et retour d'attaque, pose, invocation, pioche, retour en main, rayons et orbes (cible la plus
  lointaine) suivent la distance et appellent `retime` ; les cendres suivent la distance sans changer le temps.
- Mesure dans le jeu : attaque face à face sur ordinateur 344 ms jusqu'à l'impact (390 avant) ; téléphone 483 ms (inchangé,
  facteur ≈ 1) ; planches `scripts/compare-demo.mjs` conformes à la démo.
- `pnpm typecheck` OK, `pnpm test` 311/311, e2e 49/49 (ports 2667 / 5274).

### File List

- apps/client/src/game/motion.ts
- apps/client/src/game/motion.test.ts
- apps/client/src/game/playback.ts
- apps/client/src/game/playback.test.ts
- apps/client/src/ui/director.ts
- _bmad-output/implementation-artifacts/a-valider-par-root.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

### Change Log

- 2026-11-23 : durée des déplacements selon la distance (story 13.13).
