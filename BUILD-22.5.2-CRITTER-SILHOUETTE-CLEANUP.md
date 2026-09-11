
# Build 22.5.2 — Critter Silhouette Cleanup

This pass cleans the Sanctuary critter assets so they read as crisp transparent PNG silhouettes.

## Cleanup applied
- hard-binary alpha (opaque pixels stay solid, transparent pixels stay fully transparent)
- transparent RGB zeroed to avoid fringe/matte remnants
- individual critters trimmed to content and re-padded with clean safe transparency
- sprite-sheet files re-saved with clean transparent backgrounds

## Affected critters
- butterflies
- birds
- frog / pond life
- snail
- fireflies
