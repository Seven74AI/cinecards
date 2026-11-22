# Card frame mockups (story 11.7)

Chosen direction (Root, 2026-11-22): **D + E + F**.
- `Jetons.dc.html` (D): the cost token shows the category (shield, wax seal, steel hex nut, green diamond, each with its icon) plus a parchment tint.
- `Raretes.dc.html` (E): category × rarity grid; rarity read from the gem and the inner edge.
- `Ornements.dc.html` (F): extra detail per rarity on the whole card, token included.

These are design-canvas sources (HTML + inline CSS/SVG), not app code: open them in a browser
to view (the `support.js` include is the canvas runtime and can be ignored). Port the shapes,
colours and SVG ornaments into `apps/client/src/ui/CardView.tsx` and `styles.css`.
Live canvas (owner only): https://claude.ai/artifact/GxZmniNA4WjGe6h5GATwyk
