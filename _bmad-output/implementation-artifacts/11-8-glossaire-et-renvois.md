# Story 11.8: Glossaire et renvois

Status: done

## Story

As a joueur,
I want comprendre un mot-clé ou un renvoi (« voir Au galop ! ») sans quitter la partie,
So that je n'aie rien à retenir de tête.

## Acceptance Criteria

**Given** un texte de carte
**When** j'appuie sur un mot-clé, un nom de capacité ou un nom de carte cité
**Then** sa définition s'affiche, ou la carte citée s'ouvre
**And** les textes viennent de `_bmad-output/planning-artifacts/glossaire-mots-cles.md` (validé par Root) ; « Attaque : … » devient « Attaque spéciale : … » dans les cartes, et « Barrage » est un mot-clé
**And** un écran « Règles et mots-clés » est accessible depuis le menu, généré depuis une seule source dans le code

## Tasks / Subtasks

- [x] Source unique : `apps/client/src/game/glossary.ts` importe le .md au build (`?raw` de Vite) et en tire sections et définitions ; un test vérifie que chaque mot-clé détecté existe dans le .md.
- [x] Détection dans les textes (`game/richtext.ts`, pur et testé) : mots-clés (formes fléchies : « réduit au silence », « GUÉRIT », « la hâte »…), renvois « … » vers une carte (nom exact, sans article, avant « a.k.a », ou contenu unique) ou une capacité (nom exact).
- [x] UI : `RichText` (mot-clé → bulle de définition ; renvoi → ouvre la carte), étiquette de déclencheur cliquable, `CardInfo` (fiche d'une carte du catalogue, capacité mise en évidence), écran « Règles et mots-clés » (accueil + barre du haut de la table), collection de l'accueil cliquable.
- [x] Cartes : « Attaque : / Attaque, » → « Attaque spéciale : / , » dans `content/sets` ; `cards.test.ts` ; message `TARGET_PROTECTED` qui nomme le Barrage.
- [x] e2e : écran des règles, bulle d'un mot-clé, renvoi « Au galop ! » qui ouvre Arthur.
- [x] `a-valider-par-root.md` : textes changés et choix faits.

## Dev Notes

- Pas de changement de protocole : textes et glossaire sont empaquetés dans le client ; le serveur ne lit pas les textes.
- Le .md est hors de `apps/client` mais dans le dépôt (comme `content/sets`, déjà importé par `import.meta.glob`) : la CI Pages fait un `checkout` complet.
- Les sections sans tableau (« Renvois entre cartes », « Décisions de Root ») ne sont pas des mots-clés ; la première est résumée sur l'écran des règles.

### References

- glossaire-mots-cles.md ; story 11.7 (`game/labels.ts`, `CardSheet.tsx`) ; GDD « Mots-clés et déclenchements ».

## Dev Agent Record

### Completion Notes List

- `game/glossary.ts` : `import …glossaire-mots-cles.md?raw` (Vite) + `parseGlossary` ; `definition(term)` ; note « Renvois entre cartes » reprise sur l'écran des règles.
- `game/richtext.ts` : `KEYWORD_FORMS` (terme du .md → formes dans les textes), `resolveReference`, `segmentText` ; tests (`richtext.test.ts`) : chaque terme détecté existe dans le .md, formes fléchies, « Au galop ! » → Arthur, « Trinity », « Sentinelles ».
- `ui/Refs.tsx` : `RefProvider` (monté dans `main.tsx`), `AbilityText` (étiquette et mots-clés → bulle ; renvois → fiche), `CardInfo` (capacité citée mise en évidence), `RulesScreen`. Fiche de jeu, collection de l'accueil et barre du haut branchées.
- Captures vérifiées (390 px) : bulle « hâte », Arthur ouvert depuis Patsy, Néo → « Trinity », écran des règles.
- `pnpm typecheck` OK, `pnpm test` 118/118 (simulation 200 parties incluse), `PW_CHANNEL=chromium pnpm e2e -- --trace off` 9/9 dont `glossary.spec.ts` (2026-11-22).

### File List

- apps/client/src/game/glossary.ts, richtext.ts, richtext.test.ts
- apps/client/src/ui/Refs.tsx, CardSheet.tsx, Home.tsx, Table.tsx, Icon.tsx
- apps/client/src/main.tsx, i18n/fr.ts, styles.css
- content/sets/holy-grail.json, hot-shots.json, matrix.json, white-chicks.json
- packages/engine/src/cards.test.ts
- e2e/glossary.spec.ts
- _bmad-output/implementation-artifacts/a-valider-par-root.md, sprint-status.yaml

## Change Log

- 2026-11-22 — Glossaire depuis le .md de Root, bulles, renvois entre cartes, écran « Règles et mots-clés » (mode autonome).
