# KONO Production Build 21.8 — Lantern Terrace Afternoon / Evening Pass

Build 21.8 keeps the approved Build 21.7 terrace geometry, footprint, perspective, pixel density, and progression completely locked while adding phase-specific afternoon and evening art treatment.

## Locked
- Stage 0 remains the exact terrace baked into the Sanctuary map.
- Stages 1–5 keep the approved 21.7 silhouettes and alpha masks exactly.
- No blocky/vector terrace art returns.
- Pond koi progression and Stage 5 KONO vegetable garden are untouched.

## Afternoon pass
- Adds a subtle clean daylight contrast/color pass without changing geometry.
- Keeps the terrace integrated with the existing afternoon Sanctuary palette.

## Evening pass
- Transfers the actual Stage-0 afternoon→evening map lighting shift onto each terrace pixel at its real map coordinate.
- Preserves readable wood, cushions, tea setup, plants, flowers, and pergola detail at dusk.
- Adds crisp pixel practical-light pixels at the existing terrace lantern anchors while the existing Phaser lantern glow handles soft light spill.

## Runtime
`LanternEvolutionSystem` now selects phase-specific terrace textures for afternoon/evening and retains the existing neutral texture for morning/night. Stage switching still uses the same full-map registration path.

## QA
- All afternoon/evening phase sprites preserve the exact original runtime alpha mask.
- Stage 0 remains transparent at runtime.
- QA sheets are in `docs/terrace-21.8-qa/`.
