# KONO Production Build 21.6 — Lantern Terrace Evolution

This build converts the old glow-only Lantern Terrace progression into six physical terrace stages while preserving the original deck footprint.

- Stage 0 — Simple terrace (base deck unchanged)
- Stage 1 — Terrace trim / railing detail
- Stage 2 — Warm hanging lantern string
- Stage 3 — Tea nook with low table and floor cushions
- Stage 4 — Garden terrace with rug, planters, and banner
- Stage 5 — Cozy hangout with extra lanterns, plants, and reading detail

Implementation notes:
- Stages 1–5 are cumulative transparent pixel-PNG overlays on a 1448×1086 world-aligned canvas.
- The original deck stays painted into the base island; no rectangular replacement patch is used.
- The terrace overlays render under the global Build 21.0 lighting foundation, so morning/afternoon/evening/night remain consistent.
- The lantern glow is now a raster PNG asset rather than a runtime-generated graphics texture.
- Landmark copy exposes the intended KONO interaction progression: stand/look → sit/tea → sit/tea/look → sit/tea/read/rest.
