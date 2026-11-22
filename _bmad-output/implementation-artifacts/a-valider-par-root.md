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
- [ ] **11.3** — En solo et hot seat, le chrono du tour est en pause pendant une fenêtre de réaction (5 s) ; en ligne, le serveur ne le met pas en pause (comportement inchangé).
- [ ] **11.3** — En solo, le chrono tourne aussi pendant le tour du Grimoire (il joue bien plus vite que 75 s).

## Textes de cartes modifiés (story 11.6)

| Carte | Ancien texte | Nouveau texte | OK ? |
|---|---|---|---|
