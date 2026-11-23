---
baseline_commit: 45f6c030581110b7c511d39d2330c02a7f5e9e9e
---
# Story 8.5: Émotes

Status: done

## Story

As a joueur,
I want envoyer des répliques prédéfinies,
so that on se chambre sans chat libre.

## Acceptance Criteria

1. **Choisir une réplique.** **Given** une partie **en ligne** **When** j'appuie sur le bouton « Répliques » (bulle) de
   la barre du haut **Then** une petite liste des 8 répliques s'ouvre ; un appui en envoie une et ferme la liste.
2. **La voir.** L'adversaire voit la réplique **3 s** dans une bulle près de son portrait adverse (la mienne s'affiche
   aussi près de mon portrait, pour que je sache qu'elle est partie). Une nouvelle réplique remplace la précédente.
   La bulle ne cache ni la main, ni les boutons d'action, ni un choix de cible ; elle ignore les appuis.
3. **Répliques** (texte écrit, pas d'extrait de film — GDD) : « Bien joué ! », « Oups… », « Merci ! »,
   « Je réfléchis… », « Tu vas le regretter. », « Pas mal ! », « Bonne partie ! », « Revanche ? ». Liste côté code
   (`packages/protocol`), identifiants stables (`gg`, `oops`, `thanks`, `thinking`, `regret`, `nice`, `goodgame`,
   `rematch`) : le client affiche le texte à partir de l'identifiant, le serveur ne relaie que des identifiants connus.
4. **Limite.** Une réplique toutes les **3 s** au plus par joueur (le bouton est grisé pendant ce temps ; le serveur
   ignore aussi les envois trop rapprochés).
5. **Couper.** Dans la liste, « Couper les répliques adverses » (interrupteur, gardé sur l'appareil) : je ne vois plus
   les siennes ; lui n'en sait rien.
6. **Où.** En ligne seulement (pas en solo ni en hot seat), pendant la partie et sur l'écran de fin. Les invités (sans
   compte) peuvent aussi en envoyer.
7. **Compatibilité.** Nouveaux messages seulement (`emote` client → serveur, `emote` serveur → client). Un ancien client
   ignore le message (le SDK prévient seulement dans la console) ; le nouveau client face à un ancien serveur : le
   bouton reste, l'envoi ne fait rien de visible côté adverse (acceptable une version).

## Tasks / Subtasks

- [x] **Protocole** — `packages/protocol/src/index.ts` (AC 3, 7)
  - [x] `EMOTES` (identifiant → texte français), type `EmoteId` ; `ClientMessages.emote: { id: EmoteId }` ;
        `ServerMessages.emote: { from: PlayerId; id: EmoteId }`.
- [x] **Serveur** — `apps/server/src/room.ts` (AC 3, 4, 6)
  - [x] `onMessage('emote')` : siège connu, duel commencé, identifiant connu, au plus une toutes les 3 s par siège
        (horloge injectable pour le test) → `broadcast('emote', { from: seat, id })` aux deux sièges.
- [x] **Client** — `apps/client/src/net/online.ts`, `game/session.ts`, `ui/Table.tsx` (AC 1, 2, 4, 5, 6)
  - [x] `Session` gagne `sendEmote?(id)` (en ligne seulement) et l'état `lastEmote?: { from, id, at }` ; `online.ts`
        écoute `emote` et envoie `emote`.
  - [x] `ui/Emotes.tsx` : bouton bulle dans la `.topbar` (à côté de « Quitter » et de la vitesse), liste des 8 répliques
        + interrupteur « Couper les répliques adverses » (`localStorage['cinecards.muteEmotes']`, try/catch) ; bulles
        près des portraits (classe `pointer-events: none`), 3 s, fondu ; respecte « réduire les animations ».
        Cibles de 44 px ; la liste tient à 360 × 640 sans défilement.
- [x] **Tests** (AC 1-7)
  - [x] Serveur (`server.test.ts` ou `emotes.test.ts`) : relais aux deux sièges, identifiant inconnu ignoré, limite de
        3 s, refus avant le début du duel.
  - [x] e2e `e2e/emotes.spec.ts` : duel en ligne entre deux contextes ; A envoie « Bien joué ! » ; B la voit puis elle
        disparaît après ~3 s ; B coupe les répliques ; une nouvelle réplique de A n'apparaît plus chez B.
  - [x] Les e2e existants passent (la barre du haut garde ses boutons et leurs libellés).

## Dev Notes

- `DuelRoom.onMessage('action', …)` montre le modèle (siège via `seatOf(client)`). `online.ts` : `r.onMessage('lobby' |
  'view' | 'rejected' | 'away')` ; la `Session` locale (solo / hot seat) ne fournit pas `sendEmote` : le bouton ne
  s'affiche que si la fonction existe.
- `ui/Table.tsx` : `.topbar` (bouton « Quitter », bouton de vitesse). Mise en page téléphone : table compacte (13.2) ;
  vérifier que la bulle ne recouvre pas le compteur de pièces ni le chrono.
- Choix à noter dans `a-valider-par-root.md` : les 8 textes ; bulle aussi chez l'envoyeur ; invités autorisés.
- Définition de fini : `pnpm typecheck`, `pnpm test`, `PW_CHANNEL=chromium pnpm e2e -- --trace off` (ports dédiés) ;
  captures 390×844 de la liste ouverte et d'une bulle, dans `_bmad-output/implementation-artifacts/screens/8-5/`.

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.5]
- [Source: _bmad-output/planning-artifacts/gdds/gdd-cinecards-2026-11-22/gdd.md#Game Modes] (8 émotes écrites)
- [Source: AGENTS.md]

## Dev Agent Record

### Agent Model Used

Dev agent (gds-dev-story).

### Debug Log References

- e2e `emotes.spec.ts`, first run: the hidden 1 px checkbox under the drawn switch could not be clicked (the switch caught
  the click). Fixed by laying the invisible checkbox over the drawn switch.
- Screenshots at 360 × 640: with a sixth 44 px top-bar button, « Salle CODE » wrapped onto two lines. The word « Salle »
  is now hidden under 380 px (code kept, `.room-code` still contains it for the e2e).

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- Protocol: `EMOTES` (8 stable ids → French text), `EmoteId`, `EMOTE_IDS`, `EMOTE_COOLDOWN_MS` (3000), `isEmoteId`
  (own keys only, so `toString` is refused), `EmoteMessage`; `ClientMessages.emote` / `ServerMessages.emote`.
- Server (`room.ts`, small and local): `onMessage('emote')` → `emote()`; seat known, duel started (also after it ends, for the
  end screen), known id, at most one per seat every 3 s (`roomConfig.now` injectable clock) → sent to both seats. Junk and
  unknown ids are ignored and do not use up the 3 s. No change to the end-of-game hook or anything 8.4 touches.
- Client: `Session.sendEmote?` (online only) and `Snapshot.lastEmote`; `online.ts` listens to `emote` (validates `from`/id)
  and sends `emote`. New `ui/Emotes.tsx`: `EmoteButton` (aria-label « Répliques », list in a portal with the 8 emotes as
  44 px buttons + switch « Couper les répliques adverses » kept in `localStorage['cinecards.muteEmotes']`, try/catch; Escape
  or a tap outside closes) and `EmoteBubbles` (portal layer `pointer-events: none`, bubble below the top portrait / above
  the bottom one, measured from `.table [data-hero]`, 3 s with a short fade, a new emote replaces that player's previous
  one, per-seat timers; dimmed to 20 % while choosing a target; no fade-in under reduced motion).
- `Table.tsx`: button in the `.topbar` between the spacer and the speed button (only if `session.sendEmote`), bubbles layer,
  and a second « Répliques » button on the online end screen (it covers the top bar). Existing buttons and labels unchanged.
- Tests: `apps/server/src/emotes.test.ts` (refused before the duel, relayed to both seats, unknown ids/junk ignored, per-seat
  3 s limit, allowed on the end screen); `e2e/emotes.spec.ts` (two contexts: send « Bien joué ! », seen on both sides,
  `pointer-events: none`, button greyed, gone after ~3 s; B mutes, switch stored, A's next emote not shown at B; B's own
  emote shown on both sides; no button in a local game).
- Screenshots (deviceScaleFactor 1) in `screens/8-5/`: `liste-390x844.png`, `bulle-adverse-390x844.png`,
  `bulle-envoyee-390x844.png`, `liste-360x640.png`, `bulle-adverse-360x640.png`, `fin-bulle-1280x800.png`. Checked: bubbles
  sit over the edge of the board, clear of the hand, banner/« Fin du tour », coin counter and timer; the list fits at
  360 × 640 without scrolling.
- Choices recorded in `a-valider-par-root.md` (Story 8.5, 4 lines).
- DoD: `pnpm typecheck` OK; `pnpm test` 30 files / 238 tests passed; `E2E_SERVER_PORT=2677 E2E_CLIENT_PORT=5284
  PW_CHANNEL=chromium pnpm e2e -- --trace off` 43 passed. No engine or card change (simulation not required).

### File List

- packages/protocol/src/index.ts
- apps/server/src/room.ts
- apps/server/src/emotes.test.ts (new)
- apps/client/src/game/session.ts
- apps/client/src/net/online.ts
- apps/client/src/ui/Emotes.tsx (new)
- apps/client/src/ui/Table.tsx
- apps/client/src/ui/Icon.tsx
- apps/client/src/styles.css
- e2e/emotes.spec.ts (new)
- _bmad-output/implementation-artifacts/screens/8-5/*.png (new)
- _bmad-output/implementation-artifacts/a-valider-par-root.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/8-5-emotes.md

### Change Log

- 2026-11-23 — Story 8.5 implemented: fixed emotes in online duels (protocol, server relay with 3 s limit, top-bar button,
  bubbles, mute switch, end-screen button), server and e2e tests, screenshots. Status: review.
- 2026-11-23 — Revue : fusionnée avec 8.4 (conflits additifs résolus), bulles vérifiées ; typecheck, 249 tests, e2e 44/44. Story terminée.
