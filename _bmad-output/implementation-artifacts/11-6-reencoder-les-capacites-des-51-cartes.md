# Story 11.6: Réencoder les capacités des 51 cartes

Status: done

## Story

As a Root,
I want que les cartes suivent le nouveau modèle de capacités,
So that les parties restent équilibrées.

## Acceptance Criteria

**Given** le tableau 4.3 de la proposition de changement
**When** les sets sont réencodés
**Then** chaque capacité utilise le bon déclencheur, et les textes adoptent « À l'arrivée : … » / « Attaque : … »
**And** Patsy dit « Tant que Patsy est sur votre table, Arthur a la hâte » ; le bonus de Benson dure jusqu'à la fin du tour ; les Sentinelles sont en usage unique
**And** `cards.test.ts` est à jour et la simulation de 200 parties passe, avec comparaison des durées avant/après

## Tasks / Subtasks

- [x] `content/sets/*.json` : tableau 4.3 appliqué. À l'arrivée : Le maître des clés (jusqu'à 3), Epok (×2), Le Mulo (Matrix +40/+50), Smith (×2, cimetière : jusqu'à 15 au choix), Tank (jusqu'à 3), L'ange sans ailes (choix exclusif), Switch, Dozer, Trinity, Néo, Cypher. Capacités d'attaque : Le Mulo (robe rouge, tous les 2 tours), Sentinelles (usage unique, `oncePerGame` ajouté), Kevin (une fois par partie), Vandergeld, Chevaliers « Ni ! », Ramada. Topper « Pilote d'élite » inchangé.
- [x] Benson : `startOfTurn`, bonus `turns: 1` (plus de cumul) ; Patsy : nouveau texte ; déclencheurs explicites pour « Ville des machines » (début de tour), Topper « Compteur de victimes » (`onKill`), Gardien du pont et Sire Robin (`onAttacked`).
- [x] « À son arrivée » / « À leur arrivée » / « Lors de votre arrivée » → « À l'arrivée : … » partout. Les répliques (noms des capacités) ne changent pas.
- [x] Moteur : `lookAndPick { from: 'graveyard' }` (choix dans le cimetière, limité par la place en main) ; `pending.pick.from`.
- [x] `cards.test.ts` : cartes rejouées depuis la main, nouvelles vérifications (pas d'« active » de personnage hormis Topper, textes « À l'arrivée » / « Attaque », déclencheurs attendus, Sentinelles, Benson sans cumul, capacités d'attaque de Ramada / Vandergeld).
- [x] `a-valider-par-root.md` : les 30 textes modifiés et les choix faits ; `docs/simulation-report.md` : durées avant/après.

## Dev Notes

- Le JSON reste indenté comme avant (2 espaces, une clé par ligne) pour que Root puisse le relire.
- Compatibilité : pendant une version, un ancien client en ligne affiche les anciens textes et peut proposer « Utiliser » sur une capacité devenue « À l'arrivée » : le serveur refuse (`NO_SUCH_ABILITY`), sans autre effet.
- `content/sets/README.md` (tableau rédigé à la création des sets) n'est pas tenu à jour : la source est le JSON.

## Dev Agent Record

### Completion Notes List

- `pnpm typecheck` OK, `pnpm test` 109/109 (simulation : 200/200 terminées, 28,5 tours en moyenne contre 28,1 avant), `PW_CHANNEL=chromium pnpm e2e -- --trace off` 6/6 (2026-11-22).

### File List

- content/sets/matrix.json, holy-grail.json, hot-shots.json, white-chicks.json
- packages/engine/src/types.ts, effects/run.ts, play/abilities.ts, cards.test.ts, engine.test.ts
- docs/simulation-report.md
- _bmad-output/implementation-artifacts/a-valider-par-root.md

## Change Log

- 2026-11-22 — Capacités des 51 cartes réencodées selon le tableau 4.3 (mode autonome).
