# Story 8.3: Liste d'amis et invitation directe

Status: ready-for-dev

## Story

As a joueur,
I want inviter un ami de ma liste,
so that je n'aie pas à partager de code.

## Acceptance Criteria

1. **Demande d'ami.** **Given** je suis connecté **When** je saisis le pseudo d'un joueur dans « Amis » et appuie sur
   « Ajouter » **Then** il reçoit une demande (en direct s'il est en ligne, sinon à sa prochaine visite). Pseudo
   inconnu : « Aucun joueur ne porte ce pseudo. » ; moi-même : refusé ; déjà amis ou demande déjà envoyée : message
   clair. Si l'autre m'avait déjà envoyé une demande, mon ajout l'accepte directement.
2. **Répondre.** Le destinataire voit la demande (pastille sur « Amis ») et peut **accepter** ou **refuser**. L'envoyeur
   peut **annuler** une demande en attente. Un ami peut être **retiré** (confirmation) : la relation disparaît des
   deux côtés.
3. **Présence.** Dans ma liste, chaque ami a un **point vert** « en ligne » (le jeu est ouvert, connecté au compte),
   **orange** « en partie » (il joue un duel en ligne) ou gris « hors ligne ». La liste se met à jour en direct
   (quelques secondes au plus).
4. **Inviter.** **Given** un ami en ligne (vert) **When** j'appuie sur « Inviter » **Then** une salle est créée (mode
   de pioche choisi sur l'accueil), j'arrive dans la salle d'attente, et mon ami voit en direct un encart
   « **Pseudo** t'invite à un duel » avec « Rejoindre » et « Refuser ». « Rejoindre » le fait entrer dans ma salle d'un
   appui, avec son pseudo de compte. L'invitation expire au bout de **2 min**, ou dès que la salle commence ou
   disparaît ; « Refuser » me prévient (« Pseudo a refusé. »). Un ami « en partie » ne peut pas être invité.
5. **Où.** « Amis » s'ouvre depuis l'accueil quand je suis connecté (bouton à côté de « Connecté : Pseudo », avec
   pastille du nombre de demandes reçues). L'encart d'invitation s'affiche par-dessus l'accueil **et** la salle
   d'attente ; pas pendant une partie (l'invitation reste visible à la fin si elle n'a pas expiré).
6. **Invité et ancien serveur.** Sans compte : aucun changement. Face à un serveur sans la fonction (`/api/health` sans
   `friends: true`) : bouton « Amis » caché.
7. **Limites.** Au plus 100 amis et 50 demandes envoyées en attente par compte ; au plus 1 invitation en cours par
   joueur invité ; au plus 20 demandes ou invitations par minute par compte (« Doucement ! Réessaie dans un
   instant. »).

## Tasks / Subtasks

- [ ] **Base** — migration 3 ajoutée à `MIGRATIONS` (`apps/server/src/db/db.ts`), sans toucher aux migrations 1 et 2
      (la base de production est en version 2 avec de vrais comptes) (AC 1, 2, 7)
  - [ ] `friendships(a INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, b INTEGER NOT NULL REFERENCES
        accounts(id) ON DELETE CASCADE, requested_by INTEGER NOT NULL, status TEXT NOT NULL CHECK(status IN
        ('pending','accepted')), created_at INTEGER NOT NULL, accepted_at INTEGER, PRIMARY KEY (a, b),
        CHECK (a < b))` + index sur `b` (une ligne par paire, `a` = plus petit id).
  - [ ] `apps/server/src/db/friends.ts` : demander (ou accepter si l'autre a déjà demandé), accepter, refuser /
        annuler / retirer (supprimer la ligne), lister (amis acceptés + demandes reçues + envoyées, avec pseudos).
  - [ ] Test : base en version 2 avec comptes → version 3 sans perte.
- [ ] **API HTTP** — `apps/server/src/api/http.ts` + un `FriendService` (`apps/server/src/auth/friends.ts` ou
      `apps/server/src/social/friends.ts`) qui reçoit le `Db`, l'horloge et `accountOf` (AC 1, 2, 6, 7)
  - [ ] `GET /api/health` ajoute `friends: true`.
  - [ ] `GET /api/friends` (Bearer) → `{ friends: [{ id, nickname, presence }], incoming: [{ id, nickname }],
        outgoing: [{ id, nickname }] }` (`presence` lue dans le registre de présence ci-dessous).
  - [ ] `POST /api/friends` `{ nickname }` → `201 { status: 'pending' | 'accepted' }` ; erreurs `404 unknown_player`,
        `400 self`, `409 already_friends | already_requested`, `429 slow_down`, `409 limit_reached`.
  - [ ] `POST /api/friends/:id/accept` → `204` ; `DELETE /api/friends/:id` → `204` (refuser, annuler ou retirer,
        selon l'état). Toute modification notifie les deux comptes en direct (salle `hub`, ci-dessous).
  - [ ] Messages en français, tutoiement, format `{ error, message }` des stories 8.1-8.2.
- [ ] **Présence et invitations en direct** — salle Colyseus `hub` (`apps/server/src/hub.ts`, déclarée dans
      `main.ts` à côté de `duel`) (AC 3, 4, 5)
  - [ ] Une seule instance partagée (`filterBy` inutile : créer avec `joinOrCreate('hub')`, `maxClients` élevé,
        `autoDispose = false`). Entrée seulement avec une session valide (`onAuth` ou `onJoin` qui refuse : options
        `{ session }`, même `accountOf` que la salle de duel). Un compte peut avoir plusieurs onglets / appareils :
        compter les connexions par compte.
  - [ ] Registre de présence en mémoire, module partagé (`apps/server/src/presence.ts`) : `online(accountId)`,
        `offline(accountId)`, `inGame(accountId, bool)` ; `DuelRoom` signale `inGame` au début de la partie et à sa
        fin / quand le siège est libéré (via `accounts[seat]` déjà retenu en 8.1). Chaque changement de présence
        envoie `friendPresence { id, presence }` aux amis connectés au `hub`.
  - [ ] Messages serveur → client (dans `packages/protocol`) : `friendPresence`, `friendsChanged` (le client relit
        `GET /api/friends`), `invite { inviteId, from: { id, nickname }, roomCode, mode, expiresAt }`,
        `inviteCancelled { inviteId, reason: 'expired' | 'started' | 'gone' | 'cancelled' }`,
        `inviteDeclined { inviteId, by: { id, nickname } }`.
  - [ ] Messages client → serveur : `invite { friendId, roomCode }` (le serveur vérifie : amis acceptés, ami en
        ligne et pas en partie, la salle existe, est en attente et a été créée par ce compte — `DuelRoom` retient le
        compte du siège 0), `declineInvite { inviteId }`, `cancelInvite { inviteId }`. Invitation expirée au bout de
        2 min, annulée quand la salle démarre (2 joueurs) ou disparaît.
  - [ ] Une salle de duel peut être retrouvée par code : utiliser `matchMaker.getLocalRoomById(code)` (ou un
        registre local tenu par `DuelRoom` en `onCreate`/`onDispose`) ; un seul processus serveur, c'est suffisant.
- [ ] **Client** (AC 1-6)
  - [ ] `apps/client/src/account/hub.ts` : connexion au `hub` avec le SDK Colyseus **chargé à la demande** (comme
        `net/online.ts`, l'accueil ne doit pas embarquer le SDK pour un invité), une seule connexion par onglet, quand
        le joueur est connecté et que le serveur a `friends: true` ; reconnexion automatique du SDK ; fermée à la
        déconnexion du compte. Store simple (comme `session.ts`) : amis, demandes, invitations reçues.
  - [ ] `apps/client/src/account/FriendsPanel.tsx` (portail dans `<body>`, comme `AccountPanel`) : champ pseudo +
        « Ajouter », demandes reçues (Accepter / Refuser), demandes envoyées (Annuler), amis avec point de présence,
        « Inviter » (si vert) et « Retirer » (confirmation). Cibles de 44 px. État vide : « Ajoute un ami avec son
        pseudo. »
  - [ ] `apps/client/src/account/InviteToast.tsx` : encart en haut de l'écran (portail), « **Pseudo** t'invite à un
        duel » · Rejoindre · Refuser, compte à rebours discret ; plusieurs invitations empilées (3 au plus visibles).
        « Rejoindre » = le même chemin que rejoindre par code (`start({ kind: 'join', code, … })` avec la session).
        Affiché sur l'accueil et la salle d'attente, pas sur la table.
  - [ ] Inviter depuis l'accueil : crée la salle (`start({ kind: 'create', … })`), puis envoie `invite` au `hub`
        quand le code de salle est connu ; la salle d'attente montre « Invitation envoyée à **Pseudo** » (et
        « Pseudo a refusé. » le cas échéant).
  - [ ] `ui/Home.tsx` : bouton « Amis » (pastille) à côté de la ligne « Connecté : Pseudo » (garder le texte
        « Connecté : <pseudo> » et la classe `.account-line` : e2e 8.1/8.2).
- [ ] **Tests** (AC 1-7)
  - [ ] Serveur `apps/server/src/friends.test.ts` : migration 2 → 3 ; demande, acceptation croisée automatique,
        refus, annulation, retrait, limites, erreurs ; via WebSocket (comme `server.test.ts`) : présence en ligne /
        hors ligne / en partie, invitation reçue en direct, refus notifié, expiration (horloge ou délai injectable,
        pas d'attente de 2 min), annulation au démarrage de la salle, refus d'inviter un non-ami ou un ami en partie,
        `hub` refusé sans session.
  - [ ] e2e `e2e/friends.spec.ts` : deux comptes dans deux contextes ; A ajoute B, B accepte ; B voit A en vert ; A
        invite B ; B voit l'encart et rejoint d'un appui ; la partie démarre avec les deux pseudos ; A voit B
        « en partie » depuis un troisième contexte si simple, sinon vérifier via l'API.
  - [ ] Les e2e existants passent sans changement.

## Dev Notes

### Ce qui existe (réutiliser)
- Comptes et sessions : `apps/server/src/auth/service.ts` (`AccountService.accountOf(token)` synchrone),
  `api/http.ts` (`createApi`, routage `switch` + test de préfixe pour les routes à paramètre comme
  `DELETE /api/passkeys/:id`, CORS, `readJson`), `db/db.ts` (`MIGRATIONS`, `migrate`).
- `apps/server/src/room.ts` : `DuelRoom` retient `accounts[seat]` (8.1) ; `onJoin` nomme le siège d'après la session ;
  `startDuel()` quand les deux sièges sont pris ; `holdSeat` (11.2) ; expiration des salles vides. Ajouter ici les
  signaux de présence « en partie » et la libération à la fin (`duel.finished`, `onDispose`).
- `apps/server/src/main.ts` : `server.define(ROOM_NAME, DuelRoom)` ; ajouter `server.define('hub', HubRoom)`.
  `roomConfig` (catalogue, comptes injectés au démarrage) : y injecter aussi le registre de présence.
- Client : `account/session.ts` (`useAccount`, `serverFeatures()` dans `api.ts` lit `/api/health`),
  `account/AccountPanel.tsx` (modèle de panneau en portail), `net/online.ts` (chargement du SDK à la demande,
  `create`/`joinById` avec `session`), `App.tsx` (`start()`), `ui/Lobby.tsx` (salle d'attente).
- La page, l'API et le WebSocket sont à la même origine en production depuis 8.6 (`cinecards.sevend.io`).

### Compatibilité d'une version (AGENTS.md)
- Nouvelle salle `hub` et nouvelles routes seulement : les anciens clients ne les appellent pas. Le nouveau client ne
  montre « Amis » que si `/api/health` a `friends: true`.

### Choix à noter dans `a-valider-par-root.md` (section « Epics 8 et 10 »)
- Ajout par pseudo exact ; ajout croisé = acceptation ; présence à trois états ; invitation de 2 min, une à la fois par
  ami, pas pendant une partie ; limites 100 amis / 50 demandes / 20 actions par minute.

### Tests et définition de fini
- `pnpm typecheck`, `pnpm test`, `PW_CHANNEL=chromium pnpm e2e -- --trace off` (ports dédiés). `e2e/play-draw.spec.ts`
  est fragile en parallèle sous charge (réussit seul) : s'il échoue, le relancer seul et le signaler.
- Pas de moteur ni de cartes touchés.
- Après livraison : vérifier `/api/health` (`friends: true`) sur `https://cinecards.sevend.io` et un ajout d'ami +
  invitation entre deux comptes de test réels.

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.3]
- [Source: _bmad-output/game-architecture.md#Decision Summary (Presence: room `hub`)]
- [Source: _bmad-output/implementation-artifacts/8-1-compte-avec-pseudo-et-mot-de-passe.md], [8-2], [8-6]
- [Source: AGENTS.md]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created

### File List
