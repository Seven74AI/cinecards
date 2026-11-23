---
baseline_commit: e52c15a
---

# Story 14.4: Réglage « Main ouverte » : compacte ou détaillée

Status: done

## Story

As a joueur,
I want choisir la vue de ma main,
So that je garde celle qui me convient.

## Acceptance Criteria

**Given** la barre du haut
**Then** un bouton « Réglages » (roue dentée) ouvre un petit panneau avec « Main ouverte : Compacte | Détaillée » et une
phrase d'explication
**And** le choix est retenu sur l'appareil (comme la vitesse et le son) ; par défaut : Compacte
**And** sur ordinateur, tablette et paysage, le réglage existe mais ne change rien tant que la main n'est pas repliée

Précisions (maquette `docs/design/mobile-table-v2/F-reglages.dc.html`, rendu `rendus/F-reglages.png`) : roue dentée
après le bouton du son, cible de 44 px sur téléphone, `aria-label` « Réglages », `aria-haspopup` / `aria-expanded` ;
panneau opaque (#1a1008, liseré doré) sous la barre, à droite ; titre « Réglages », libellé « Main ouverte », contrôle
segmenté à deux options (`aria-pressed`), phrase d'explication. Fermeture : toucher dehors, Échap, toucher la roue
dentée. Une main ouverte change de vue tout de suite. La barre tient sur un 360 × 640, en solo comme en ligne.

## Tasks / Subtasks

- [x] `ui/Settings.tsx` : `SettingsButton` (roue dentée + panneau en portail, placé sous le bouton, aligné à droite,
  250 px au plus) ; fond qui avale le toucher extérieur ; Échap (rend le focus à la roue dentée) ; focus sur l'option
  choisie à l'ouverture ; `setHandView` / `subscribeHandView` (module de 14.3)
- [x] Icône `gear` (`ui/Icon.tsx`, tracé de la maquette)
- [x] `Table.tsx` : roue dentée après le son ; en ligne sur la table téléphone, la vitesse passe dans le panneau
  (`speedInSettings`, `changeSpeed`) faute de place dans la barre
- [x] `styles/settings.css` : panneau, contrôle segmenté `.seg2` (44 px), boutons de la barre téléphone sans
  rétrécissement, titre à 12 px sous 380 px de large
- [x] e2e `e2e/settings.spec.ts` (390 × 844 et 360 × 640, toucher dehors, ordinateur, barre en ligne à 360 px)
- [x] Captures (popover ouvert à 390 × 844 et 360 × 640, barre en ligne à 360 px) ; `scripts/compare-desktop.mjs`
- [x] `pnpm typecheck`, `pnpm test`, e2e complet

## Dev Notes

- Mesures avant la story (360 × 640, barre de 348 px) : solo 5 boutons + « CineCards » (85 px) ; en ligne 6 boutons +
  code (44 à 68 px pour 5 caractères, « WWWWW » au pire). Avec la roue dentée : solo 264 + 85 > 348 → titre à 12 px
  (78 px) ; en ligne 308 + 68 > 348 → la vitesse va dans le panneau (264 + 68). Les boutons ne rétrécissent plus
  (`flex: none`) : avant, ils passaient à 43,5 px et le test des cibles tactiles de `mobile-table.spec.ts` échouait.
- Le fond du panneau avale le toucher dehors : un toucher sur une carte de la main ferme le panneau sans ouvrir la fiche.
  Un toucher sur la roue dentée tombe sur ce fond et ferme aussi.
- Pas de nouvelle logique pure (le module `handView` et ses tests viennent de 14.3) : pas de test unitaire ajouté.

### References

- `_bmad-output/planning-artifacts/epics.md` → Epic 14, Story 14.4
- `docs/design/mobile-table-v2/F-reglages.dc.html`, `rendus/F-reglages.png`
- Story 14.3 (`14-3-carte-complete-et-vue-detaillee.md`) : `game/handView.ts`

## Dev Agent Record

### Agent Model Used

Agent dev (Claude Code)

### Debug Log References

- Captures (hors des dossiers suivis) : panneau ouvert à 390 × 844 et 360 × 640 (main ouverte passée en Détaillée
  derrière), barre en ligne à 360 px, panneau en ligne avec la vitesse ; conformes au rendu F-reglages.
- `scripts/compare-desktop.mjs` (e52c15a contre l'arbre de travail, serveurs vite de dev) : bureau table / cibles /
  fiche 0,151 %, tablette table / cibles 0,283 % : uniquement la barre du haut (roue dentée ajoutée, les boutons à sa
  gauche se décalent) ; accueil et fiche tablette 0 à 0,018 % (bruit de rendu, page non touchée).

### Completion Notes List

- Bouton « Réglages » et panneau « Main ouverte : Compacte | Détaillée », choix retenu (`cinecards.handView`),
  Compacte par défaut ; une main ouverte change de vue tout de suite.
- En ligne sur téléphone, la vitesse des animations se règle dans le même panneau.
- Choix par défaut listés dans `a-valider-par-root.md`.
- Dernière story de l'epic 14 : `epic-14: done`.

### File List

- apps/client/src/ui/Settings.tsx
- apps/client/src/ui/Icon.tsx
- apps/client/src/ui/Table.tsx
- apps/client/src/styles/settings.css
- apps/client/src/styles/index.css
- e2e/settings.spec.ts
- _bmad-output/implementation-artifacts/14-4-reglage-main-ouverte.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/a-valider-par-root.md

### Change Log

- 2026-11-23 : story créée puis implémentée (réglage « Main ouverte », vitesse dans le panneau en ligne sur téléphone).
- 2026-11-23 (revue) : la roue dentée n'est affichée que sur la table téléphone en portrait ; ordinateur, tablette et paysage inchangés (règle de Root). e2e « réglages on desktop » mis à jour ; e2e 65/65.
