# KONO Production Build 20.7.1 — Home Transparency Repair

This hotfix repairs the visible rectangular / square terrain cutout around Home Evolution stages 1–5.

## What changed

- Rebuilt the alpha masks for all 20 evolved Home PNGs (5 stages × 4 phases).
- Removed scenic sky, grass, path, and extraction-edge remnants from the Home overlays.
- Preserved the exact Build 20.7 cottage pixels, scale, position, phase color treatment, and progression thresholds.
- Kept alpha binary (0/255) so the assets remain crisp pixel PNG sprites with no soft anti-aliased fringe.
- Added an offline reproducible transparency-repair tool and QA sheets.

## What did not change

- Stage 0 remains the original map-painted cottage.
- Home stage thresholds remain 0 / 5 / 12 / 20 / 30 / 40 credits.
- Tree placement, pond/koi system, global phase lighting, garden/critter foundations, and popup behavior are untouched.
- Bamboo remains removed.

## QA

- `docs/PRODUCTION-BUILD-20.7.1-HOME-TRANSPARENCY-QA.jpg` shows the extracted sprites over a checkerboard.
- `docs/PRODUCTION-BUILD-20.7.1-HOME-STAGES-QA.jpg` shows Stage 0–5 on the actual Sanctuary map.
- `docs/PRODUCTION-BUILD-20.7.1-HOME-PHASES-QA.jpg` shows Stage 5 in morning, afternoon, evening, and night.
