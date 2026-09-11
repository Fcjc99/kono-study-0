# KONO v0.96.4 — Fluid Artwork Integration Fix

## Corrected
- Removed the procedural full-scene water tile overlays that made the ocean look washed out and disconnected.
- Rebuilt ocean, pond, and waterfall motion from the existing painted phase artwork.
- Added phase-matched transparent animation frames for morning, afternoon, evening, and night.
- Prevented double-image ghosting during time transitions by rendering one coherent painted scene at a time.
- Kept weather, wind, water-energy, and reduced-motion integration.
- Updated the World Debug version label.

## Build note
The Vite chunk-size message is a warning, not a failed build. Code splitting can be handled separately after the Sanctuary visuals are stable.
