Status: done

# Story 14.6: Finitions de la table téléphone

## Story
As a joueur sur téléphone, I want lire chaque valeur et chaque nom, et voir la carte que je viens de piocher,
So that rien ne soit caché sur un petit écran.

**Constat (fin de l'epic 14, 2026-11-24) :** sur un téléphone de 360 px, les pastilles du nombre de sources de bonus
couvrent la valeur d'ATQ des cartes de la table ; les noms longs des terrains et des sorts sont coupés (« Le porte… »,
« Fuyez ! F… ») ; une carte piochée main ouverte arrive en fin de rangée, souvent hors de l'écran.

## Acceptance Criteria
1. Sur la table compacte (portrait, moins de 700 px de large), de 360 × 640 à 430 × 932 : la pastille du nombre de
   sources ne couvre jamais la valeur d'ATQ ni de PV ; elle reste lisible et touchable (13.9 : toucher une pastille
   modifiée montre les lignes des sources).
2. Le nom d'un terrain ou d'un sort tient sur sa plaque (deux lignes au besoin), en 10 px (jamais sous 9 px) ; s'il reste
   trop long, il finit par « … » ; le nom complet reste dans la fiche et dans le libellé de la plaque.
3. Quand une carte arrive dans la main ouverte (pioche, retour en main), la rangée défile jusqu'à elle (en douceur sauf
   « réduire les animations »), en vue compacte comme détaillée ; pas à l'ouverture de la main, ni quand les cartes
   changent seulement d'ordre (tri de 14.5). L'animation de pioche vise la carte après le défilement.
4. Toujours sans défilement vertical (encarts de sécurité simulés 47 / 34 px) ; ordinateur, tablette et paysage inchangés.

## Tasks / Subtasks
- [x] Mesure avant correction (360 × 640, `?scene=sources` et `?scene=pleine`) : la pastille de PV recouvrait la valeur
      d'ATQ (les `.badge` des cartes prenaient la taille de la pastille de la liste d'amis, `friends.css`, 12 px / 20 px
      de haut), et la pastille de sources du PV touchait le chiffre des PV.
- [x] `styles/mobile-table.css` : sur la table compacte, pastilles d'ATQ / PV en `clamp(9px, 0.16 × --cw, 12px)`, marges
      réduites ; épée et cœur masqués sur les cartes de moins de 56 px ; pastille de sources au-dessus du coin extérieur
      de sa pastille (`bottom: calc(100% + 3px)`).
- [x] `styles/mobile-table.css` : noms des plaques sur deux lignes partout (`-webkit-line-clamp: 2`, interligne 1,1),
      icône 8 px, marges resserrées, écart entre plaques 4 px (zone touchable ajustée).
- [x] `ui/handScroll.ts` (nouveau) : `revealInRow(card)` fait défiler la rangée de la main ouverte juste assez pour
      montrer la carte entière (sur un début de carte, la rangée s'aimante), garde la cible pendant le défilement doux
      et renvoie le décalage restant.
- [x] `ui/Table.tsx` (`HandPanel`) : retient les cartes déjà vues ; une carte nouvelle (la dernière arrivée) appelle
      `revealInRow` ; rien à l'ouverture, au tri ni au départ d'une carte.
- [x] `ui/director.ts` (`drawn`) : appelle `revealInRow` sur la carte puis vise sa position d'arrivée (mesure + décalage).
- [x] `styles/mobile-table.css` : marge de fin de rangée `max(40px, 12cqw + 6px)` pour que la dernière carte sorte
      entièrement du bord estompé (12 %).
- [x] `game/devscene.ts` : scène `?scene=pioche` (9 cartes en main, Le Grimoire sans main, graine du bot fixée) ;
      `fillHand` partagé avec `pleine`.
- [x] e2e `phone-finish.spec.ts` : pastilles à 360 × 640, 390 × 844, 430 × 932 (pas de chevauchement avec les chiffres,
      ni entre ATQ et PV, 9 px au moins, lignes des sources au toucher) ; noms des plaques en 2 lignes au plus, dans la
      plaque, sans défilement vertical ; carte piochée visible dans la rangée (vues compacte et détaillée), rangée non
      défilée à l'ouverture.

## Dev Agent Record
### Completion Notes List
- `scripts/compare-desktop.mjs` (avant = `origin/main` 139aca2, après = cette story) : 0,000 % de pixels différents sur
  les 8 états (ordinateur 1440 × 900 et tablette 1024 × 768). Le paysage n'utilise pas la table compacte (règles sous
  `.compact`, défilement limité à `.hand-row` de la main ouverte).
- Captures 360 × 640, 390 × 844 et 430 × 932, avant / après, dans le dossier temporaire de la session (`shots146/`).
- Hors périmètre, à traiter plus tard : la règle `.badge` de `friends.css` (pastille rouge des demandes d'amis) n'est pas
  limitée à la liste d'amis et s'applique aux pastilles d'ATQ / PV des cartes partout (ordinateur compris). Corrigée ici
  seulement sur la table téléphone, l'ordinateur ne devant pas changer.
- `pnpm typecheck` OK, `pnpm test` 320/320, e2e 77/77 (ports 3267 / 5874). `turn-rhythm`
  (« Tour adverse ») a échoué dans 2 suites complètes sur 3 : le bot de la scène `mort` n'a pas de graine ; quand il
  joue Tank, mes cartes repartent en main et aucune ne s'allume. Indépendant de cette story (réussi seul et dans la
  3ᵉ suite) ; à fixer avec une graine dans `BOT_SEEDS`. Pas de moteur ni de cartes touchés.
### File List
- apps/client/src/ui/handScroll.ts (nouveau), apps/client/src/ui/Table.tsx, apps/client/src/ui/director.ts
- apps/client/src/styles/mobile-table.css, apps/client/src/game/devscene.ts
- e2e/phone-finish.spec.ts (nouveau)
- _bmad-output/implementation-artifacts/sprint-status.yaml, a-valider-par-root.md, 14-6-finitions-de-la-table-telephone.md
## Change Log
- 2026-11-24 — Finitions de la table téléphone : chiffres d'ATQ / PV jamais couverts, noms des plaques sur deux lignes,
  la main ouverte défile jusqu'à la carte qui arrive.
