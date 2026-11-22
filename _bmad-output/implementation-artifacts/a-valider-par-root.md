# À valider par Root

Décisions prises par le dev pendant l'epic 11, sans attendre (règle : « décide et note »).
Chaque entrée renvoie à la story et, si c'est une règle, à l'`[ASSUMPTION]` ajoutée dans le GDD.
Coche ou corrige après ton prochain playtest.

## Règles et ambiguïtés

_(aucune pour l'instant)_

## Choix de comportement (pas des règles du GDD)

- [ ] **11.2** — La reprise d'un siège marche depuis le même navigateur (rechargement, nouvel onglet, lien, code), pas depuis un autre appareil : il faudrait des comptes (epic 8).
- [ ] **11.2** — Sans jeton de siège, « salle complète » et « partie en cours » donnent le même message (« une partie y est en cours ; si c'est la tienne, rouvre-la depuis le même navigateur dans les 90 s »). Avec un jeton expiré : « ta place n'est plus réservée ».
- [ ] **11.2** — En solo et en hot seat, « Quitter » ramène à l'accueil sans garder la partie ; « Abandonner » (avec confirmation) affiche la défaite.
- [ ] **11.2** — Une salle d'attente vide expire 10 min après le départ de son dernier joueur ; une partie terminée et vide est fermée tout de suite.
- [ ] **11.3** — Choix par défaut à la fin du chrono : une réaction est laissée passer, un choix de cartes garde les premières proposées, puis le tour se termine.
- [ ] **11.3** — Le chrono du tour est en pause pendant une fenêtre de réaction (5 s), dans tous les modes. ~~En ligne, le serveur ne le met pas en pause~~ → **résolu** (suivi 11.3) : le serveur met aussi son chrono en pause, comme le disent le GDD et l'architecture (P3).
- [ ] **11.4** — Les cibles d'un effet déclenché se choisissent au déclenchement, avant le lancer de dé éventuel de la même capacité (ex. L'ange sans ailes : on choisit la carte à éliminer, puis on lance le dé).
- [ ] **11.4** — « Quand il attaque » / « Quand il est attaqué » se résolvent pendant l'attaque (ils peuvent l'annuler) et ne demandent pas de cible.
- [ ] **11.4** — Un effet « à l'arrivée » ou « à la mort » se résout même si la carte a quitté la table entre-temps ; les autres déclencheurs exigent que la carte soit encore en jeu et sans silence.
- [ ] **11.4** — Les effets de fin de tour se résolvent avant le passage du tour ; ceux de début de tour après la pioche.
- [ ] **11.3** — En solo, le chrono tourne aussi pendant le tour du Grimoire (il joue bien plus vite que 75 s).

## Textes de cartes modifiés (story 11.6)

| Carte | Ancien texte | Nouveau texte | OK ? |
|---|---|---|---|
