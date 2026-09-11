# Native pixel terrace and obsolete road seed removal — 22.8.3

The terrace no longer uses a high-resolution cutout downscaled directly at runtime. Its five furnishings are baked onto a shared 2-world-pixel grid, with reduced microdetail and saturation, lifted colored outlines, and a wood palette sampled from the original cottage. Existing layout, progression, and feature placement are unchanged. Inputs preserve the original furniture designs; this is a rendering adjustment, not a new terrace design.

The user explicitly requested removal of the obsolete seed/mound in the middle of the road. Built-in imagegen produced four matching path repair plates, one per time of day. Only a small feathered ellipse around that mound is consumed. The actual Stage 0 tree mound on the upper plateau is untouched. All original locked source PNGs and `STAGE0-LOCK-22.7.38.json` remain unchanged and recoverable; the runtime Stage 0 maps now have this one narrowly recorded exception.

Exact road-plate prompt (one call per matching phase image):

> Use case: precise-object-edit. Remove ONLY the small brown circular dirt mound with its tiny white seed/sprout sitting IN THE MIDDLE OF THE ROAD near the image center (below the upper plateau stairs, right of cottage, left of terrace, above the pond). Fill with continuous sandy path matching neighboring road color, texture and pixel brushwork. No brown circular spot, no sprout, no seed, no added stones in that spot. Do NOT alter the upper grassy plateau, cottage, terrace, pond, bridge or any other region. Preserve the exact full 1448x1086 image framing, geometry and current lighting. Do not zoom or crop. This is a tiny path cleanup only, not a new island design.

Rebuild: `render-pixel-assets.cjs PROJECT_ROOT OUTPUT_ASSETS` (Sharp required) creates the palette-matched sprites from 22.8.2 source inputs. `build-terraces.cjs PROJECT_ROOT INPUT_ASSETS OUTPUT_MAPS` consumes those sprites plus the four existing grass plates and new road plates. Output is staged for review, not written directly to runtime paths. `SANCTUARY-REGISTRATION-22.8.3.json` records all 24 output hashes and allowed regions.

Verify with `npm run build`, `node tools/test_sanctuary_progression.cjs`, and `python tools/validate_sanctuary_registration.py` (Pillow required). The validator checks original source locks, the exact allowed Stage 0 exception, all 20 terrace maps, and zero other terrain changes.
