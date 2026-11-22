# Story 11.5: Choisir de 0 à N cibles

Status: done

## Story

As a joueur,
I want choisir entre 0 et N cibles quand une carte dit « choisissez N »,
So that je garde le contrôle de mes effets.

## Acceptance Criteria

**Given** un effet `targets { count: N, min }` (`min = 0` par défaut, `min = N` si la carte dit « exactement »)
**When** je choisis mes cibles
**Then** un compteur « k / N », un bouton « Valider » (actif dès `min`) et « Aucune cible » sont proposés
**And** le moteur ne complète jamais un choix au hasard ; les choix dans le deck acceptent aussi `min..N`

## Tasks / Subtasks

- [x] Moteur : `minOf(effect, count)` (`effects/targets.ts`) — `min` explicite, sinon `exactly: true` → `count`, sinon 0. Chaque demande de cibles porte `min` ; `chooseTargets` accepte `min..count` par demande.
- [x] Plus aucun complément au hasard : des cibles déclarées incomplètes restent incomplètes.
- [x] Choix dans le deck (`lookAndPick`) : `pending.pick.min` (0 par défaut), `choose` accepte `min..count` (un ancien état sans `min` exige toujours `count`).
- [x] Chrono : pour « jusqu'à N », aucune cible (`timeoutAction` prend `min` cibles) ; un choix dans le deck garde les premières cartes (inchangé, 11.3).
- [x] Bot : de `min` à `count` cibles au hasard ; dans le deck, autant de cartes que permis.
- [x] Client : le bandeau affiche « k / N (jusqu'à) », « Aucune cible » (si toutes les demandes acceptent 0) et « Valider » (actif dès `min`) ; toucher une carte choisie la retire ; une carte va dans la première demande qui l'accepte et a de la place. Fenêtre de choix du deck : « Valider » dès `min`, « Aucune » si `min = 0`.
- [x] Tests : `triggers.test.ts` (0 à 3, refus au-delà, « exactement », pas de complément au hasard, défaut du chrono, deck `0..N`), e2e `target-prompt.spec.ts` (hot seat : une carte à l'arrivée demande ses cibles, compteur, « Aucune cible »).

## Dev Notes

- `optional` (ancienne façon de dire « 0 possible ») n'est plus utile : 0 est la règle par défaut.
- Compatibilité : `min` est optionnel dans la vue ; un nouveau client face à un ancien serveur traite une demande sans `min` comme « exactement ».

## Dev Agent Record

### Completion Notes List

- `pnpm typecheck` OK, `pnpm test` 104/104 (simulation : 200/200 terminées, 28,1 tours en moyenne), `PW_CHANNEL=chromium pnpm e2e -- --trace off` 6/6 (2026-11-22).

### File List

- packages/engine/src/effects/targets.ts, effects/run.ts, play/abilities.ts, bot.ts, timeout.ts, triggers.test.ts, cards.test.ts
- apps/client/src/ui/Table.tsx, apps/client/src/styles.css
- e2e/target-prompt.spec.ts (nouveau)

## Change Log

- 2026-11-22 — Choix de 0 à N cibles, « Valider » / « Aucune cible », plus de complément au hasard (mode autonome).
