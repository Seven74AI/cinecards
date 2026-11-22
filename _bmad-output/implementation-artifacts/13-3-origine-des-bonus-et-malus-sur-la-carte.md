---
baseline_commit: d54e733
---

# Story 13.3: Origine des bonus et malus sur la carte

Status: done

## Story

As a joueur,
I want savoir quelle carte donne un bonus ou un malus,
So that je sache quoi cibler pour l'enlever.

## Acceptance Criteria

**Given** une carte modifiée (aura, terrain, bonus temporaire ou permanent, malus)
**When** je regarde la carte sur la table
**Then** un petit marqueur sur l'écusson modifié indique qu'il y a une origine à voir (nombre de sources)
**And** quand je touche la carte, chaque source en jeu est reliée à elle par un trait lumineux, vert pour un bonus et rouge pour un malus
**And** la fiche liste chaque modificateur avec la miniature et le nom de la carte source, le nom de la capacité, la valeur et la durée restante ; toucher une source ouvre son aperçu (story 13.1)
**And** une source qui n'est plus en jeu (bonus permanent) est indiquée « carte partie ».

## Tasks / Subtasks

- [x] Moteur : `StatSource` expose `turnsLeft?` (modificateur temporaire) et `aura?: true` (aura recalculée, terrains compris). Champs optionnels, calculés côté client : aucun changement de protocole ni d'état.
- [x] `game/modifiers.ts` : `modifierLines` (carte source, capacité, valeur, bonus/malus, en jeu ou partie, soi-même, durée en français), `sourceCounts`, `durationFr`.
- [x] `CardView` : sur la table, petit nombre doré sur l'écusson ATQ / PV modifié (nombre de sources).
- [x] `Table.tsx` + `ui/SourceLines.tsx` : quand la fiche d'un personnage en jeu est ouverte (sélection existante, mode attaque compris), un trait lumineux animé relie chaque source en jeu à la carte ; positions suivies à chaque image (couche de présentation de l'epic 12), jamais de capture des taps. Sur téléphone, la fiche s'ouvre abaissée (34 dvh, fond transparent, poignée « Agrandir la fiche ») pour laisser voir les traits.
- [x] `CardSheet` : section « Bonus et malus » (miniature, nom de la source, « capacité », valeur, durée, « carte partie ») ; toucher une ligne ouvre l'aperçu de la source (13.1) avec sa capacité en surbrillance et son socle illuminé.
- [x] Tests unitaires (moteur : durée et aura de terrain ; client : `modifiers.test.ts`), e2e `sources.spec.ts`, captures 390 px.

## Dev Notes

- Existant : `computeStats` (query.ts) ajoute les auras (`auraModifiers`, terrains compris) aux modificateurs stockés ; `CardSheet` n'affichait que le libellé. `Modifier.turnsLeft` est décompté à la fin des tours du propriétaire de la carte modifiée.
- À préserver : choix d'attaque et de cibles (`mode`), metteur en scène (`director.ts` cible `.badge.atk/.hp`), docked sur grand écran.
- Scène dev `?scene=sources`.

### References

- `_bmad-output/planning-artifacts/epics.md` — Epic 13, story 13.3 ; story 13.1 (aperçu).

## Dev Agent Record

### Completion Notes List

- `packages/engine/src/state/compute-stats.ts` : `StatSource.turnsLeft?`, `StatSource.aura?`.
- `apps/client/src/game/modifiers.ts` (nouveau) ; `CardView` (marqueur `.src-n`, côté extérieur de chaque écusson) ; `ui/SourceLines.tsx` (nouveau, SVG fixe sous la fiche, z-index 29) ; `Table.tsx` (liens calculés sur `state`, positions lues sur la table affichée ; `data-iid` sur les terrains et sorts ; fiche remontée par carte) ; `CardSheet.tsx` (section « Bonus et malus », mode abaissé `peek` avec poignée).
- Durées : « tant qu'elle est en jeu » (aura), « encore N tour(s) », « permanent ». Une carte qui se modifie elle-même (aura d'Arthur, compteur de Topper) est listée « (elle-même) », sans trait.
- Tests : moteur +2 (durée, aura de Camelot), client `modifiers.test.ts` +4, e2e `sources.spec.ts` (marqueurs 3 et 2, 3 traits dont 1 rouge, 4 lignes dont « carte partie », aperçu de la source et socle illuminé, puis attaque normale).
- `pnpm typecheck` OK, `pnpm test` 136/136 (simulation de 200 parties comprise), `PW_CHANNEL=chromium pnpm e2e -- --trace off` 16/16. Captures 390 px et 1280 px vérifiées.

### File List

- packages/engine/src/state/compute-stats.ts, engine.test.ts, cards.test.ts
- apps/client/src/game/modifiers.ts, modifiers.test.ts, devscene.ts
- apps/client/src/ui/CardView.tsx, CardSheet.tsx, SourceLines.tsx, Table.tsx
- apps/client/src/styles.css
- e2e/sources.spec.ts
- _bmad-output/implementation-artifacts/a-valider-par-root.md, sprint-status.yaml

## Change Log

- 2026-11-22 — Marqueur de sources sur les écussons, traits lumineux vers les sources, liste détaillée des bonus et malus dans la fiche (mode autonome).
