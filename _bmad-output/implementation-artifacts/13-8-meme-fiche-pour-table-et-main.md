---
baseline_commit: 29e1a88
---

# Story 13.8: Même fiche pour une carte de la table et une carte de la main

Status: done

## Story

As a joueur,
I want qu'appuyer sur une carte de la table ouvre la même fiche qu'une carte de ma main,
So that la lecture soit cohérente.

**Constat :** sur téléphone, une carte de la table modifiée ouvrait une fiche abaissée (`.sheet.peek`, hauteur `--peek-h`, poignée « Agrandir la fiche ») qui couvrait la zone de la main (stories 13.3 et 13.6). Une carte de la main ouvre la fiche complète.

## Acceptance Criteria

**Given** une carte de la table (alliée ou adverse)
**When** je l'ouvre
**Then** la fiche a la même taille et la même disposition que pour une carte de la main
**And** les actions propres à la table (Attaquer, Utiliser, Choisir une cible) restent dans la fiche.

## Tasks / Subtasks

- [x] `CardSheet.tsx` : prop `peek`, état `expanded` et poignée supprimés ; une seule fiche pour tout.
- [x] `Table.tsx` : plus de `peek={...}` ni de calcul de `--peek-h`.
- [x] `styles.css` : règles `.sheet.peek` et `.sheet-grip` supprimées.
- [x] e2e `sources.spec.ts` : la fiche d'une carte de la table n'est pas abaissée (plus de 60 % de la hauteur à 390 × 844) et garde « Choisir une cible ».
- [x] Captures 390 px : main, carte alliée modifiée, carte adverse ; ordinateur (fiche à droite) inchangé.

## Dev Agent Record

### Completion Notes List

- Les actions de table ne dépendaient pas de `peek` : « Utiliser » (capacités), « Choisir une cible » (mode attaque) restent dans la fiche.
- Les traits d'origine restent dessinés à l'ouverture dans cette story (sous la fiche) ; la story 13.9 les rend « à la demande ».
- `pnpm typecheck` OK, `pnpm test` 139/139, e2e 32/32 (ports 2867 / 5474).

### File List

- apps/client/src/ui/CardSheet.tsx, apps/client/src/ui/Table.tsx, apps/client/src/styles.css
- e2e/sources.spec.ts
- _bmad-output/implementation-artifacts/a-valider-par-root.md, sprint-status.yaml

## Change Log

- 2026-11-22 — Fiche complète pour les cartes de la table sur téléphone (mode autonome).
