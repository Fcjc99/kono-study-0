
# Build 22.4 — KONO Mascot Integration

KONO is now a real in-world Sanctuary character using transparent pixel-art PNG sprites.

## Mascot asset lock
- Cream fuzzy puffball silhouette.
- Exactly two stubby hands and two orange feet.
- No ears, tail, butt, wings, or extra side bulbs.
- Transparent pixel-art PNG assets under `public/garden/kono/`.
- Phaser's existing `pixelArt: true`, `antialias: false`, and `roundPixels: true` settings preserve the Sanctuary pixel look.

## Runtime behavior
- Autonomous walking on a safe central-island waypoint loop.
- Four directional walking: up, down, left, right.
- KONO slows down in evening/night.
- At night KONO prefers the cottage side and can fall asleep there.
- Tapping KONO triggers a happy reaction.
- Context interactions move KONO to the matching landmark and trigger a reaction:
  - House: sit / sleep.
  - Garden + cherry tree: happy.
  - Pond + bridge + mailbox: curious/question reaction.
  - Terrace tea/read/sit: seated cozy reaction.
- Fishing cast/bite/catch/miss events also drive KONO reactions.
- KONO renders below the global lighting/weather layers so the character naturally inherits Sanctuary phase lighting.
