# KONO Study Sanctuary

KONO is a cozy student planner built with React, TypeScript, Vite, and Phaser.

## Current release

**Production Build 20.8 — Final Home Evolution Integration Lock**

- Home stages 0–4 preserve the clean Build 20.7.1 progression.
- Stage 5 is replaced by the approved grand sanctuary-home pixel PNG, roughly 29% wider than Stage 4.
- Stage 5 uses four phase-specific PNG treatments with warm dusk/night window lighting.
- Home transparency remains isolated: no embedded grass, sky, path, or rectangular scene cutouts.
- Tree placement, pixel pond/koi, global phase lighting, garden/critter systems, and no-bamboo state are preserved.

## Run locally

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

## Sanctuary debug mode

Open the app with:

```text
?sanctuaryDebug=1
```

This reveals the development-only time, weather, and ambient-density controls.

## Key architecture

```text
src/game/sanctuary/
  config.ts
  runtime.ts
  timeEngine.ts
  types.ts

src/game/scenes/
  Stage0Scene.ts

src/components/
  GardenCard.tsx
```

See `LIVING-SANCTUARY-v0.95.md` for the world-layer and transition rules.


## Build 20.5 placement lock

- Cherry-tree anchor moved to source X 704, matching the user-marked center of the full upper platform.
- Vertical placement, scale, phase lighting, and all other Sanctuary systems remain unchanged.
- Tree click area and evolution accent follow the new center.
- Tree origin is calculated from the 650 px source texture, preventing registration drift.
