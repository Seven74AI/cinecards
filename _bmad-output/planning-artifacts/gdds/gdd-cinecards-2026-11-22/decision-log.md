# Decision log — GDD CineCards

- 2026-11-22 — GDD créé (intent : create). Entrées : game brief final, addendum, brainstorm, sets JSON, image des cartes Matrix.
- 2026-11-22 — Type de jeu proposé : card-game (complexité moyenne : équilibrage du pool, rareté, règles de pioche, anti-boucles infinies, prise en main).
- 2026-11-22 — Mode de travail : autonome (« travaille en solo, je te fais confiance »). Brouillon complet rédigé par Claude avec [ASSUMPTION] et [NOTE FOR DESIGNER].
- 2026-11-22 — Set Matrix transcrit depuis l'image : content/sets/matrix.json (18 cartes). Découverte : 4 éléments de puissance (éclair, étoile, poing rouge, œil violet) et non 3 ; Smith coûte 13 et non 10.
- 2026-11-22 — Sets créés alignés sur les icônes papier (flamme → poing).
- 2026-11-22 — gdd.md et epics.md rédigés. 4 points à trancher par Root (dont 1 bloquant : coûts > stock max), 20 hypothèses indexées.
- 2026-11-22 — Règle (Root) : le plafond de stock (10) peut être augmenté par certaines cartes, et d'autres donnent un bonus de pièces pour un tour. Ajout des mots-clés Bonus de pièces / Plafond de stock. Héritières → bonus +3 ; Les Hamptons → plafond +3, pour rendre Smith et Ça pisse jouables au MVP.
- 2026-11-22 — Root : le jeu papier a 2 modes (pioche partagée / un deck par joueur). « VOTRE deck » et « deck ADVERSE » viennent du mode decks séparés ; en mode partagé, ils désignent le deck commun. Décision MVP en attente de la recommandation de Claude.
- 2026-11-22 — Modes de deck : MVP = pioche partagée + decks personnels aléatoires (deck commun coupé en deux). Decks construits = epic E8 post-MVP. Moteur : une pioche par joueur dès le départ.
- 2026-11-22 — Root suit les recommandations de Claude :
  - Capacités actives : une fois par carte posée (redevient disponible si la carte est rejouée) ; mention explicite prioritaire ; attaque normale à chaque tour.
  - Fenêtre de réaction : ouverte seulement si une réaction est possible (rapidité > bluff).
  - Les 20 hypothèses du brouillon sont acceptées en l'état.
- 2026-11-22 — Finalisation : audit du journal (toutes les décisions intégrées à gdd.md ou epics.md), réconciliation avec le brief (vision, piliers, plateforme, MVP, direction artistique, hors périmètre : conformes), passe de discipline (pas de fuite d'implémentation, index des hypothèses à jour). GDD en statut final. Pas de design narratif requis (type card-game). Étape suivante : gds-game-architecture.
- 2026-11-22 — Playtest 1 de Root → workflow gds-correct-course (`sprint-change-proposal-2026-11-22.md`, approuvé). Capacités révisées : effets déclenchés par défaut (à l'arrivée, quand une carte est posée…), capacités d'attaque à la place de l'attaque, effets répétables modestes ; « choisissez N » = jusqu'à N (0 possible) ; solo contre le Grimoire au MVP ; chrono 75 s dans tous les modes ; « Quitter » ≠ abandon. Nouvel epic 11, prioritaire sur 8, 9, 10.
- 2026-11-22 — Cadres (story 11.7) : direction D + E + F retenue (jeton de coût = catégorie, gemme et ornements = rareté) ; toutes les catégories ont une rareté ; étiquettes « Effet » et « Attaque spéciale » ; règle de protection nommée « Barrage » ; pas de modèles 3D (Meshy écarté).
