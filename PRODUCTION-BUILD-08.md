# KONO Production Build 08 — Environment Cleanup & QA

Production Build 08 closes the Living Sanctuary foundation cycle with a focused cleanup, memory, framing, and validation pass. It does not add productivity features or the companion.

## Fluid cleanup

- Rebuilt the ocean and pond masks with stricter water-only color selection.
- Inset animated water from rocks and shoreline edges to remove visible seams.
- Motion amplitude now fades to zero near masks, preventing remapping from pulling land into water.
- Rebuilt the waterfall using a fixed, narrow silhouette contained inside the painted stream.
- Waterfall frames are generated from water-only samples rather than cliff pixels.
- Tightened the foam area and prevented nearby rock colors from entering transformed foam frames.
- Runtime uses one neutral afternoon fluid set, tinted by lighting and weather for every time of day. This makes waterfall geometry consistent across morning, afternoon, evening, and night.

## Runtime and memory

- Reduced runtime fluid loading from 192 full-resolution textures to 48.
- Reduced the deployed `production-water` folder from approximately 66 MB to approximately 17 MB.
- Removed the redundant second full-scene background image.
- Removed obsolete dew and manual-transition code.
- Scene shutdown now stops all scene tweens before destroying world systems.
- Hidden and offscreen Sanctuary rendering remains paused.

## React and resize stability

- Hidden debug telemetry no longer causes React updates every half-second.
- FPS state updates only while the debug panel is open and the Sanctuary is visible.
- ResizeObserver changes are coalesced through `requestAnimationFrame`.
- Duplicate canvas resizes are ignored.
- Canvas size is refreshed after the game wakes from an offscreen or hidden state.

## Mobile framing

- Added layout and paint containment around the game canvas.
- Added safe-area handling for the mobile debug panel and world-status badge.
- Preserved the 4:3 production composition without stretching the world.
- Mobile canvas touch behavior allows normal vertical page scrolling.

## Production validation

Run:

```bash
npm run validate
```

This checks:

- TypeScript/TSX erasable syntax
- all four source-scene dimensions
- all 48 runtime fluid frames
- frame dimensions and transparency
- stable alpha footprints
- waterfall mask safety bounds
- minimum and maximum motion deltas

The detailed environment report is written to `BUILD-VALIDATION-PRODUCTION-08.json`.
