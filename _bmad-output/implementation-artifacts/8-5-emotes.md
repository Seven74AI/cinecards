# Story 8.5: Émotes

Status: ready-for-dev

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

- [ ] **Protocole** — `packages/protocol/src/index.ts` (AC 3, 7)
  - [ ] `EMOTES` (identifiant → texte français), type `EmoteId` ; `ClientMessages.emote: { id: EmoteId }` ;
        `ServerMessages.emote: { from: PlayerId; id: EmoteId }`.
- [ ] **Serveur** — `apps/server/src/room.ts` (AC 3, 4, 6)
  - [ ] `onMessage('emote')` : siège connu, duel commencé, identifiant connu, au plus une toutes les 3 s par siège
        (horloge injectable pour le test) → `broadcast('emote', { from: seat, id })` aux deux sièges.
- [ ] **Client** — `apps/client/src/net/online.ts`, `game/session.ts`, `ui/Table.tsx` (AC 1, 2, 4, 5, 6)
  - [ ] `Session` gagne `sendEmote?(id)` (en ligne seulement) et l'état `lastEmote?: { from, id, at }` ; `online.ts`
        écoute `emote` et envoie `emote`.
  - [ ] `ui/Emotes.tsx` : bouton bulle dans la `.topbar` (à côté de « Quitter » et de la vitesse), liste des 8 répliques
        + interrupteur « Couper les répliques adverses » (`localStorage['cinecards.muteEmotes']`, try/catch) ; bulles
        près des portraits (classe `pointer-events: none`), 3 s, fondu ; respecte « réduire les animations ».
        Cibles de 44 px ; la liste tient à 360 × 640 sans défilement.
- [ ] **Tests** (AC 1-7)
  - [ ] Serveur (`server.test.ts` ou `emotes.test.ts`) : relais aux deux sièges, identifiant inconnu ignoré, limite de
        3 s, refus avant le début du duel.
  - [ ] e2e `e2e/emotes.spec.ts` : duel en ligne entre deux contextes ; A envoie « Bien joué ! » ; B la voit puis elle
        disparaît après ~3 s ; B coupe les répliques ; une nouvelle réplique de A n'apparaît plus chez B.
  - [ ] Les e2e existants passent (la barre du haut garde ses boutons et leurs libellés).

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

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created

### File List
