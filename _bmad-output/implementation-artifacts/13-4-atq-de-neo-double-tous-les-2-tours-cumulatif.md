---
baseline_commit: 3f6b5a1
---

# Story 13.4: L'ATQ de Néo double tous les 2 tours, de façon cumulative

Status: done

## Story

As a joueur,
I want que Néo devienne de plus en plus fort,
So that sa carte fasse ce que Root a voulu.

## Acceptance Criteria

**Given** Néo en jeu depuis son tour de pose t
**When** commence le tour t+2, t+4… de son propriétaire
**Then** son ATQ double, par un modificateur permanent attaché à Néo, avec sa source et visible dans « Bonus et malus » ; le journal et l'animation de bonus le montrent
**And** l'effet s'arrête s'il est réduit au silence, et le gain est perdu s'il quitte la table (une carte rejouée repart de son ATQ de base)
**And** le texte de la carte devient : « Tous les 2 tours, l'ATQ de Néo double (le bonus se cumule). »
**And** la capacité « Élu de Sion » (insensible tous les 2 tours) ne change pas
**And** le compte à rebours de cycle sur la carte annonce le prochain doublement ; test de règle sur 3 doublements ; simulation de 200 parties ; le risque d'équilibrage (1 280 ATQ au 6e tour) est noté dans `a-valider-par-root.md`

## Tasks / Subtasks

- [x] Moteur : nouvel op passif `cycleAtkDouble` (`every`, 2 par défaut). Au début du tour de son propriétaire, quand le cycle est actif (`cycleActive`, premier doublement à t+2), la carte reçoit un modificateur permanent égal à son ATQ actuelle (source = elle-même, libellé = la capacité) ; événements `abilityUsed` (déclencheur « Début de tour ») puis `modified`. Placé après le poison, avant les passifs `startOfTurn`. Silence : `passives()` ne renvoie rien, pas de doublement.
- [x] Ancien op `cycleAttackMultiplier` retiré (`damage()`, `KNOWN_OPS`) : plus aucune carte ne l'utilise.
- [x] `matrix.json` : Néo utilise `cycleAtkDouble`, nouveau texte.
- [x] Client : badge de cycle de Néo avec étiquette « ×2 » et infobulle « ATQ doublée dans N tour(s) » ; ligne sur la fiche avec l'ATQ visée (« 320 → 640 »). Scène dev `?scene=neo`.
- [x] Tests : règle (3 doublements, sources permanentes, silence, retour en main → 160), e2e `neo-doubling.spec.ts`, simulation avant/après.

## Dev Notes

- Pas de changement de protocole : un nouvel op dans les données et des événements existants. Le serveur et le client partagent le moteur et les cartes ; un ancien client affiche simplement le modificateur et l'ancien badge.
- `cycleCountdown` prend le premier op `cycle*` de la carte : pour Néo, `cycleAtkDouble` et `cycleInsensible` ont la même période (2).

### References

- `_bmad-output/planning-artifacts/epics.md` — Epic 13, story 13.4 ; story 13.3 (« Bonus et malus »).

## Dev Agent Record

### Completion Notes List

- `packages/engine/src/turn/turn.ts` (`doubleAtkOnCycle`), `effects/core.ts`, `support.ts`, `content/sets/matrix.json`.
- `apps/client/src/ui/CardView.tsx` (`atkDoublingEvery`, `cycleTitle`, `.x2`), `CardSheet.tsx` (`.sheet-cycle`), `styles.css`, `game/devscene.ts` (scène `neo`).
- GDD : ordre des dégâts mis à jour, règle de Néo et `[ASSUMPTION]` (doublement de l'ATQ actuelle, bonus temporaires compris, après le poison) ; `a-valider-par-root.md` : règle, risque d'équilibrage, texte modifié ; `docs/simulation-report.md`.
- Simulation (200 parties, mêmes graines) : 200/200 terminées ; Néo posé dans 107 parties, son camp gagne 84 fois (avant : 81) ; ATQ max 1 600 (avant : 300) ; 27,7 tours en moyenne (avant : 28,5).
- `pnpm typecheck` OK, `pnpm test` 138/138, `PW_CHANNEL=chromium pnpm e2e -- --trace off` 26/26 (2026-11-22).
