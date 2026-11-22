---
title: "Addendum — Game Brief CineCards"
created: 2026-11-22
---

# Addendum — détails destinés au GDD

## Anatomie d'une carte papier (set Matrix)

- Haut gauche : coût en pièces (pastille jaune).
- Haut : nom (parfois sous-titre, ex. « Néo a.k.a L'élu »).
- Haut droite : PV (cœur) et icône d'élément (éclair jaune, étoile noire, rouge sombre). Sorts/terrains : « - » PV.
- Illustration (photo de film) avec étiquette « Famille » = rôle : soutien, guerrier, traqueur, snitch, boss/traqueur, héros, sort, terrain, équipement.
- 1 à 4 capacités : icônes de puissance + titre (réplique culte) + texte d'effet.
- Bas gauche : ATQ (épées croisées) ; variantes multiples (« 40 ×3 »).
- Pied : rareté/catégorie. Bordure : gris commune, bleu rare, violet épique, orange légendaire, rouge sort, vert terrain.

## Vocabulaire d'effets observé (à normaliser)

Pioche (N cartes) ; regarder les N prochaines cartes et en garder K ; buff/debuff de stats (ciblé, famille, global) ; sort à choix exclusif ; dé (seuils) ; silence ; poison ; immunité aux effets ; insensibilité aux dégâts ; bouclier absorbant X ; réduction de dégâts en % ; annuler une mort ; soigner des effets néfastes ; copier PV/ATQ ; absorber % de PV/ATQ ; attaques multiples / multi-cibles ; attaque à distance ; ignorer la défense ; attaquer pendant le tour adverse ; effets cycliques « tous les 2 tours » ; invocation conditionnelle depuis main/cimetière ; équipement lié à un personnage (stats ×2) ; destruction par famille (« machines ») ; corps multiples (100+100+100 PV).

## Zones de jeu

Deck commun (200 cartes uniques), main (7 au départ), table (10 cartes max par joueur), cimetière.

## Idées numériques validées (post-MVP sauf mention)

Stats colorées et détail des bonus au survol (MVP) ; compteurs de cycle (MVP) ; journal de partie (MVP) ; chrono de tour (MVP) ; fenêtre de réaction contre-sorts ; réplique culte en sous-titre ; riposte animée en champ-contrechamp ; décor de table selon le terrain ; effets déclenchés complexes (ex. « à chaque mort, Smith +10 ATQ »).

## Alternatives écartées (et pourquoi)

- Méta-jeu (classement, déblocages, collection de prestige, défis, cartes à mémoire) : le jeu, c'est la partie — fidèle au papier.
- IA, matchmaking public, spectateurs : jeu entre amis uniquement.
- 3-4 joueurs, 2v2, replays, tournois : duel 1v1 resserré.
- Chat libre : remplacé par émotes ciné (ton + anti-toxicité).
- Contrôle par l'IA en cas de déconnexion : remplacé par délai de reconnexion puis défaite.

## Sets créés pour le MVP

- `content/sets/holy-grail.json` (13 cartes), `hot-shots.json` (10), `white-chicks.json` (10) ; résumé lisible dans `content/sets/README.md`.
- Illustrations : emblèmes héraldiques originaux par rôle × couleur du film, `content/art/emblems/*.svg` (21 fichiers). Pas de portraits des personnages.
- Le set Matrix (18 cartes) reste à transcrire depuis `docs/reference/paper-cards-matrix.jpg`.

## Maquettes

- Canevas « CineCards — Pistes de design » : page « Direction Grimoire » (feuille de style, table mobile, fiche carte, invitation au duel, moment fort, bureau, galerie des nouvelles cartes).
- Mises en page explorées et retenues comme base : mobile en grille 2×5 (M1) ; bureau « table + inspecteur » (D5).

## Hébergement (pour l'Architecture)

- Front : GitHub Pages (statique). Serveur temps réel : VPS de Root ou service gratuit.
