# 22.8.6 — original phase paintings and animation stability

- Restored the original 22.7.28 morning, afternoon, evening and night paintings, preserving their colors, sun and moon. Small measured terrain offsets are registered with nearest-neighbor sampling; the paintings are not derived by tinting afternoon.
- Clear-weather clouds and mist are deliberately subtle. Native painted lighting remains dominant; evening terrace bulbs and night mascot tint/sleep are retained.
- Removed opaque old-roof fragments from home stages 1–5 with identical masks across phases. A separate local terrain underlay covers exposed map-painted roof fragments. Terrace silhouettes retain binary alpha and a common anchor.
- Kono is proportional to island size, reaches the porch and terrace deck, and climbs the painted stair flight to the tree plateau. This does not add building interiors or behind-trunk occlusion.
- Fixed zero-delta arrival movement, per-frame evening pose randomness, interrupted destination reactions, koi pause/reduced-motion jumps, and competing growth-petal fades. Retargeting evolution keeps its more-visible layer; stale callbacks cannot restore previous stages.

Checks: `npm run build`, `node tools/test_sanctuary_progression.cjs`, `node tools/test_sanctuary_lighting.cjs`, `node tools/animation-regressions.cjs`, `node tools/review-animation-regressions.cjs`, and `python tools/validate_native_sanctuary.py` (Pillow/numpy). QA route is development-only and isolates assignment progress.

Asset recipe: `tools/native-22.8.6/build_native.py <project-root> <output-directory>`. Original source assets and earlier releases are preserved.
