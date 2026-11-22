---
baseline_commit: ba90f82d26ae13d2612bca6545d39514a570b4f4
---

# Story 12.1: Couche de présentation

Status: done

## Story

As a joueur,
I want que la table rejoue les événements un par un,
So that je voie chaque action avant son résultat.

## Acceptance Criteria

**Given** un lot d'événements
**When** il arrive
**Then** l'état affiché avance au rythme des temps d'animation (le moteur reste l'arbitre)
**And** une carte détruite reste visible pendant son animation de mort
**And** je peux agir pendant la lecture (la suite accélère)
**And** le réglage de vitesse et « réduire les animations » sont respectés.

Critères communs de l'epic 12 : 60 images/s (transform et opacity seulement), action simple < 0,8 s, réglage normale / rapide / instantanée, fondus seuls avec « réduire les animations », actions adverses mises en scène de la même façon, test e2e de l'ordre des temps.

## Tasks / Subtasks

- [x] `game/present.ts` (pur, testé) : temps d'animation (`planBeats`) et état affiché (`shownState`) calculé à partir de l'état avant, de l'état après et du nombre de temps joués ; les PV et l'ATQ des cartes encore présentes sont « déroulés » depuis l'état réel (état réel − effets pas encore joués), le plateau avance depuis l'état d'avant (pose, invocation, renvoi, mort à la fin de son animation), les PV du joueur suivent `playerDamaged.hp`. À la fin du lot, l'état affiché est exactement l'état du moteur.
- [x] `game/playback.ts` : file de lots, minuteries, vitesse (`normal` 1, `fast` 0,5, `instant` 0) gardée dans `localStorage` (try/catch), accélération ×4 quand le joueur agit ou quand des lots attendent, pause (écran « passe l'appareil »), `flush`, `busyFor()` pour rythmer le Grimoire, journal des temps en dev (`window.__ccBeats`) pour l'e2e.
- [x] `ui/Table.tsx` : plateaux, zones et portraits rendus depuis l'état affiché ; interactions, main, bandeau et fenêtres depuis l'état réel ; les effets (chiffres, mort) sont émis au temps qui les concerne ; la carte mourante reste dans son socle (`is-dying`) jusqu'à la fin de son animation.
- [x] Réglage « Vitesse des animations » dans la barre du haut (normale / rapide / instantanée) ; `prefers-reduced-motion` → fondus seulement.
- [x] Solo : le Grimoire attend la fin de la lecture avant son action suivante (`Session.pace`, optionnel, sans effet en test).
- [x] Hot seat : la lecture se met en pause derrière l'écran « passe l'appareil ». En ligne : le lot adverse est rejoué de la même façon (pas de changement de protocole).
- [x] Scène de test en dev (`?scene=mort`) : Topper Harley contre les Chevaliers « Ni ! » ; e2e qui vérifie l'ordre : attaque → dégâts → mort, la carte reste dans son socle jusqu'à la fin de l'animation ; les e2e existants passent.

## Dev Notes

- Cause (vérifiée) : `Table.tsx` rendait le nouvel état tout de suite et `fx.ts` ne faisait que superposer des effets ; la carte détruite avait déjà disparu.
- Rien n'est décidé côté client : l'état affiché n'est qu'une vue intermédiaire entre deux états du moteur ; tout écart d'approximation (aura, plafonds de soin, cartes à plusieurs corps) se résorbe à la fin du lot.
- Pas de changement de protocole : on n'utilise que `before`, `after` et `events` déjà reçus.
- Animations : Web Animations API / CSS, `transform` et `opacity` seulement (démo `docs/design/animations/demo.html`). Les animations détaillées viennent en 12.2 à 12.4 ; 12.1 pose le squelette et les durées.
- e2e : `PW_CHANNEL=chromium pnpm e2e -- --trace off`. La vitesse instantanée se règle par `localStorage` (`cinecards.animSpeed`).

### References

- epics.md, Epic 12 ; retours-visuels-actions.md ; docs/design/animations/demo.html ; game-architecture.md (« Sequential event queue in client », `prefers-reduced-motion`).

## Dev Agent Record

### Completion Notes List

- `game/present.ts` : `shownView(catalog, before, after, events, played, dying)` — plateau rejoué depuis `before` (pose, invocation, renvoi, mort retirée à la fin de son animation), PV du joueur depuis `playerDamaged.hp`, PV/ATQ des cartes déjà en jeu avancés depuis `before`, ceux des arrivées (et des cartes sauvées) déroulés depuis `after`, statuts qui apparaissent à leur temps. Fin du lot = `after` exactement (même objet).
- `game/fx.ts` : `planBeats` (un temps par événement, durées `TIMING` reprises de la démo) remplace `eventsToBeats`.
- `game/playback.ts` : `Playback` (file de lots, `hurry` ×0,25, ×0,5 en cas d'attente, `pause`, `flush`, `busyFor`, vitesse en `localStorage` avec try/catch), journal `window.__ccBeats` en dev.
- `ui/Table.tsx` : plateaux, zones et portraits depuis l'état affiché ; main, bandeau, fenêtres et taps depuis l'état réel ; `key={iid}` sur les cartes du plateau (une animation ne « colle » pas à la carte suivante du socle) ; bouton de vitesse ; pause derrière l'écran « passe l'appareil » ; saut à la fin quand l'onglet est caché.
- `ui/anim.ts` : `animate` (WAAPI, `transform`/`opacity`, fondus seuls avec « réduire les animations »), `deathFx` ; voile de brûlure CSS (`.is-dying`, opacité seulement).
- Solo : `Session.pace` — le Grimoire attend la fin de la lecture (sans effet dans les tests unitaires).
- Scène de test dev `?scene=mort` (`game/devscene.ts`, chargée seulement si `import.meta.env.DEV`).
- Tests : `present.test.ts` (6 : état affiché pas à pas, pose, PV du joueur, carte mourante gardée jusqu'à la fin, instantané/accélération/flush, pause). e2e `beats.spec.ts` (ordre attaque → dégâts → mort, carte présente et « mourante » jusqu'à la fin de son animation ; vitesse instantanée et réglage gardé).
- `pnpm typecheck` OK, `pnpm test` 124/124, `PW_CHANNEL=chromium pnpm e2e -- --trace off` 11/11 (2026-11-22). Captures 390 px vérifiées (Ni à 0 PV dans son socle, puis brûlure).

### File List

- apps/client/src/game/present.ts, present.test.ts, playback.ts, fx.ts, session.ts, devscene.ts
- apps/client/src/ui/Table.tsx, CardView.tsx, Icon.tsx, anim.ts
- apps/client/src/App.tsx, styles.css
- e2e/beats.spec.ts
- _bmad-output/implementation-artifacts/a-valider-par-root.md, sprint-status.yaml

## Change Log

- 2026-11-22 — Couche de présentation : l'état affiché avance temps par temps, la carte détruite reste visible pendant sa mort, réglage de vitesse (mode autonome).
