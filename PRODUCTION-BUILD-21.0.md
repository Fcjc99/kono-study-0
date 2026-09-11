# KONO Production Build 21.0 — Home Rebalance + Lighting Foundation

## Home evolution cleanup
- Stage 0 remains immutable and map-painted.
- Stage 2 receives a one-pixel perimeter repair around roof/step edges.
- Stages 3–5 are scaled back toward the Stage 0/2 footprint so the progression no longer depends on oversized buildings.
- Later stages retain the richer existing details: dormers, flowers, vines, lanterns, window boxes, chimney, and entry trim.
- Stage 4–5 gain a subtle 3-frame pixel-PNG chimney-smoke loop.
- Every evolved home receives a low-opacity raster contact shadow so it sits into the path/grass instead of reading as a cut-out sticker.
- All stages 1–5 still cover 100% of the baked Stage 0 house/step mask.

## Lighting foundation
This is the global art-direction pass, not the final hand-painted shadow pass.

- Morning: warm low-angle light from upper-left, longer gentle lower-right shadows.
- Afternoon: high bright light, strongest clarity, shorter defined shadows.
- Evening: low sunset from the left horizon, warm gold highlights and long cool shadows.
- Night: moon from upper-left, cool silver edge light, soft lower-right shadow direction, warm practical lights retained.

The LightingSystem now loads raster PNG lighting masks from `public/garden/lighting/` instead of creating procedural graphic textures at runtime. The phase directions and strengths are centralized in `src/game/sanctuary/lightingFoundation.ts` so future pond, garden, critter, and environment assets can follow the same rules.

## Deferred final lighting polish
Object-specific cast shadows, roof-edge highlights, tree-canopy shadows, pond reflections, lantern spill, and final moon/sun rim painting remain intentionally deferred until the major Sanctuary evolution systems are complete.
