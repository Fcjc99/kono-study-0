
# Build 22.5.1 — Garden + Critter Integration

This build wires the 22.5 pixel-rendered PNG critters into the live Sanctuary.

## Runtime critters
- butterflies — daytime / evening flower and KONO-adjacent flutter paths
- dragonfly — pond skim path
- frog — pond-edge sit / croak / hop behavior
- birds — fly in, perch, and leave sooner if KONO approaches
- fireflies — evening/night sprites with baked PNG glow, sometimes drifting near KONO
- snail — slow garden crawl

## Hard visual rule
All visible critters are individual **transparent pixel PNG sprites**. No vector critters, procedural critter shapes, or non-pixel stand-ins are used.
