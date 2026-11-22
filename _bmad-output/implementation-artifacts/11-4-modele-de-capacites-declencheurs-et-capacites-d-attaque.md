# Story 11.4: Modèle de capacités : déclencheurs et capacités d'attaque

Status: done

## Story

As a moteur de règles,
I want des capacités déclenchées par des événements et des capacités d'attaque qui remplacent l'attaque,
So that aucune carte ne devienne un moteur répétable incontrôlable.

## Acceptance Criteria

**Given** le schéma de cartes et le registre d'événements
**When** un événement se produit (arrivée, pose d'une carte alliée ou adverse, mort, début/fin de tour, attaque, attaqué, destruction)
**Then** les capacités abonnées se déclenchent, avec choix du joueur au moment du déclenchement
**And** une capacité d'attaque consomme l'attaque du tour et suit son éligibilité (hâte comprise)
**And** `support.ts` refuse un déclencheur inconnu ; le journal nomme le déclencheur (« À l'arrivée d'Epok : … »)

## Tasks / Subtasks

- [x] Schéma (`packages/cards/src/schema.ts`) : nouveaux `kind` — `attack`, `onAllyPlayed`, `onEnemyPlayed`, `startOfTurn`, `endOfTurn`, `onAttack`, `onAttacked`, `onKill` (en plus de `onPlay`, `onDeath`, `reaction`, `passive`, `choice`, `flavor`, `active`) ; `filter` optionnel (`set`, `category`, `role`, `ids`) pour « quand vous posez / l'adversaire pose une carte ». `kind` accepte toute chaîne : une carte au déclencheur inconnu se charge mais est refusée par `unsupportedReason`.
- [x] Registre d'événements (`packages/engine/src/effects/triggers.ts`) : `TRIGGERS` (libellé français, qui déclenche), `emit(event)` met en file les capacités abonnées (`played`, `died`, `turnStarted`, `turnEnding`, `killed`), `drain()` les résout dans l'ordre, `settle()` termine chaque action (morts, vainqueur, file, fenêtre de réaction).
- [x] Choix au déclenchement : une capacité en file qui demande des cibles ou une option ouvre `pending: { kind: 'targets' | 'option' }` pour son propriétaire (même hors de son tour) ; réponses `chooseTargets { targets: string[][] }` (une liste par demande) et `chooseOption { option }`. Des cibles déclarées dans l'action (anciens clients, tests) sont utilisées telles quelles.
- [x] Fin de tour : les effets `endOfTurn` se résolvent (choix compris) avant le passage du tour (`endingTurn`) ; `startOfTurn` après la pioche.
- [x] Capacité d'attaque (`kind: 'attack'`) : mêmes conditions que l'attaque (`canAttack` : pas le tour de la pose sauf hâte, étourdi, attaque déjà faite), une fois par tour, consomme l'attaque ; `cooldown` et `oncePerGame` restent valables.
- [x] `onAttack` / `onAttacked` se résolvent dans la frappe (ils peuvent l'annuler) ; `onKill` est mis en file ; `onDeath` aussi (avant : exécuté tout de suite).
- [x] Journal : `abilityUsed.trigger` ; le client écrit « À l'arrivée d'Epok : « … » », « Attaque de … », « À la mort de … » (`triggerPhrase`, élisions d'/du/des).
- [x] Bot (`bot.ts`) et chrono (`timeoutAction`) répondent aux nouvelles demandes ; le bot ne déclare plus ses cibles à l'avance.
- [x] Client : poser une carte ou utiliser une capacité part tout de suite ; la sélection des cibles s'ouvre quand le moteur la demande ; fenêtre de choix d'option ; bouton « Utiliser (au lieu d'attaquer) » pour une capacité d'attaque.
- [x] Tests : `packages/engine/src/triggers.test.ts` (arrivée avec cible, cibles déclarées, carte alliée/adverse posée avec filtre, début/fin de tour et silence, choix en fin de tour, mort avec choix hors tour, option à l'arrivée, capacité d'attaque, hâte, déclencheur inconnu, bot).

## Dev Notes

- Les cartes ne changent pas dans cette story (story 11.6) : les anciennes « actives » de personnage gardent leur règle (une fois par pose).
- Les cibles sont demandées au déclenchement, avant un éventuel lancer de dé de la même capacité.
- Compatibilité : l'ancien client envoie ses cibles avec `playCard` / `useAbility`, le nouveau serveur les accepte. Un ancien client qui reçoit une demande `targets` / `option` ne sait pas y répondre : le chrono la résout par défaut. Le nouveau client face à un ancien serveur : ses cartes sont jouées sans cibles, l'ancien serveur les tire au hasard (une version).

## Dev Agent Record

### Completion Notes List

- `pnpm typecheck` OK, `pnpm test` 99/99 (simulation de 200 parties : 200 terminées, 30,6 tours en moyenne), `PW_CHANNEL=chromium pnpm e2e -- --trace off` 5/5 (2026-11-22).

### File List

- packages/cards/src/schema.ts
- packages/engine/src/types.ts, effects/triggers.ts (nouveau), effects/targets.ts, effects/run.ts, effects/core.ts, play/play.ts, play/abilities.ts, combat/combat.ts, turn/turn.ts, state/create.ts, apply.ts, support.ts, bot.ts, timeout.ts, index.ts, triggers.test.ts (nouveau)
- apps/client/src/game/describe.ts, apps/client/src/ui/Table.tsx, apps/client/src/ui/CardSheet.tsx

## Change Log

- 2026-11-22 — Déclencheurs, file de résolution avec choix au déclenchement, capacités d'attaque (mode autonome).
