---
baseline_commit: 232e39304f41500b7f26325457c2a0f2adf28b5b
---

# Story 12.2: Attaques et impacts

Status: done

## Story

As a joueur,
I want voir l'attaquant foncer sur sa cible,
So that une attaque se voie et se sente.

## Acceptance Criteria

**Given** une attaque
**When** elle se joue
**Then** l'attaquant se soulève, fonce, percute (éclair, tremblement proportionnel aux dégâts) et revient
**And** la riposte est visible
**And** l'attaque sur les PV du joueur vise son portrait
**And** une attaque spéciale lance un trait vers la cible, sans contact.

## Tasks / Subtasks

- [x] `ui/director.ts` : mise en scène des temps (appelée par `Playback.onCue`), séparée de `Table.tsx`.
- [x] Attaque (`attackDeclared`) : élan 220 ms (soulèvement ×1,12), charge 170 ms (`cubic-bezier(.6,0,.9,.5)`, s'arrête juste avant la cible), retour 380 ms ; l'impact tombe sur le temps de dégâts suivant (démo).
- [x] Impact (`damageDealt` > 0) : éclat (étoile SVG) au centre de la cible, recul de la cible, tremblement de la table d'amplitude min(10, 2 + dégâts/25) px pendant 320 ms.
- [x] Riposte : dégâts de la cible sur l'attaquant pendant la même attaque → même impact, plus petit (×0,7), recul composé avec le retour.
- [x] Attaque sur le joueur : la charge vise le portrait (`data-hero`), qui tremble.
- [x] Attaque spéciale / réaction (`abilityUsed` déclencheur `attack` ou `reaction`) : la source s'illumine, un trait (520 ms) part vers chaque cible des effets qui suivent, sans contact ; temps de 600 ms.
- [x] Le tout en `transform`/`opacity` (WAAPI), fondus seuls avec « réduire les animations », accéléré ou sauté selon la vitesse ; e2e : l'attaquant quitte son socle pendant la charge puis revient ; captures 390 px.

## Dev Notes

- S'appuie sur la couche de présentation 12.1 (`game/playback.ts`, `game/present.ts`, `ui/anim.ts`). Les cibles d'une attaque spéciale sont lues dans les événements suivants du lot (`damageDealt`, `statusApplied`, `modified`, `healed`) jusqu'au prochain `abilityUsed` / `attackDeclared`.
- Pas de changement de moteur ni de protocole.

### References

- docs/design/animations/demo.html (`lunge`, `splat`, `shake`, `beam`) ; retours-visuels-actions.md (lignes Attaque, Riposte, Attaque spéciale, Attaque sur les PV du joueur).

## Dev Agent Record

### Completion Notes List

- `ui/director.ts` (`direct(cue)`, appelé par `Playback.onCue`) : `lunge` (élan + charge en une animation à deux segments, arrêt juste avant la cible — à 22 % de la distance ou à 45 % de la hauteur de la cible, pour que les cartes se touchent sur la grande table du téléphone —, puis retour 380 ms), `splat` (étoile SVG, taille selon les dégâts et la largeur des cartes), `recoil` (propriétés `translate`/`rotate` en `composite: add`, compatibles avec le retour de l'attaquant), `shake` (`.table`, min(10, 2 + dégâts/25) px, 320 ms), `glow` + `beam` pour une attaque spéciale ou une réaction (cibles lues dans les événements suivants du lot).
- Riposte : dégâts du défenseur sur l'attaquant pendant l'attaque en cours → impact ×0,7 et tremblement réduit.
- Attaque sur le joueur : charge vers l'avatar du portrait (`data-hero`), le portrait recule et la table tremble.
- `game/fx.ts` : temps `special` 600 ms pour `abilityUsed` (attaque spéciale, réaction). `game/playback.ts` : l'accélération ne touche que les lots déjà en file quand le joueur agit (le lot de son action se joue à vitesse normale) ; `Cue.events`.
- Scènes dev `?scene=joueur` et `?scene=speciale`.
- Tests : `present.test.ts` (+1 : accélération limitée aux lots en file) ; e2e `beats.spec.ts` (+1 : l'attaquant monte de plus de 150 px vers le portrait puis revient dans son socle, la table tremble).
- `pnpm typecheck` OK, `pnpm test` 125/125, `PW_CHANNEL=chromium pnpm e2e -- --trace off` 12/12 (2026-11-22). Captures 390 px vérifiées (contact Topper → Ni avec éclat, charge sur le portrait avec « −150 », trait du « Ni ! » vers Lancelot).

### File List

- apps/client/src/ui/director.ts, Table.tsx
- apps/client/src/game/fx.ts, playback.ts, devscene.ts, present.test.ts
- apps/client/src/styles.css
- e2e/beats.spec.ts
- _bmad-output/implementation-artifacts/a-valider-par-root.md, sprint-status.yaml

## Change Log

- 2026-11-22 — Attaques mises en scène (élan, charge, impact, riposte, tremblement), attaque sur le portrait, trait de l'attaque spéciale (mode autonome).
