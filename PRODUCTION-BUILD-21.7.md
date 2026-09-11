# KONO Production Build 21.7 — Terrace Sanctuary-Style Rebuild

This build replaces the temporary/blocky Build 21.6 terrace line-art overlays with the user-approved terrace progression registered directly against the production Stage 0 map.

## Locked art rules
- Stage 0 is the exact existing Sanctuary terrace and remains unchanged.
- Stages 1–5 are rebuilt from the approved Stage 0 orientation and footprint.
- Terrace artwork uses the same soft pixel-art language as the Sanctuary map, cottage, and cherry blossom assets.
- No vector-like rails, UI-like rectangles, or procedural terrace furniture are used.
- Stage 5 is deliberately more substantial than Stage 4: a full blossom pergola, lounge bench, tea table, rug/cushions, flowers, lanterns, and richer decorative structure.

## Progression
0. Simple terrace — original map art.
1. First touches — subtle terrace life without changing footprint.
2. Resting rug — rug/cushion resting setup.
3. Tea terrace — low table and tea seating.
4. Blossom pergola — trellis/pergola and garden detail.
5. Grand sanctuary terrace — premium pergola lounge/read/rest space.

## Asset structure
- Runtime: `public/garden/evolution/lanterns/terrace-stage-0..5.png`
- Standalone QA sprites: `public/garden/evolution/lanterns/full-silhouette/terrace-stage-0..5.png`
- Approved source sheet and Stage 0 reference are preserved under `.../lanterns/source/`.

The runtime overlay remains fixed to the 1448×1086 production map coordinate system, so responsive resizing continues to use the same Stage0Scene scale path.
