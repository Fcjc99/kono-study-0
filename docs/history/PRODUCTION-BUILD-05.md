# KONO Production Build 05 — Sky, Wind & Atmosphere Depth

## Purpose

Production Build 05 adds readable air movement without turning the Sanctuary into a particle overlay. Clouds, vegetation, mist, and cloud shadows now read from the shared World Engine wind and weather state.

## Included

- A five-asset cloud library derived from approved KONO artwork.
- Nine independently moving cloud instances with parallax, weather coverage, phase tinting, and quality limits.
- Cloudy, rain, and snow now use the shared cloud system rather than a second procedural cloud field.
- Soft cloud shadows that only become visible as cloud cover increases.
- Phase-matched waterfall mist and restrained morning/weather haze.
- A dedicated VegetationSystem with small grass and flower accents that respond to the same wind value as clouds and fluid motion.
- Reduced Motion and automatic quality tiers across all new systems.
- Reproducible production-atmosphere generator and asset manifest.
- Production fluid mist ownership moved out of FluidSystem and into AtmosphereSystem.

## Art rules

- No generic sparkle layer was added.
- Clear weather remains calm and lightly populated.
- Cloudy weather adds depth before precipitation begins.
- Motion is slow enough to remain suitable as a study background.
- Existing baked clouds remain part of the approved paintings; moving cloud sprites add depth rather than replacing the full sky artwork.

## Debug testing

Open the World Debug panel with `F8` or append `?sanctuaryDebug=1`.

Test:

1. Clear / High quality — three slow cloud layers and restrained vegetation motion.
2. Cloudy / High quality — deeper cloud coverage and moving cloud shadows.
3. Breezy — synchronized cloud, vegetation, loose-leaf, water, and mist response.
4. Rain — cloud cover, rain, darker lighting, stronger water energy, and increased mist.
5. Morning / Cloudy — low haze without generic sparkles.
6. Night — cooler, dimmer clouds and reduced vegetation visibility.
7. Reduced Motion — world remains alive, but drift and sway intensity are substantially reduced.

## Known production note

The waterfall rock-pulling artifact remains logged for the dedicated fluid mask cleanup pass. This build does not alter the accepted Production Build 04 fluid frames.
