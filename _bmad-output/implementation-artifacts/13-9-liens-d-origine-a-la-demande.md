---
baseline_commit: 1986447
---

# Story 13.9: Liens d'origine seulement à la demande

Status: done

## Story

As a joueur,
I want voir les traits vers les sources d'un bonus ou d'un malus seulement quand je les demande,
So that la table reste lisible.

## Acceptance Criteria

**Given** une carte modifiée
**When** j'ouvre sa fiche
**Then** aucun trait n'est dessiné
**And** quand j'appuie sur l'écusson modifié (ATQ ou PV) ou sur une ligne de « Bonus et malus », la fiche se range et les traits vers les sources concernées s'affichent environ 3 s (ou jusqu'au prochain appui)
**And** le marqueur de nombre de sources sur l'écusson reste.

## Tasks / Subtasks

- [x] `CardView.tsx` : un écusson modifié porte `has-src` et `data-stat` ; `styles.css` le rend touchable (`pointer-events: auto` dans la rangée de stats, zone élargie de 4 px).
- [x] `Table.tsx` : état `lines` (cible, traits, fiche rangée ou non) et `showLines` (sources en jeu filtrées : une statistique pour un écusson, une source pour une ligne) ; plus de traits liés à `inspect`. `tapCard(iid, stat)` : un écusson modifié montre ses traits (sauf pendant un choix de cible ; l'appui ouvre la fiche s'il n'y a rien à dessiner). Fin des traits au bout de 3 s ou au prochain appui (`pointerdown`) ; si la fiche était rangée, ce clic est absorbé et la fiche revient.
- [x] `CardSheet.tsx` : props `tucked` (classe `.tucked` : la fiche glisse vers le bas, sans fond ni clic) et `onShowSource` ; une ligne dont la source est en jeu montre son trait, sinon l'aperçu (13.1).
- [x] e2e `sources.spec.ts` réécrit : écusson ATQ → 2 traits (Arthur, Heather et Megan), écusson PV → 1 (Camelot), disparition seule en ~3 s, fiche sans trait, ligne → fiche rangée + 1 trait, appui suivant → fiche de retour, source partie → aperçu, attaque inchangée.
- [x] Captures 390 px et ordinateur.

## Dev Agent Record

### Completion Notes List

- Choix autonomes listés dans `a-valider-par-root.md` (13.9).
- `pnpm typecheck` OK, `pnpm test` 139/139, e2e 32/32 (ports 2867 / 5474).

### File List

- apps/client/src/ui/CardView.tsx, apps/client/src/ui/CardSheet.tsx, apps/client/src/ui/Table.tsx, apps/client/src/styles.css
- e2e/sources.spec.ts
- _bmad-output/implementation-artifacts/a-valider-par-root.md, sprint-status.yaml

## Change Log

- 2026-11-22 — Traits d'origine à la demande (écusson, ligne de « Bonus et malus »), mode autonome.
