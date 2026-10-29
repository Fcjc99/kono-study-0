
# Build 22.1.9 — Terrace Stage-by-Stage Repair

This pass rechecks every terrace stage individually and remakes the evening/night PNGs from the clean afternoon silhouettes.

## Intent
The terrace should no longer read like a bright overlay pasted on top of the island. Evening should show lights on, but the structure, floor, plants, and furniture should sit in dusk lighting. Night should be fully dark.

## Changes
- Rebuilt **stages 1-5** for **evening** with a stronger dusk grade and restrained practical lights.
- Rebuilt **stages 1-5** for **night** as dark moonlit silhouettes with no lights on.
- Preserved clean transparent silhouettes and kept runtime terrace glow/emissive disabled.
