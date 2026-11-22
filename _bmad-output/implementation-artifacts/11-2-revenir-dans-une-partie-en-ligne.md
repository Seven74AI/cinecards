# Story 11.2: Revenir dans une partie en ligne

Status: done

## Story

As a joueur en ligne (hôte ou invité),
I want revenir dans ma partie après l'avoir quittée ou perdu la connexion,
So that une coupure ou une erreur de bouton ne termine pas le duel.

## Acceptance Criteria

**Given** un joueur parti depuis moins de 90 s
**When** il saisit le code ou rouvre le lien, même dans un nouvel onglet
**Then** il retrouve son siège et la partie à l'identique
**And** « Quitter » n'abandonne plus (message « vous pourrez revenir pendant 90 s ») ; « Abandonner » demande confirmation
**And** une salle d'attente survit au départ de l'hôte pendant 10 min
**And** les erreurs distinguent salle introuvable, salle complète et partie en cours à reprendre
**And** le test e2e couvre hôte qui part et revient, invité qui part et revient, nouvel onglet

## Tasks / Subtasks

- [x] Serveur (`apps/server/src/room.ts`) : plus de `onDrop` ; `onLeave` réserve le siège 90 s pour un départ volontaire comme pour une coupure ; seul l'action `concede` abandonne ; `autoDispose = false`, salle d'attente vide détruite après 10 min (`LOBBY_TTL_MS`), partie finie et vide détruite tout de suite ; plus de `unlock()` en fin de partie
- [x] Client (`net/config.ts`) : jetons de siège dans `localStorage`, indexés par code (valables pour un nouvel onglet), purgés après 2 h
- [x] Client (`net/online.ts`) : rejoindre par code essaie d'abord le jeton enregistré (`client.reconnect`), puis `joinById` ; messages d'erreur distincts (`joinErrorMessage`) ; « Quitter » = `leave()` sans oublier le jeton ; `concede` et fin de partie oublient le jeton ; bandeau « Reconnexion… » pendant la reconnexion automatique du SDK
- [x] UI (`Table.tsx`) : « Quitter » explique le délai de 90 s ; « Abandonner » demande confirmation ; accueil : « Reprendre la partie en ligne (salle CODE) » ; le code d'une jonction ratée reste dans le formulaire
- [x] Tests : `server.test.ts` (siège gardé puis forfait, retour avec le jeton, salle d'attente qui survit puis expire) ; e2e `online-rejoin.spec.ts` (hôte par code, invité par lien, nouvel onglet, erreurs) ; `online-duel.spec.ts` passe par « Abandonner »

## Dev Notes

- Colyseus 0.18 : un départ consenti appelle `onLeave`, une coupure `onDrop` puis `onLeave` si la reconnexion échoue. Sans `onDrop`, les deux passent par `onLeave`, où `allowReconnection` fonctionne aussi.
- Le jeton change à chaque reconnexion (`previousClient.reconnectionToken = newClient.reconnectionToken`) : le client le réenregistre après chaque reconnexion.
- Compatibilité d'une version : l'ancien client envoie `concede` avant de quitter, donc il abandonne toujours explicitement avec le nouveau serveur. Le nouveau client avec l'ancien serveur : « Quitter » abandonne encore (comportement d'avant) jusqu'au déploiement du serveur.

## Dev Agent Record

### Completion Notes List

- Choix par défaut (notés dans `a-valider-par-root.md`) : reprise limitée au même navigateur (pas d'autre appareil sans comptes) ; « salle complète » et « partie en cours » partagent le même message quand on n'a pas de jeton ; en solo / hot seat, « Quitter » ne conserve pas la partie.
- `pnpm typecheck` OK, `pnpm test` 82/82, `PW_CHANNEL=chromium pnpm e2e -- --trace off` 3/3 (2026-11-22).

### File List

- apps/server/src/room.ts
- apps/server/src/server.test.ts
- apps/client/src/net/config.ts
- apps/client/src/net/online.ts
- apps/client/src/App.tsx
- apps/client/src/game/session.ts
- apps/client/src/ui/Table.tsx
- e2e/online-duel.spec.ts
- e2e/online-rejoin.spec.ts

## Change Log

- 2026-11-22 — Reprise de siège par code, lien ou nouvel onglet ; Quitter / Abandonner (mode autonome).
