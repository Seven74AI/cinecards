# Story 11.3: Chrono dans tous les modes

Status: done

## Story

As a joueur,
I want voir et subir le chrono de 75 s en ligne, en solo et en hot seat,
So that le rythme reste tenu quel que soit le mode.

## Acceptance Criteria

**Given** une partie en ligne, solo ou hot seat
**When** un tour commence
**Then** le sablier et les secondes restantes sont visibles, avec une alerte à 10 s
**And** à 0, les choix en attente sont résolus par défaut puis le tour se termine
**And** en hot seat, le chrono démarre à la levée de l'écran de passage
**And** en ligne, l'affichage reste juste malgré un décalage d'horloge de ±2 min (le serveur envoie le temps restant)

## Tasks / Subtasks

- [x] Moteur : `timeoutAction(state)` (`packages/engine/src/timeout.ts`) donne l'action par défaut (réaction → passer, choix → premières cartes proposées, sinon fin du tour) ; `RULES.TURN_ALERT_SECONDS = 10`
- [x] Serveur (`duel.ts`) : `onTurnTimeout` utilise `timeoutAction` ; `ViewMessage` porte `turnMsLeft` / `reactionMsLeft` en plus de `turnEndsAt` / `reactionEndsAt` (gardés une version pour les anciens clients)
- [x] Client en ligne : échéance locale = maintenant + temps restant (`localDeadline`), repli sur l'heure absolue si le serveur est ancien
- [x] Client local (`game/session.ts`) : `LocalClock` (75 s par tour, 5 s par réaction) ; pause pendant une fenêtre de réaction et, en hot seat, jusqu'à « Je suis prêt·e » (`session.ready()`) ; à 0, choix par défaut puis fin du tour en un seul lot
- [x] UI (`Table.tsx`) : sablier + secondes (`role="timer"`), rouge et pulsé à 10 s, grisé quand le chrono est en pause
- [x] Tests : moteur (`timeoutAction`), serveur (`turnMsLeft`), client (solo, hot seat, pause en réaction, décalage d'horloge), e2e `turn-timer.spec.ts` (hot seat avec horloge simulée : pause pendant l'écran de passage, alerte à 9 s, fin du tour ; solo) et chrono visible dans `online-duel.spec.ts`

## Dev Notes

- Suivi : le serveur met désormais son chrono de tour en pause pendant une fenêtre de réaction (GDD Turn Structure, architecture P3) ; `ViewMessage.turnPaused` (optionnel) indique la pause, `turnMsLeft` est alors figé. Un ancien client voit le chrono continuer pendant ces 5 s, sans autre effet.
- Compatibilité : nouveaux champs optionnels ; un ancien client lit toujours `turnEndsAt`, un nouveau client tolère un serveur sans `turnMsLeft`.

## Dev Agent Record

### Completion Notes List

- `pnpm typecheck` OK, `pnpm test` 87/87 (dont la simulation de 200 parties), `PW_CHANNEL=chromium pnpm e2e -- --trace off` 5/5 (2026-11-22).

### File List

- packages/engine/src/timeout.ts, packages/engine/src/index.ts, packages/engine/src/rules.ts, packages/engine/src/engine.test.ts
- packages/protocol/src/index.ts
- apps/server/src/duel.ts, apps/server/src/server.test.ts
- apps/client/src/game/session.ts, apps/client/src/game/session.test.ts, apps/client/src/net/online.ts
- apps/client/src/ui/Table.tsx, apps/client/src/styles.css
- e2e/turn-timer.spec.ts, e2e/online-duel.spec.ts

## Change Log

- 2026-11-22 — Suivi : pause du chrono serveur pendant une réaction (test `pauses the turn timer during a reaction window`).
- 2026-11-22 — Chrono de 75 s en solo et hot seat, temps restant envoyé par le serveur (mode autonome).
