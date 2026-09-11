# KONO v0.95.3 — Sanctuary Motion Polish

This build refines the living-world motion foundation without adding the companion.

## Motion polish
- Cloud layers now move at different speeds to create parallax depth.
- Rain uses layered speed and alpha variation instead of identical drops.
- Breezy weather arrives in natural gust waves rather than constant uniform motion.
- Snow uses wider lateral drift variation and softer falling paths.
- Weather changes crossfade instead of abruptly removing and recreating effects.
- Existing time-of-day blends, lantern glows, fireflies, ripples, petals, and ambient accents remain active.

## Adaptive quality
- Added Auto, High, Balanced, and Low world quality tiers.
- Auto considers viewport size and available device memory.
- Lower tiers reduce secondary particle load while preserving the weather identity.
- The hidden `?sanctuaryDebug=1` panel can preview every quality tier.

## Performance
- Continues using the single world update loop introduced in v0.95.2.
- Frame delta remains capped to prevent particle jumps after tab or device stalls.
- World still sleeps while offscreen or while the browser tab is hidden.

## Scope
No planner, schedule, notes, exam, profile, or companion behavior was changed.
