# KONO Production Build 10 — Horizon, Masking & Waterfall Integration

## Scope
This build focuses on phase-correct water artwork, horizon coverage, shoreline protection, and consistent waterfall geometry.

## Changes
- Restored separate morning, afternoon, evening, and night fluid frame sets.
- Ocean animation now uses each phase's own painted water instead of an afternoon-only neutral layer.
- Expanded the ocean crop upward from y=500 to y=420 so animated water reaches the visible distant horizon.
- Added phase-specific border-connected ocean segmentation to reduce hard mask cutoffs.
- Protected island, cliffs, rocks, pond, and waterfall areas from the ocean animation mask.
- Removed runtime water tinting that was making evening and night water look mismatched.
- Kept one fixed narrow waterfall geometry across all four phases.
- Kept phase-specific waterfall color sources so morning, evening, and night match their painted scenes.
- Reduced frame crossfade averaging so movement remains readable without producing rectangular patches.

## Validation notes
- 192 runtime fluid frames generated across four phases.
- All generated assets use the expected crop dimensions.
- The full dependency-backed build still requires local npm dependencies.
