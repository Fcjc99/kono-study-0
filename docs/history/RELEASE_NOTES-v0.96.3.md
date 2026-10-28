# KONO v0.96.3 — Fluid Tile Animation Rewrite

This build removes the previous moving white-line water overlays and replaces them with a tile-based fluid animation system.

## Water system changes

- Ocean motion now uses two continuously scrolling, seamless water-surface textures.
- Ocean animation is clipped to the water surrounding the island instead of drawing individual wave sprites over the artwork.
- Pond water uses the same shared surface system with its own slower current and elliptical mask.
- The waterfall is rebuilt from continuously scrolling body and highlight textures.
- Waterfall foam uses a four-frame animation rather than a single pulsing ellipse.
- Waterfall mist remains connected to the splash area and reacts to environmental water energy.
- Wind and rain still affect water speed through the shared World Engine.
- Reduced Motion keeps a slower, calm version of the same water rather than disabling it.

## Build fixes

- Removed the unused `SanctuaryQuality` type import from `Stage0Scene.ts`.
- Removed the old ocean-wave sprite and waterfall-stream animation code.
- Existing productivity features and saved user data are unchanged.
