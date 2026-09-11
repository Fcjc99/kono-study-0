# KONO Production Build 04 — Fluid Motion Recovery

## Goal
Restore clearly readable, calm water movement without reintroducing large diagonal wave bars or phase-specific waterfall defects.

## Changes
- Ocean now animates the painted water body itself through phase-matched displacement frames.
- Ocean displacement is primarily horizontal with gentle vertical breathing; no large diagonal line layer.
- Pond uses a smaller circular/current displacement so lilies and rocks remain visually stable.
- Waterfall silhouette is now a fixed solid production mask across morning, afternoon, evening, and night.
- Removed the color-threshold waterfall mask that split the bright center of the stream.
- Waterfall animation now uses descending internal light ribbons instead of vertically remapping rock pixels.
- Increased fluid frame count from 8 to 12 for smoother loops.
- Changed runtime blending so frames remain readable before easing into the next frame.
- Foam continues as an independent breathing loop.

## Production targets
- Ocean: readable at 1× speed, calm rather than static.
- Pond: visible only when watched, never distracting.
- Waterfall: continuous downward flow with the same geometry in all four phases.
