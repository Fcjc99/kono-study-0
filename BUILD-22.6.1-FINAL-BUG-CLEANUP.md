# Build 22.6.1 — Final Bug Cleanup

This is a cleanup / production-lock pass rather than a feature pass.

## Fixes
- Removed the legacy `Stage0Scene` firefly asset pipeline so it no longer competes with the clean CritterSystem PNG sprites.
- Evening/night fireflies now come only from the individual critter PNG set.
- Cleaned remaining dark sheet/background remnants from butterfly, dragonfly, and snail sprites.
- Replaced glow-blob firefly crops with tiny clean transparent pixel-art firefly silhouettes — no rectangular/oval glow background.
- Repaired Stage 5 house coverage across morning / afternoon / evening / night by scaling the actual Stage 5 artwork 2% larger within its sprite canvas and repairing the remaining one-pixel coverage pinhole.
- Synchronized `package.json` and `src/version.ts` to `0.99.48-production-22.6.1`.

## Validation
- all individual critter PNGs use binary alpha and clean transparent RGB
- all standalone terrace phase PNGs remain 1448×1086 clean transparent assets
- Stage 5 house fully covers the approved Stage 0 house coverage mask in all four phases
- all Stage 0 phase maps remain 1448×1086
- no legacy Stage0Scene firefly loader/spawn code remains
- TypeScript/TSX syntax validator passes all 47 source files
