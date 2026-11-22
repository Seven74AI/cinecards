# Mobile table layout mockups (story 13.2)

Chosen direction (Root, 2026-11-22): **B · overview + zoom**.
- `B-ensemble.dc.html`: overview. Both sides as compact 2×5 grids with all 10 slots visible (empty slots as dashed runes), a thin terrain/spell strip per side, the turn banner between them, and a large hand fanned over the bottom edge. No vertical scroll at 390 × 844.
- `B-zoom.dc.html`: zoom. Tapping a side, or picking an attacker or a target prompt, enlarges that side. The other side folds into a strip of mini cards with the selected card raised, an instruction bar ("Topper attaque : choisissez une cible", timer, Annuler), and a "Vue d'ensemble" back button.
- `Main.dc.html` and `A-petit.dc.html`: option A (compact rows), not chosen; kept for reference.

These are design-canvas sources (HTML + inline CSS), not app code: open them in a browser to view
(ignore the `support.js` include). Live canvas (owner only): https://claude.ai/artifact/Vs5CPVRJM1RXWLAfPuPhjg
