# KONO Production Build 21.3

## Stage 5 Home Final Patch
- Removed the troublesome Stage 5 wooden gate/archway and attached fence silhouette.
- Replaced it with a small, separate pixel-art vegetable garden bed.
- Vegetable garden uses four phase-matched transparent PNG overlays: morning, afternoon, evening, night.
- House, foundation, stairs, chimney, path alignment, orientation, scale, and Stage 0 coverage are unchanged.
- The garden is modular and does not contaminate the verified full-house silhouette.

## Validation
- Build 21.1 full-silhouette/map-fit validator passes.
- Build 21.3 gate removal / garden integration validator passes.
- Tree, pond, garden/critter, environment, and TypeScript syntax validators pass.
- The old Build 20.9 size-growth validator is intentionally obsolete because Build 21.0 explicitly rebalanced Stages 3–5 to grow through details rather than size.

## Next
Upper plateau evolution design and implementation.
