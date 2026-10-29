# KONO Production Build 21.1 — Home Full Silhouette Repair

## Scope
This build is intentionally limited to home sprite integrity. The Build 21.0 lighting foundation remains in place and the approved pond evolution is not integrated yet.

## Home repair
- Rebuilt every Stage 0–5 home as an explicit, complete 500×450 transparent PNG reference in `public/garden/evolution/home/full-silhouette/`.
- Stages 1–5 runtime PNGs now come from the same RGB+alpha source silhouette instead of mixing an old RGB sprite with an unrelated extraction mask.
- Full roof, walls, foundation, porch posts, porch floor and stair treads are preserved.
- Added safe transparent padding on every side; no sprite touches a canvas edge.
- Removed stray sky/cloud fragments from isolated sprites.
- Removed the old mismatch that made lower walls/steps look sliced off.
- Final 1–3 px Stage 0 coverage mismatches are repaired by extending the new-house edge pixels only—no terrain rectangles and no reused Stage 0 roof pixels.
- Runtime Stages 1–5 cover 100% of the baked Stage 0 house footprint.
- Stage 0 remains map-painted in the engine to prevent double rendering, but now also has a complete explicit full-silhouette reference PNG for QA/future architecture cleanup.

## QA
- `docs/PRODUCTION-BUILD-21.1-HOME-FULL-SILHOUETTES-QA.png`
- `docs/PRODUCTION-BUILD-21.1-HOME-FOUNDATION-STAIRS-QA.png`
- `docs/PRODUCTION-BUILD-21.1-HOME-STAGES-QA.jpg`
- `docs/PRODUCTION-BUILD-21.1-HOME-ALL-PHASES-QA.jpg`

## Validation
Run `python tools/validate_build_21_1.py`.


## Sanctuary map fit
- All six full silhouettes are validated at the actual runtime crop origin `(100, 300)` used by `HomeEvolutionSystem`.
- Every mapped house bbox stays inside the upper-left home lawn safe zone and clear of the pond.
- The stage centers remain within 35 source pixels of the original Stage 0 path/entry axis.
- The visible foundation/stair bottoms remain at the same home/path elevation band, preventing floating or disconnected houses.
- Runtime uses the same 500×450 canvas and top-left origin for every stage, so stage switching cannot introduce placement drift.
