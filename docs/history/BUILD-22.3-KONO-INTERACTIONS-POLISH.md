
# Build 22.3 — KONO Interactions Polish

This build polishes the existing Sanctuary landmark interactions without changing the locked house/terrace/bridge artwork.

## Improvements
- Interaction actions are now **time-of-day aware**.
- Terrace actions use appropriate cues by phase:
  - morning: petals
  - afternoon: leaves
  - evening/night: restrained fireflies
  - night rest/lookout actions can use no particle cue at all
- House interaction copy now respects the phase:
  - evening: warm interior / lit cottage
  - night: quiet dark cottage
- Pond/koi/bridge copy changes naturally at night.
- Added a short **repeat-tap guard** so accidental double taps do not inflate visit counts.
- Interaction HUD is lighter, smaller, and less visually intrusive.
- HUD now shows `KONO · phase · visit count`.
- Cue particles are reduced in size/alpha/count so they do not look like visual overlays.
- Ripple interaction cue is smaller and softer, especially at night.
- Action durations now vary slightly by activity.

## Locked visual assets
No house, terrace, garden, pond, or bridge PNGs were altered in this build.
