# Design mockups

How mockups are made (AGENTS.md: mockup first, Root chooses, then build).

## Boards
Mockups are design-canvas artifacts: each option is a board, kept here as a `.dc.html` source (HTML + inline
CSS/SVG; the `support.js` include is the canvas runtime, its `/_blob/<id>` images are the canvas's uploads). Each
folder has a README with the option Root chose and the link to the live canvas:
- [`mobile-table-v2/`](mobile-table-v2/) — phone table v2, epic 14 (`rendus/` keeps a PNG of each board)
- [`animations/`](animations/) — per-action visual feedback, epic 12 (`demo.html` is the approved animated demo)
- [`card-frames/`](card-frames/) — card frames, story 11.7
- also [`mobile-table/`](mobile-table/) (epic 13) and [`deck-builder/`](deck-builder/)

## Game captures
Show the real game rather than redrawing it. Dev scenes (`?scene=<name>`, list in
`apps/client/src/game/devscene.ts`) open fixed tables on the dev client (`pnpm dev:client`), e.g. `?scene=pleine`
(full table, 10 cards in hand). For card pictures:

```bash
node scripts/capture-cards.mjs [--url http://localhost:5173] [--scene pleine] [--dpr 2] [--out test-results/captures]
```

For each card of my hand it writes `<n>-<card>-face.png` (card face of the sheet, transparent margin),
`<n>-<card>-fiche.png` (whole card sheet) and `<n>-<card>-pleine.png` (full card of the detailed hand view).
`test-results/` is git-ignored. Do not edit a dev scene just to take a capture.

## Checking boards locally before showing Root
1. Download the canvas runtime with the Artifact tool: `read` the canvas artifact with
   `path: "artifact-type/dc-runtime.js"`. Keep it outside the repository; never commit it.
2. Put the boards in a `project/` folder (scratch space) next to the images they use.
3. Serve `project/` with a tiny static server (a few lines of Node `http`) that answers `/<anything>/support.js`
   with the runtime and `/_blob/<id>` with the matching local image file; everything else is a plain file.
4. With Playwright, open each board at its frame size (viewport = the board's frame), screenshot it, and check
   `document.documentElement.scrollWidth <= innerWidth` (no horizontal overflow). Look at every screenshot.
