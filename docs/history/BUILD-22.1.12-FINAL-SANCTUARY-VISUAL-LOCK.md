
# Build 22.1.12 — Final Sanctuary Visual Lock

This pass is a visual-lock build before new Sanctuary features.

## House
- Later house stages **1–5 now fully cover the exact Stage 0 house silhouette** in Morning, Afternoon, Evening, and Night. This removes Stage 0 roof/house bleed underneath evolved homes.
- Evening house stages **1–5 have warm interior/window lights ON**, baked into the house PNGs.
- Night house stages **1–5 keep windows/interiors dark**.
- Transparent pixels remain clean.

## Terrace
- Runtime terrace glow/emissive remains disabled.
- Evening/night terrace lighting remains baked into phase PNGs.
- Validation confirms terrace stages 1–5 fully cover the exact Stage 0 terrace silhouette.

## Vegetable garden
- Stage 5 garden offset remains `Y=-25`, avoiding the foreground shrub/tree overlap.

## Pond / bridge lock checks
- Pond code keeps Stage 3 = one koi, Stage 4 = two koi, Stage 5 = three koi.
- Existing koi safe-water path definitions are preserved.
- Bridge fishing phase assets are preserved for all four phases.
