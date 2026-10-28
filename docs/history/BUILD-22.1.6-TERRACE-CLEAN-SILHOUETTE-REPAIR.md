# Build 22.1.6 — Terrace Clean Silhouette Repair

Rebuilt the evening and night terrace phase PNGs directly from the clean afternoon terrace silhouettes for stages 1-5.

## What changed
- Evening and night terrace phase PNGs are regenerated from the approved afternoon silhouette so the silhouette/footprint stays identical.
- Evening keeps the terrace lights on within the PNG itself.
- Night uses the same clean silhouette but with all terrace lights turned off/dark.
- All competing terrace emissive/glow overlays were disabled in `LanternEvolutionSystem`.
- Evening/night terrace emissive PNGs were replaced with transparent blanks for all stages.
