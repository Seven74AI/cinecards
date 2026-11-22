# À valider par Root

Décisions prises par le dev pendant les epics 11 et 12, sans attendre (règle : « décide et note »).
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
- [ ] **11.5** — À la fin du chrono, « jusqu'à N » prend aucune cible ; un choix dans le deck (ex. Le maître des clés) garde quand même les premières cartes proposées (prendre des cartes n'est jamais pénalisant).
- [ ] **11.5** — Le Grimoire (solo) choisit un nombre de cibles au hasard entre le minimum et N, mais garde toujours le maximum de cartes dans un choix du deck.
- [ ] **11.6** — Les Sentinelles (« Attaque groupée sur Sion ») : comme c'est maintenant leur attaque du tour, l'ATQ absorbée dure jusqu'à la fin de votre **prochain** tour (avant : 1 tour, qui expirait avant qu'elles puissent attaquer).
- [ ] **11.6** — Topper (« Pilote d'élite ») reste une capacité activée tous les 2 tours, qui prépare son attaque du tour (le tableau 4.3 dit « inchangé ») ; c'est la seule capacité « active » de personnage restante.
- [ ] **11.6** — Unité A.P.U : le texte « Ne fonctionne qu'avec les cartes neutres du monde de Matrix : +100 ATQ » devient « Sinon, une de vos cartes du monde de Matrix gagne +100 ATQ » (c'est ce que faisait déjà le moteur).
- [ ] **11.6** — Smith (« Je n'peux plus la supporter… ») : vous choisissez les cartes dans tout votre cimetière, jusqu'à 15 et dans la limite de 10 cartes en main.
- [ ] **11.6** — « Ville des machines » (Sentinelles), Topper « Compteur de victimes », le Gardien du pont et Sire Robin prennent un déclencheur explicite (début de tour, quand il détruit une carte, quand il est attaqué) sans changer de texte (sauf « Début de votre tour » pour les Sentinelles).
- [ ] **11.3** — En solo, le chrono tourne aussi pendant le tour du Grimoire (il joue bien plus vite que 75 s).
- [ ] **11.7** — Étiquettes de capacité : « Effet » pour les sorts (y compris les pilules de Morpheus, au choix) ; « Activée » pour la seule capacité activée de personnage restante (Topper, « Pilote d'élite ») ; les autres reprennent le nom du déclencheur (« À l'arrivée », « Attaque spéciale », « Passif », « Début de votre tour »…). Sur la fiche, l'étiquette remplace les mots de tête du texte (« À l'arrivée : » n'est pas répété).
- [ ] **11.7** — En miniature (carte de moins de ~88 px de large : main et socles sur téléphone), le jeton montre sa forme et le coût, sans l'icône ; l'icône apparaît en fiche et sur les cartes plus grandes (ordinateur).
- [ ] **11.7** — Une carte légendaire, quelle que soit sa catégorie, déclenche maintenant la mise en avant « Légendaire » quand elle est posée (avant : personnages seulement, faute de rareté).
- [ ] **11.8** — Le glossaire du jeu est lu dans `glossaire-mots-cles.md` au moment de la construction : corriger un texte là-bas suffit (il apparaît au prochain déploiement). Les formes reconnues dans les textes de cartes (« réduit au silence », « GUÉRIT », « une fois par partie » → Usage unique, « au choix » → Choix exclusif, « monde de » → Famille, « débarque » → Invoquer depuis…) sont listées dans `apps/client/src/game/richtext.ts`.
- [ ] **11.8** — Renvoi « … » : vers une carte si le nom correspond (nom exact, sans article — « Sentinelles » → Les sentinelles —, partie avant « a.k.a » — « Smith » —, ou nom unique qui le contient — « A.P.U »), sinon vers une capacité de ce nom ; « Matrix », « Les Agents », « Le Lazar » ne renvoient à rien (pas de carte de ce nom).
- [ ] **11.8** — L'écran « Règles et mots-clés » s'ouvre depuis l'accueil (lien sous « Voir les cartes ») et depuis la barre du haut de la table (bouton « ? ») ; sur l'accueil, toucher une carte de la collection ouvre sa fiche.
- [ ] **11.8** — Message d'erreur quand on vise les PV adverses protégés : « Barrage : tant que ton adversaire a un personnage en jeu, ses PV ne peuvent pas être attaqués. »
- [ ] **12.1** — Réglage « Vitesse des animations » : un bouton dans la barre du haut de la table (×1 normale → ×2 rapide → ⏭ instantanée), gardé sur l'appareil. Par défaut : normale.
- [ ] **12.1** — Quand le joueur agit pendant une animation, la suite se joue 4 fois plus vite (2 fois plus vite quand plusieurs lots attendent) ; la main, les boutons et les fenêtres de choix suivent tout de suite l'état réel.
- [ ] **12.1** — En solo, le Grimoire attend la fin de l'animation précédente avant son action suivante (son tour dure donc un peu plus). En hot seat, l'animation se met en pause derrière l'écran « Passe l'appareil » et reprend quand le joueur suivant est prêt. Si l'onglet passe en arrière-plan, on saute à la fin.
- [ ] **12.1** — Durées de base (vitesse normale) : attaque 0,39 s + impact 0,3 s, dégâts 0,3 s, coup au joueur 0,42 s, mort 0,8 s puis 1,2 s depuis 12.4 (la carte reste dans son socle pendant ce temps), pose 0,35 s, légendaire 1,5 s, dé 1,3 s.
- [ ] **12.2** — Sur le téléphone, la table est plus haute que dans la démo : l'attaquant s'arrête juste avant sa cible (les cartes se touchent) au lieu de 78 % du trajet. Les réactions (« pendant le tour adverse ») ont le même trait que l'attaque spéciale, en doré au lieu de bleu.
- [ ] **12.3** — Une carte réduite au silence garde des chaînes discrètes dessinées sur elle tant que le silence dure (en plus de l'icône). Quand aucun mouvement n'est en cours, les PV changent sans défiler. Aucune carte actuelle n'empoisonne : l'effet « bulles » est prêt pour les futures cartes.
- [ ] **12.4** — La mort dure 1,2 s (au lieu des 0,8 s visés par la spécification) pour garder le rythme de la démo validée : figée, fissurée, tremblement, puis brûlure ; les cendres volent ensuite pendant que la partie continue. En vitesse rapide : 0,6 s.
- [ ] **13.1** — Noms d'usage (alias) ajoutés aux données : Arthur, Lancelot, Robin, Galahad, Topper, Ramada, Benson, Iffune, Smith, Sentinelles, A.P.U, Néo, Mulo, Latrell, Marcus, Kevin, Gomez, Elliott. Un nom sans guillemets n'est reconnu qu'avec sa majuscule : « la Matrice » (Néo, Cypher) n'ouvre pas le terrain La Matrice, et « Morpheus » (Cypher) n'ouvre pas Les pilules de Morpheus. « Les Agents », « Le Lazar » et « Le Lazer » (E.M.P) ne correspondent à aucune carte et restent du texte.
- [ ] **13.1** — Toucher un nom ouvre un aperçu par-dessus la fiche, qui reste ouverte dessous. Si la carte citée est sur la table, la fiche s'efface le temps de l'aperçu, le socle s'illumine en doré et l'aperçu se place sur l'autre moitié de l'écran. Sur ordinateur, l'aperçu apparaît après 0,25 s de survol et disparaît quand la souris s'en va (un clic le garde ouvert). « Voir la fiche » empile la fiche complète : la fermer ramène à la fiche précédente.
- [ ] **13.3** — Le petit nombre sur un écusson compte toutes les sources qui le modifient, y compris la carte elle-même (aura d'Arthur sur lui-même, compteur de Topper) ; une telle source est listée « (elle-même) » sans trait. Les traits partent des sources en jeu (personnages, terrains, sorts) tant que la fiche de la carte est ouverte. Sur téléphone, la fiche s'ouvre alors abaissée (un tiers de l'écran, poignée pour l'agrandir) ; une source couverte par la fiche (terrain de ma rangée) a son trait qui passe sous la fiche. À revoir avec la nouvelle table mobile (13.2).
- [ ] **13.3** — Durée affichée : « tant qu'elle est en jeu » pour une aura, « encore N tour(s) » pour un effet temporaire (décompté à la fin des tours du propriétaire de la carte modifiée), « permanent » sinon.

## Textes de cartes modifiés (story 11.8)

« Attaque » → « Attaque spéciale » en tête des 6 capacités d'attaque, le reste du texte inchangé : Les Chevaliers qui disent « Ni ! » (« Ni ! »), Ramada Thompson (« Le dîner romantique »), Les sentinelles (« Attaque groupée sur Sion »), Le Mulo (« la femme en robe rouge »), Kevin Copeland (« Couverture grillée »), Heather et Megan Vandergeld (« Langue de vipère »).

## Raretés proposées pour les sorts, équipements et terrains (story 11.7)

Courbe du GDD : commune 1-3, rare 4-5, épique 6-8, légendaire 9+ ; terrains selon leur impact.

| Carte | Catégorie | Coût | Rareté proposée | OK ? |
|---|---|---|---|---|
| Fuyez ! Fuyez ! | Sort | 2 | Commune | |
| Le dîner sur le ventre | Sort | 3 | Commune | |
| Battle de danse | Sort | 5 | Rare | |
| La Sainte Grenade d'Antioche | Sort | 6 | Épique | |
| Missile à tête chercheuse | Sort | 7 | Épique | |
| Les pilules de Morpheus | Sort | 7 | Épique | |
| E.M.P | Sort | 8 | Épique | |
| Ça pisse tu m'étonnes | Sort | 12 | Légendaire | |
| Unité A.P.U | Équipement | 6 | Épique | |
| Le porte-avions | Terrain | 3 | Commune (+20 ATQ seulement) | |
| Camelot | Terrain | 3 | Rare (+30 PV et bloque un terrain adverse) | |
| Les Hamptons | Terrain | 3 | Rare (+30 ATQ et plafond +3) | |
| La Matrice | Terrain | 0 | Légendaire (−50 % de dégâts pour tout Matrix) | |

## Textes de cartes modifiés (story 11.6)

| Carte — capacité (réplique inchangée) | Ancien texte | Nouveau texte | OK ? |
|---|---|---|---|
| Les Chevaliers qui disent « Ni ! » — « Ni ! » | Réduit au silence un personnage adverse pendant 1 tour. | Attaque : réduit au silence un personnage adverse pendant 1 tour. | |
| Tim l'Enchanteur — « Certains m'appellent… Tim » | À son arrivée : inflige 50 dégâts au personnage adverse de votre choix. | À l'arrivée : inflige 50 dégâts au personnage adverse de votre choix. | |
| Patsy — « Clip-clop » | Arthur peut attaquer dès son arrivée (voir « Au galop ! »). | Tant que Patsy est sur votre table, Arthur a la hâte (voir « Au galop ! »). | |
| Camelot — « Personne n'a envie d'y aller » | À son arrivée : l'adversaire ne peut pas poser de terrain à son prochain tour. | À l'arrivée : l'adversaire ne peut pas poser de terrain à son prochain tour. | |
| Ramada Thompson — « Le dîner romantique » | Topper gagne +40 ATQ et +40 PV jusqu'à la fin du tour. | Attaque : Topper gagne +40 ATQ et +40 PV jusqu'à la fin du tour. | |
| Amiral Benson — « Vétéran de toutes les guerres » | Au début de votre tour, il perd 10 PV et vos cartes Hot Shots! gagnent +20 ATQ. | Début de votre tour : il perd 10 PV et vos cartes Hot Shots! gagnent +20 ATQ jusqu'à la fin du tour. | |
| Le Commandant de l'escadrille — « Briefing » | À son arrivée : un de vos personnages peut attaquer une deuxième fois ce tour. | À l'arrivée : un de vos personnages peut attaquer une deuxième fois ce tour. | |
| Le maître des clés — « Il y a un immeuble, dans cet immeuble il y a un étage auquel nul escalier ne conduit… » | Vous regardez les 6 prochaines cartes de VOTRE deck et en choisissez 3. | À l'arrivée : regardez les 6 prochaines cartes de VOTRE deck et gardez-en jusqu'à 3. | |
| Epok — « Lumière EPOK » | Vous piochez 3 cartes. | À l'arrivée : vous piochez 3 cartes. | |
| Epok — « J'espère que l'oracle t'a prédit de bonnes choses » | Vous boostez TOUTES les cartes du monde de « Matrix » : +30 ATQ / +50 PV. | À l'arrivée : vous boostez TOUTES les cartes du monde de « Matrix » en jeu : +30 ATQ / +50 PV. | |
| Dozer — « Ça dégraisse les moteurs et ça tue les cellules grises » | Cocktail de Dozer du Nebuchadnezzar : GUÉRIT TOUTES vos cartes des effets NÉGATIFS. | À l'arrivée : cocktail de Dozer du Nebuchadnezzar, GUÉRIT TOUTES vos cartes des effets NÉGATIFS. | |
| Unité A.P.U — « Commandant Lock, toutes les A.P.U sont en position ! » | Si « Capitaine Iffune » est dans un des cimetières, dans une main ou sur le terrain adverse, il vient sur VOTRE terrain avec STATS ×2. Ne fonctionne qu'avec les cartes neutres du monde de « Matrix » : +100 ATQ. | À l'arrivée : si « Capitaine Iffune » est dans un des cimetières, dans une main ou sur le terrain adverse, il vient sur VOTRE terrain avec STATS ×2. Sinon, une de vos cartes du monde de « Matrix » gagne +100 ATQ. | |
| Les sentinelles — « Attaque groupée sur Sion » | Vous absorbez l'ATQ de vos cartes présentes sur le terrain pendant 1 tour (usage unique). | Attaque, usage unique : vous absorbez l'ATQ de vos autres cartes présentes sur le terrain jusqu'à la fin de votre prochain tour. | |
| Les sentinelles — « Ville des machines » | Tant que les Sentinelles sont sur le terrain, TOUTES vos cartes se soignent de 50 PV. | Début de votre tour : tant que les Sentinelles sont sur le terrain, TOUTES vos cartes se soignent de 50 PV. | |
| Switch — « Écoute, on n'a pas le temps de jouer à question-réponse, obéis-moi ou bien casse-toi ! » | Confère un bouclier pouvant encaisser 40 dégâts à TOUTES vos cartes. | À l'arrivée : confère un bouclier pouvant encaisser 40 dégâts à TOUTES vos cartes. | |
| L'ange sans ailes — « Là-bas en face de l'ascenseur il y a un vestiaire… Vous avez la charge » | Lors de votre arrivée, vous lancez le dé : 1-2 rien ne se passe, 3-6 élimine une carte adverse. | À l'arrivée : vous lancez le dé : 1-2 rien ne se passe, 3-6 élimine une carte adverse de votre choix. | |
| L'ange sans ailes — « Un code est inséré dans le computer… » | Piochez les 3 prochaines cartes du deck ADVERSE OU jouez 1 carte gratuitement ce tour-ci. | À l'arrivée, au choix : piochez les 3 prochaines cartes du deck ADVERSE OU jouez 1 carte gratuitement ce tour-ci. | |
| Tank — « Opérateur ?! Eh, l'magicien, fais-moi sortir maintenant ! » | Les agents sont à vos trousses : choisissez 3 cartes sur le terrain avant de les renvoyer dans la main de leur propriétaire. | À l'arrivée : les agents sont à vos trousses, choisissez jusqu'à 3 cartes sur le terrain et renvoyez-les dans la main de leur propriétaire. | |
| Smith a.k.a The Virus — « Je hais cette planète, ce zoo, cette prison, cette réalité peu importe comment vous la nommez » | Vous ABSORBEZ 50 % des PV/ATQ actuels de TOUTES les cartes sur le terrain. | À l'arrivée : vous ABSORBEZ 50 % des PV/ATQ actuels de TOUTES les cartes sur le terrain. | |
| Smith a.k.a The Virus — « Je n'peux plus la supporter, elle sent la MERDE ! » | Vous piochez dans votre cimetière jusqu'à 15 cartes max. dans votre main. | À l'arrivée : choisissez jusqu'à 15 cartes de votre cimetière et prenez-les en main. | |
| Le Mulo — « Ah au fait, on m'a dit que t'as eu droit à mon programme spécial « la femme en robe rouge »… » | Vos adversaires se battent pour la femme en robe rouge : chaque ennemi attaque ses alliés adjacents. | Attaque, tous les 2 tours : vos adversaires se battent pour la femme en robe rouge, chaque ennemi attaque ses alliés adjacents. | |
| Le Mulo — « Le p'tit derrière toi c'est l'Mulo » | TOUTES les cartes du monde de « MATRIX » gagnent +40 ATQ / +50 PV. | À l'arrivée : TOUTES les cartes du monde de « MATRIX » en jeu gagnent +40 ATQ / +50 PV. | |
| Trinity — « Je crois en la prophétie de l'Oracle » | Pendant 2 tours, TOUTES les cartes du monde de « MATRIX » peuvent attaquer 2 fois ; de plus lancez un dé : 1-3 = dégâts IGNORÉS / 4-6 = dégâts SUBIS. | À l'arrivée : pendant 2 tours, TOUTES vos cartes du monde de « MATRIX » peuvent attaquer 2 fois ; de plus lancez un dé : 1-3 = dégâts IGNORÉS / 4-6 = dégâts SUBIS. | |
| Néo a.k.a L'élu — « Trinity ! Aide-moi ! » | Si « Trinity » est dans une main ou un cimetière, elle débarque sur votre terrain. | À l'arrivée : si « Trinity » est dans une main ou un cimetière, elle débarque sur votre terrain. | |
| Cypher — « Je veux être… quelqu'un d'important… comme un acteur. Les ignorants sont bénis » | Vos autres cartes envient Cypher et prennent exemple sur lui en copiant ses PV et son ATQ. | À l'arrivée : vos autres cartes envient Cypher et prennent exemple sur lui en copiant ses PV et son ATQ actuels. | |
| Latrell Spencer — « A Thousand Miles » | À son arrivée : les personnages adverses ne peuvent pas attaquer pendant 1 tour (ils sont sous le charme). | À l'arrivée : les personnages adverses ne peuvent pas attaquer pendant 1 tour (ils sont sous le charme). | |
| Kevin Copeland — « Couverture grillée » | Une fois par partie : retire tous les effets (bonus et malus) d'une carte. | Attaque, une fois par partie : retire tous les effets (bonus et malus) d'une carte. | |
| Brittany et Tiffany Wilson — « Héritières » | À leur arrivée : bonus de pièces +3 pour ce tour (même au-delà du plafond). | À l'arrivée : bonus de pièces +3 pour ce tour (même au-delà du plafond). | |
| Heather et Megan Vandergeld — « Langue de vipère » | Un personnage adverse perd 30 ATQ jusqu'à la fin de la partie. | Attaque : un personnage adverse perd 30 ATQ jusqu'à la fin de la partie. | |
| Le Chef Elliott Gordon — « Vous êtes virés ! » | À son arrivée : l'adversaire défausse une carte au hasard. | À l'arrivée : l'adversaire défausse une carte au hasard. | |
