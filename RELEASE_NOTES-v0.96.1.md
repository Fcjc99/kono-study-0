# KONO v0.96.1 — Engine Architecture Rewrite

This release begins the Sanctuary engine refactor without changing planner data or user-facing productivity features.

## Added
- `WorldEngine` as the central simulation coordinator.
- `SimulationClock` for a single delta-time world clock.
- `PerformanceManager` for quality selection and particle budgets.
- `RenderLayers` for named, stable scene depth ordering.
- Centralized phase, weather, quality, wind, and water-energy updates.

## Fixed
- Removed unused `gustTarget` and `gustClock` scene fields that failed strict TypeScript builds.
- Wind-driven effects now read directly from the shared environment snapshot.
- Quality calculations now use one reusable manager instead of duplicated scene logic.

## Architecture
`Stage0Scene` remains the scene composer, while engine state now lives under `src/game/engine`. Future fluid, sky, lighting, weather, and audio systems can be extracted behind the same world coordinator without changing planner code.
