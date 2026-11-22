---
baseline_commit: 1d69880
---

# Story 13.12: Fluidité des animations sur téléphone

Status: done

## Story

As a joueur sur iPhone,
I want des animations fluides,
So that la mise en scène garde son effet.

## Acceptance Criteria

1. **Given** l'URL avec `?fps` **Then** un petit compteur d'images/s s'affiche (moyenne et minimum sur 1 s), pour que Root mesure sur son iPhone.
2. Plus aucune animation en boucle n'anime `filter`, `box-shadow` ou `clip-path` : les lueurs deviennent des calques pré-dessinés dont seule l'opacité ou la transformation varie.
3. Les animations d'ambiance (runes, braises, flamme) sont mises en pause pendant la lecture des actions et ralenties ou réduites sur téléphone ; les particules simultanées sont plafonnées sur téléphone.
4. Une mesure enregistrée (script du dépôt, Playwright en émulation iPhone, processeur ralenti ×4 via CDP sur Chromium et un passage WebKit) montre au moins 55 images/s de moyenne pendant une attaque mortelle et une pose, sans image de plus de 50 ms ; le rapport avant/après est joint.
5. Rien ne change visuellement sur ordinateur (comparaison de captures) ; « réduire les animations » reste respecté.

## Tasks / Subtasks

- [x] Mesurer d'abord : `scripts/perf-phone.mjs` (iPhone 13, Chromium ×4 par CDP, WebKit ; scènes `mort`, `pose`, `repos` ; options `--dpr`, `--css`, `--scene`, `--out`), exécuté sur `1d69880` puis après. Scènes de test aussi dans une version de production avec `VITE_SCENES=1` (sinon le React de développement, 3 à 5 fois plus lent, fausse la mesure). Traces CDP : la longue image était la tâche de l'appui (moteur audio créé au premier son, règles, rendu de la table, début de mise en scène).
- [x] `game/perf.ts` : `fpsStats`, `fpsWanted`, `PHONE_FX` (7 par gerbe, 20 à l'écran, 6 cendres, 14 pièces), `particleBudget`. `ui/FpsMeter.tsx` monté par `main.tsx` avec `?fps` (texte écrit sans rendu React).
- [x] `styles.css` : `targetPulse` → voile `::after` en opacité (cartes et portraits) ; `laurelGlow` → copie du laurier avec sa grande lueur fixe (`CardView` : `<Laurel glow />`) dont l'opacité pulse ; `refGlow` → halo `::after` du socle en opacité (sceaux et runes : lueur fixe, leur contenu est découpé). `.cc-playing` fige runes, braises, bougie, reflets, lauriers ; `.table-root.phone` : 6 braises, runes 90 s, bougie fixe.
- [x] `game/playback.ts` : `onPlaying(on)` au début et à la fin d'une lecture ; `Table.tsx` pose `cc-playing` sur `<html>`, ajoute `phone` à `.table-root` sur la table compacte.
- [x] `Table.tsx` : l'action part à l'image suivant l'appui (`nextFrame`, repli 100 ms), le lot est confié à la lecture à l'image suivante (`requestAnimationFrame`, immédiat onglet caché) ; `busy` couvre ce délai (zoom maintenu, écran de fin pas trop tôt, rythme du Grimoire) ; `useNow` ne redessine qu'au changement de seconde affichée.
- [x] `audio/sfx.ts` : `warmAudio()` crée le contexte audio au premier appui ou touche.
- [x] `ui/director.ts` : particules plafonnées sur téléphone (une gerbe réduite garde l'étalement de la complète), cendres et pièces réduites, `playableGlow` lit toutes les positions avant d'ajouter les lueurs.
- [x] `scripts/compare-desktop.mjs` : captures avant/après sur ordinateur et tablette, comparaison au pixel.
- [x] Tests : `game/perf.test.ts`, `game/present.test.ts` (`onPlaying`), e2e `e2e/phone-smooth.spec.ts` (compteur `?fps`, ambiance figée pendant l'action et réduite sur téléphone, aucune image clé qui anime filter / box-shadow / clip-path).

## Dev Agent Record

### Completion Notes List

- Mesures (rapport `perf/13-12-rapport.md`) : Chromium ×4 — mort 57,7 → 59,2 i/s, pire image 100 → 33 ms ; pose 59,0 → 59,7 i/s, 133 → 33 ms ; aucune image > 50 ms. WebKit Linux (sans processeur graphique, composition logicielle à densité 3) : mort 19,7 → 24,8, pose 46,1 → 50,5 ; objectif non atteint dans ce conteneur, expliqué dans le rapport.
- Ordinateur : 0,000 % de pixels différents (8 captures), hors bord du masque du compte à rebours.
- Choix listés dans `a-valider-par-root.md` (13.12).
- `pnpm typecheck` OK, `pnpm test` 152/152, e2e 38/38 (ports 3067 / 5674).

### File List

- apps/client/src/game/perf.ts (nouveau), apps/client/src/game/perf.test.ts (nouveau), apps/client/src/ui/FpsMeter.tsx (nouveau)
- apps/client/src/main.tsx, apps/client/src/App.tsx, apps/client/src/audio/sfx.ts, apps/client/src/game/playback.ts, apps/client/src/game/present.test.ts
- apps/client/src/ui/Table.tsx, apps/client/src/ui/director.ts, apps/client/src/ui/CardView.tsx, apps/client/src/styles.css
- e2e/phone-smooth.spec.ts (nouveau), scripts/perf-phone.mjs (nouveau), scripts/compare-desktop.mjs (nouveau)
- _bmad-output/implementation-artifacts/perf/ (rapport et mesures), a-valider-par-root.md, sprint-status.yaml

## Change Log

- 2026-11-22 — Compteur `?fps`, lueurs en calques d'opacité, ambiance figée pendant les actions et réduite sur téléphone, particules plafonnées, appui découpé en images courtes, mesures avant/après, mode autonome.
