# KONO Production Build 15.2 — Cherry Tree Integration Polish

This update keeps the approved six-stage cherry blossom artwork and corrects its scale, registration, phase lighting, grounding, and mature-stage ambience.

## Tree scale and placement

- The runtime canvas is expanded from 420×460 to 620×650.
- Stages use an authored presence curve instead of one uniform apparent size.
- All stages share the same root anchor at source coordinate 648, 523.
- Mature stages now read as the central Sanctuary landmark rather than a small overlay.

## Clean replacement of the baked mound

Each time-of-day phase now has a feathered registered cover plate beneath the evolving tree. It removes the original baked stage-0 mound and sprout before the approved sprite is drawn, preventing duplicate dirt edges or an off-center lower layer.

## Phase integration

- Morning is softened and slightly desaturated.
- Afternoon remains closest to the approved source colors.
- Evening is materially darker and warmer so pale blossoms do not float above the sunset scene.
- Night uses a restrained cool moonlit grade.

## Living mature tree

- Stage 4 receives occasional light petal drift.
- Stage 5 receives a gentle continuous petal fall.
- Petals pause during rain, snow, and Reduced Motion.
- A subtle phase-aware ground shadow anchors the mound.
- The whole tree remains static; only separable petals move.

## Preserved systems

Task thresholds, profile-specific progression, live ZIP weather, pond evolution, Home evolution, Lantern evolution, water, clouds, and atmosphere remain unchanged.
