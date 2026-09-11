# KONO Production Build 01 — Sanctuary Production Foundation

## Scope

This build begins the production pipeline without changing productivity features.

## Delivered

- Dedicated `FluidSystem`
- 96 phase-matched production water frames
- Separate ocean, pond, waterfall, and foam loops
- Environment-driven fluid speed
- Soft shoreline blending
- Reproducible asset manifest
- F8 World Debug Console
- Fluid enable/disable and speed controls
- Live FPS readout
- Phaser and Sanctuary code loaded through dynamic imports
- Water research, art bible, and quality checklist

## Removed

- Old procedural water textures
- Old broad animated-water crop folder
- Water animation ownership inside `Stage0Scene`

## Test

Open the Sanctuary and press `F8`, or use:

`?sanctuaryDebug=1`

Test:
- All four times of day
- Clear, cloudy, rain, breezy, and snow
- Fluid speed from 0.25× through 2.5×
- Production fluid layer toggle
- Reduced Motion
