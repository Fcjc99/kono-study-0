# KONO Production Build 20.8 — Final Home Evolution Integration Lock

Build 20.8 locks the approved Home progression before moving on to the next Sanctuary growth system.

## Home progression

- Stage 0 remains the original map-painted starter cottage.
- Stages 1–4 preserve the clean Build 20.7.1 pixel-PNG evolution set.
- Stage 5 is replaced with the approved grand sanctuary-home concept based on the Stage 0 cottage DNA.
- The Stage 5 silhouette is about 29% wider than Stage 4, so the final upgrade reads immediately at Sanctuary scale.
- Stage names remain a six-step progression ending in **Grand sanctuary home**.
- Thresholds remain `0 / 5 / 12 / 20 / 30 / 40` completed-task credits.

## Pixel-PNG asset lock

- The final house is an isolated transparent PNG asset; no grass, path, sky, cliff, or rectangular map crop is embedded.
- All four Stage 5 phase PNGs share identical binary alpha geometry.
- Stage 5 uses the existing approved phase-lighting language: warm morning, neutral/clear afternoon, sunset-darkened evening, and cool night with warm interior windows.
- No procedural house pieces are generated at runtime.

## Preserved systems

- Cherry-tree X/Y placement is unchanged.
- Pixel pond and real koi sprites are unchanged.
- Global morning / afternoon / evening / night lighting is unchanged.
- Garden and critter foundations are unchanged.
- Bamboo remains removed.

## QA

- `docs/PRODUCTION-BUILD-20.8-HOME-STAGES-QA.jpg` — complete Stage 0–5 progression in Sanctuary.
- `docs/PRODUCTION-BUILD-20.8-HOME-PHASES-QA.jpg` — grand Stage 5 across all four time phases.
- `docs/PRODUCTION-BUILD-20.8-HOME-STAGE5-TRANSPARENCY-QA.png` — Stage 5 isolated over a checkerboard.

## Reproducible asset build

Run:

```bash
npm run assets:home-stage5
```

This rebuilds the final Stage 5 PNGs and their QA sheets from the approved source image using the locked extraction, sizing, placement, and phase-color rules.

## Build environment note

The packaged sandbox copy has only a minimal `node_modules`, so the final `tsc -b && vite build` cannot resolve `vite/client` or `@types/node`. Source syntax, asset integrity, progression integration, phase alignment, and all focused production validators pass. Run `npm install` in a normal registry environment before `npm run build`.
