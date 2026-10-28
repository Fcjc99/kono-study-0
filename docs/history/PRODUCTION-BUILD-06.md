# KONO Production Build 06 — Lighting & Time Transitions

## Goal
Make the Sanctuary read as one continuous day rather than four disconnected screenshots, while avoiding the double-image ghosting caused by crossfading non-identical painted maps.

## Implemented

- Added a dedicated `LightingSystem`.
- Added continuous daylight profiles for morning, afternoon, evening, and night.
- Interpolated ambient light, darkness, warmth, coolness, haze, water highlights, cloud brightness, lantern strength, and star visibility across the existing time windows.
- Added subtle sunrise/sunset horizon light.
- Added a restrained progressive star field that is reduced by cloud cover.
- Lantern glows now rise gradually through evening and night.
- Morning haze now clears progressively instead of switching by phase label.
- Fluids, clouds, vegetation, and mist now respond to the same daylight state.
- Replaced full-image crossfades with a brief low-opacity exposure veil around the single painted-map swap, preventing doubled islands.
- Fireflies begin appearing according to dusk/night visibility rather than only after a hard phase change.
- Expanded the F8 World Debug Console with phase transition, ambient light, lantern, star, and haze readouts.

## Transition behavior

- Real-time light values evolve continuously inside each transition window.
- The painted scene changes only once, at the midpoint of the transition.
- The map swap is concealed by a short 660 ms exposure adjustment rather than overlapping two misaligned paintings.
- Debug time changes settle through the same lighting system instead of snapping all visual layers immediately.

## Intentionally deferred

- Weather arrival/departure sequences belong to Production Build 07.
- Waterfall rock-mask cleanup and shoreline seams remain scheduled for Production Build 08.
- Companion work remains excluded until v1.0.
