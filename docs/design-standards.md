# KONO design standards

Preserve the existing Coral Floral, Sakura and Professional themes. Use their CSS variables for surfaces, ink, accents and borders. Do not replace the Sanctuary's native colour grades with a blanket saturation or darkness overlay.

## Sanctuary artwork

- Canonical map registration: 1448 × 1086. All phase variants must share terrain anchors and silhouettes.
- Terrace source: terrace-22.8.7, stage 0–5 in morning/afternoon/evening/night. Registered home, tree and other art remain in registered-22.8.6.
- Never solve an edge problem by enlarging the full scene crop, drawing a coloured ground rectangle, or stacking an older stage underneath.
- Keep clean alpha/terrain boundaries, consistent pixel density, the original bright daytime palette, evening lights and naturally shaded night assets.
- Mascot foot anchors and routes stay tied to the canonical map; visible height is 6.4% of map height within existing responsive bounds. Night remains shaded sleep.

## Interface

- Primary task actions stay above the artwork. Decorative progress never hides assignments.
- Labels are explicit; status words reflect real saves. Errors offer recovery, not automatic demo resets.
- Keep keyboard focus visible and provide equivalent DOM actions for the canvas. Do not require a fast response to accessible fishing.
- One ambient audio owner; no misleading duplicate track names. Music begins on user interaction.
- Respect device motion settings. Do not animate every piece of text or announce timer ticks.
- Keep destructive and account actions visually separate from ordinary study actions.

For a future Figma connection, create components for task rows, note/exam cards, form fields, save states, dialogs and desktop/mobile shells. Compare against actual browser screenshots; Figma does not fix raster transparency automatically.
