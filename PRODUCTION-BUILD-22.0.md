# KONO Production Build 22.0 — KONO Context Interactions

Build 22.0 continues directly from Production Build 21.9 and adds the first Sanctuary-wide KONO interaction layer without inventing or substituting a new character/companion sprite.

## What is interactive now

Click/tap each Sanctuary landmark to expose context actions:

- **Home** — Rest at Home
- **Sanctuary Garden** — Tend Garden
- **Cherry Blossom** — Sit Under Tree
- **Koi Pond** — Sit by Pond; becomes **Watch the Koi** once koi are present
- **Garden Bridge** — existing **Go Fishing** remains primary, plus **Watch the Water**
- **Mailbox** — Check Mailbox
- **Lantern Terrace** — actions expand with terrace evolution:
  - early stages: Enjoy Terrace / Sit Down
  - Stage 3+: Have Tea
  - Stage 4+: Read
  - Stage 5: Rest

The Stage 5 terrace therefore supports the intended tea/read/rest loop while preserving its existing art and progression.

## Pixel-art rule preserved

No procedural in-world KONO stand-in was created. Build 22.0 reuses only existing approved pixel-PNG world cues for interaction feedback:

- ripples at water spots
- cherry petals beneath the tree
- leaves around home/garden/mailbox
- fireflies at the terrace

The actual KONO/companion character sprite remains intentionally un-invented until an approved source character is provided. This prevents a temporary character from contaminating the locked Sanctuary art direction.

## Per-profile interaction memory

Interaction history is stored separately for each KONO profile:

- total interactions
- last action
- last landmark
- visit count per landmark

Changing profiles swaps to that profile's interaction history. Restricted/private browser storage falls back cleanly to session-only behavior.

## Accessibility / motion

- Every interaction reports an accessible status notice outside the Phaser canvas.
- Reduced Motion shortens the activity state and removes travel/fade animation from pixel cues.
- Context actions follow the world resize and mobile canvas sizing.

## Production lock

All **562** `public/garden` art assets from the uploaded Build 21.9 baseline are hash-locked and byte-identical in Build 22.0. This includes the house, terrace, tree, pond/koi, vegetable garden, bridge fishing assets, water, weather, critters, and all four Stage 0 time-of-day maps.

## Next production priority

**Garden + critter interactions** — make the existing butterflies, dragonflies, frogs, birds, moths, garden beds, and pond life respond to KONO/context taps without changing the locked Sanctuary style.

After that: final global Morning/Afternoon/Evening/Night lighting, cast shadows, highlights, and water reflections.
