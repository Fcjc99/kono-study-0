# KONO v0.95 — Living Sanctuary Foundation

## Product rule

KONO is a peaceful place where studying happens. The Sanctuary must feel like a cohesive game world, not a website with animated overlays.

## Implemented world systems

- Phaser-powered Sanctuary now renders inside the real Sanctuary dashboard.
- Two aligned world canvases blend the four approved time-of-day paintings.
- Automatic transition windows:
  - Dawn: 5:30–7:00 AM
  - Midday: 11:30 AM–1:00 PM
  - Dusk: 5:00–7:00 PM
  - Nightfall: 8:00–10:00 PM
- Manual Morning, Afternoon, Evening, and Night previews use a slow crossfade without a blackout layer.
- Existing ripples, petals, leaves, sparkles, and fireflies are now scheduled as environmental events rather than fixed looping overlays.
- Lantern glow is anchored to the house and deck lighting and grows naturally through evening and night.
- Morning dew sparkles are anchored to the pond and grass and fade out in cloudy or rainy weather.
- Weather states: Clear, Cloudy, Rain, Breezy, and Snow.
- Rain and snow adapt their particle count for phones and reduced-motion users.
- Rain changes pond-ripple frequency and world lighting.
- Reduced Motion lowers ambient density while retaining a living but calmer scene.
- Existing landmarks remain interactive and are prepared for v0.98 growth stages.
- Cassette labels and volume now respond to phase and weather.

## Developer preview panel

Append this query parameter while running locally or on Vercel:

`?sanctuaryDebug=1`

The hidden panel provides:

- 24-hour world time scrubber
- Real-time reset
- Weather selector
- Ambient density slider

It is not shown during normal use.

## Layer order

1. Phase background A
2. Phase background B
3. Anchored light sources
4. Pond ripples
5. Ambient flora particles
6. Weather lighting
7. Weather particles
8. Landmark interaction regions
9. Landmark modal

## Asset audit

The uploaded ZIP contains the four complete stage-0 time paintings plus ripple, petal, leaf, sparkle, and firefly assets. The cloud directories contain placeholders only, so v0.95 does not fake cloud movement with CSS shapes or emoji. Standalone cloud sprites can be added later without changing the world engine.

## Deliberately deferred

- Companion character
- Growth-stage asset swapping
- Seasonal island paintings
- Live location weather
- Separate morning/rain/night audio files
- Standalone cloud parallax sprites

These belong to v0.98, v0.99, or v1.0 after matching assets are available.
