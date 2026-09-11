# KONO Static Asset Library Prep

This build removes all currently referenced animated sanctuary assets and animation systems so new assets can be added one at a time without Phaser missing-texture placeholders.

Removed from the scene:
- Animated clouds
- Animated critters and butterflies
- Falling petals and leaves
- Pond ripple animation
- Twinkling stars

Preserved:
- Stage 0 island
- Interactive landmark hit areas and popups
- Garden growth display
- Real-time morning, afternoon, evening, and night static tint

Prepared library folders:
- public/garden/sky
- public/garden/overlays
- public/garden/clouds
- public/garden/butterflies
- public/garden/wildlife
- public/garden/particles
- public/garden/water
- public/garden/lights

## Production water assets

`public/garden/production-water/` is the active fluid asset source from Production Build 01.
It contains phase-matched ocean, pond, waterfall, and foam frames plus `manifest.json`.
The superseded `public/garden/animated-water/` folder was removed.
Regenerate with `npm run assets:water` after installing Python, OpenCV, and NumPy.
