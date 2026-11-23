# Maquettes du constructeur de deck (story 10.2)

Règle : un deck construit compte exactement 50 cartes, une copie de chaque. Les maquettes utilisent les
51 vraies cartes (`content/sets/*.json`) et le deck d'exemple « Chevaliers et agents » à 47 / 50.
Toutes les options doivent tenir jusqu'à environ 500 cartes : seule la liste des cartes défile, et le
filtre Film s'ouvre dans une liste avec recherche, pas une rangée de puces.

- **A · Deck en haut** (`A-deck-en-haut.dc.html`) : un panneau « Mon deck » fixe en haut (compteur,
  erreur, courbe de coût, bande de miniatures à retirer d'un geste) au-dessus d'une grille de 4 colonnes.
  - Pour : on voit le deck et la collection en même temps.
  - Contre : en 360 × 640, la grille n'a plus qu'une rangée et demie, et ses cartes sont petites.
- **B · Grille unique** (`B-grille-unique.dc.html`) : une grille de 3 colonnes de grandes cartes, une
  coche dorée sur celles du deck, une barre fixe en bas « 47 / 50 · Il manque 3 cartes · Voir le deck ».
  Les filtres sont dans une feuille (film avec recherche, catégorie, rareté, coût) et le deck s'ouvre
  dans une seconde feuille.
  - Pour : les cartes sont lisibles, il y a un seul geste (toucher = ajouter ou retirer) et le compteur
    reste toujours visible.
  - Contre : il faut ouvrir une feuille pour voir le deck entier.
- **C · Onglets + liste** (`C-onglets-liste.dc.html`) : deux onglets, « Collection » et « Mon deck »,
  avec une liste compacte (jeton de coût, nom, rareté, film, ATQ/PV, bouton + ou −), groupée par coût
  ou par catégorie.
  - Pour : c'est l'option la plus dense (environ 11 cartes par écran) et la plus rapide à parcourir
    quand il y aura 500 cartes. Tout se lit, même en 360 × 640.
  - Contre : on ne voit plus les cartes elles-mêmes, et le constructeur ressemble moins au jeu.
- **Mes decks** (`Mes-decks.dc.html`, écran commun aux trois options) : la liste des decks enregistrés
  sur le compte, avec le statut (Valide, ou l'erreur), les actions Modifier, Copier et Supprimer, et la
  confirmation avant de supprimer.

Erreurs montrées : « Il manque 3 cartes » (A, B, C), « Une seule copie par carte » (bandeau de C) et
« 1 carte de trop » (Mes decks).

**Recommandation : B.** C'est l'option qui garde l'aspect du jeu (les vraies cartes, lisibles en
3 colonnes). Le compteur et l'erreur restent visibles en permanence dans la barre du bas. Les filtres
dans une feuille passent à 500 cartes et à des dizaines de films sans encombrer l'écran. On peut
reprendre de C un bouton grille / liste dans la feuille « Voir le deck », pour relire vite les 50 cartes.

Captures (390 × 844, ×2) : `A-deck-en-haut.png`, `B-grille-unique.png`, `C-onglets-liste.png`,
`Mes-decks.png`. Il y a aussi des états en plus : `B-grille-unique-filtres.png`,
`B-grille-unique-deck.png`, `C-onglets-liste-mon-deck.png`, `Mes-decks-supprimer.png`, et le contrôle en
360 × 640 `A-deck-en-haut-360x640.png` et `C-onglets-liste-360x640.png`.

Ce sont des sources du canevas de design (HTML et CSS en ligne, rendu statique) et non du code de
l'application. Ouvrez-les dans un navigateur (l'inclusion de `support.js` peut être ignorée).
