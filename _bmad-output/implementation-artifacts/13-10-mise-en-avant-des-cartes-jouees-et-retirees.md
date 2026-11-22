---
baseline_commit: fcd69a9
---

# Story 13.10: Mise en avant des cartes jouées et des cartes retirées

Status: done

## Story

As a joueur,
I want voir en grand chaque sort ou effet joué, et être prévenu clairement quand une de mes cartes quitte la table,
So that je ne rate aucune action, surtout celles de l'adversaire.

## Acceptance Criteria

Maquette animée validée : `docs/design/animations/demo.html`, scènes « Mise en avant » et « Carte retirée ».

1. **Given** un sort joué ou une carte à effet « À l'arrivée », par moi ou par l'adversaire **Then** la table s'assombrit, la carte vient au centre (~1,6× sur téléphone), entrée de 850 ms (accélération puis léger dépassement) ; au-dessus « qui joue », en dessous un panneau parchemin (étiquette, réplique, texte de l'effet, barre qui se vide en 3 s).
2. Un appui passe la mise en avant ; « rapide » la raccourcit, « instantanée » la supprime ; ensuite l'effet part de la carte.
3. Quand une de MES cartes quitte la table à cause d'un effet adverse (renvoyée, détruite par un effet, volée), elle s'illumine en rouge avec un tampon (« RENVOYÉE », « DÉTRUITE », « VOLÉE »), puis part vers sa destination.
4. Son socle garde un contour rouge pointillé qui clignote ~2 s ; une alerte rouge reste ~4 s en haut : « Votre carte a quitté la table », avec la carte, la destination, la capacité et la carte source.
5. L'événement est mis en évidence dans le journal.
6. Solo, hot seat, en ligne ; téléphone et ordinateur ; e2e de l'ordre (mise en avant → effet → alerte).

## Tasks / Subtasks

- [x] `game/removal.ts` : `removalAt` (retrait par une capacité de l'autre joueur, lu dans les événements : `returnedToHand`, `cardDestroyed`, `summoned` depuis `enemyBoard`), `removalText`, `STAMP`.
- [x] `game/fx.ts` : `Beat.lead` / `spot` / `removal`, `SPOT` (850 + 300 + 3000 + 350) et `REMOVAL` (tampon 260, maintien 700, socle 2400, alerte 4200) ; option `alertFor`.
- [x] `game/playback.ts` : un « avant-temps » (`lead`) joué avant le temps, la table montrant encore l'état d'avant ; `skipLead()` (appui), `onFlush`, `alertFor`, `names` ; traces `spotlight`, `removalStamp`, `removalAlert` pour les e2e.
- [x] `ui/director.ts` : mise en avant (voile, carte entière via `CardView`, « qui joue », panneau, barre, « Touchez pour passer »), la carte repart ensuite du centre ; tampon + lueur rouge, socle pointillé clignotant, alerte rouge ; `clearLeads()`.
- [x] `Table.tsx` : `alertFor` (moi ; les deux joueurs en hot seat), noms, ligne du journal `removed` ; `styles.css`.
- [x] Scène de développement `retrait` (Le Grimoire n'a que Tank ; graine du bot fixée à 9) ; `App.tsx` passe la graine.
- [x] Tests : `game/spotlight.test.ts` ; e2e `spotlight-removal.spec.ts` (ordre, textes, appui, ordinateur + journal) ; délais élargis dans `triggers-spells`, `play-draw`, `turn-rhythm` (le tour adverse est plus long).
- [x] `scripts/compare-demo.mjs` : scènes `mise-en-avant` et `carte-retiree` ; captures 390 px et ordinateur.

## Dev Agent Record

### Completion Notes List

- Choix autonomes dans `a-valider-par-root.md` (13.10).
- Aucun changement de protocole (présentation côté client seulement).
- `pnpm typecheck` OK, `pnpm test` 148/148, e2e 35/35 (ports 2967 / 5574).

### File List

- apps/client/src/game/removal.ts (nouveau), apps/client/src/game/spotlight.test.ts (nouveau), apps/client/src/game/fx.ts, apps/client/src/game/playback.ts, apps/client/src/game/devscene.ts, apps/client/src/App.tsx
- apps/client/src/ui/director.ts, apps/client/src/ui/Table.tsx, apps/client/src/styles.css
- e2e/spotlight-removal.spec.ts (nouveau), e2e/triggers-spells.spec.ts, e2e/play-draw.spec.ts, e2e/turn-rhythm.spec.ts
- scripts/compare-demo.mjs
- _bmad-output/implementation-artifacts/a-valider-par-root.md, sprint-status.yaml

## Change Log

- 2026-11-22 — Mise en avant des sorts et effets « À l'arrivée », alerte quand une de mes cartes est retirée, mode autonome.
