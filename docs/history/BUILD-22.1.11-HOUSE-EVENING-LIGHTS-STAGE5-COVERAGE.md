
# Build 22.1.11 — House Evening Lights + Stage 5 Coverage

This pass addresses two house issues:

1. **Evening house windows** now read as lit from inside for stages 1–5.
2. **Stage 5 coverage** is extended so the upgraded house silhouette better covers the map-painted Stage 0 cottage underneath.

## Changes
- Added warm interior window lighting to `public/garden/evolution/home/evening-stage-1..5.png`.
- Mirrored the same change into `full-silhouette/evening-stage-1..5.png`.
- Applied the approved `stage0-house-coverage-mask.png` behind **stage 5** for morning / afternoon / evening / night, using a nearest-neighbor fill from the actual stage 5 art to maintain a clean silhouette.
