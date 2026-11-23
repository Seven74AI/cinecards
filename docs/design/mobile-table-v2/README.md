# Phone table v2 mockups (epic 14)

Chosen direction (Root, 2026-11-23): **F**. Live canvas (owner only): https://claude.ai/artifact/GNVShiMg3iVgsHStLSjLMR
(it also keeps the options Root did not pick: A1, A2, B, C, D, E and the six hand-button options).

- `rendus/avant-390.png`, `rendus/avant-360.png`: the game before epic 14, hand of 10 cards (fan that overlaps and spills off both sides, "agrandir" zoom).
- `F-reglages.dc.html`: hand closed. No zoom; each side shows a "Terrains" row and a "Sorts" row (5 slots each, a small plate per card) plus the 2×5 character grid; both banners show initial, name, HP bar, HP, coins/cap, hand (opponent), deck and graveyard. My hand count sits on the hand button. A gear button ("Réglages") opens the "Main ouverte : Compacte | Détaillée" setting.
- `Bouton-main.dc.html`: six hand-button options; Root chose **1 · fan + badge** (gold square with three fanned cards and a red count badge; open: the fan spreads and the colours invert).
- `F-compacte.dc.html`, `F-compacte-360.dc.html`: hand open, compact view. An opaque panel without header is laid over the bottom of my side; the board itself does not move or resize. Whole card faces in one row, horizontal swipe. Tapping a card opens today's card sheet (with "Jouer").
- `F-detaillee.dc.html`, `F-detaillee-360.dc.html`: hand open, detailed view. Full cards (new layout: card frame, picture, a text box with each ability's energy icon, type tag and effect text, no movie quote, ATQ/PV) at **70 % of the screen width, at most 280 px**. The panel height is the height of the tallest card in the hand, so every card shows whole without vertical scrolling; the panel grows upward over my side, the turn banner and part of the opponent's side.

The cards and sheets in the mockups are captures of the real game (scene with 10 cards in hand). The `.dc.html`
files are design-canvas sources (the `support.js` include is the canvas runtime); their `/_blob/...` images only load
on the canvas, so `rendus/` keeps a rendered PNG of each board.
