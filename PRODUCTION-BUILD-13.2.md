# KONO Production Build 13.2 — Approved Tree Sprite Integration

This corrective production pass activates the tree sprites already prepared for KONO instead of the temporary generic evolution renderer.

## Active integration

- `Stage0Scene` now preloads and creates `TreeEvolutionSystem`.
- Six approved stages are loaded for morning, afternoon, evening, and night.
- The phase-specific ground patch and tree stage share the same 420×460 source crop.
- All stages retain the same source-space root anchor at `(660, 490)`.
- Live phase changes update both the ground patch and tree texture.
- Existing task thresholds and profile-scoped progression are unchanged.

## Removed

- Generic green placeholder tree renderer.
- Generic placeholder tree PNG set.
- Runtime tinting of placeholder tree artwork.

## Growth thresholds

- Stage 0: 0–2 task credits
- Stage 1: 3–7
- Stage 2: 8–14
- Stage 3: 15–24
- Stage 4: 25–39
- Stage 5: 40+
