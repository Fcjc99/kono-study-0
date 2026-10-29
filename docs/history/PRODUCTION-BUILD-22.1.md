# KONO Production Build 22.1 — Sanctuary Visual Repair

Build 22.1 is a repair-only production pass based directly on the uploaded Build 22.0 project. It does not advance to new Sanctuary features.

## Repair targets

### Home phase geometry

Afternoon remains the geometry source of truth because it was the cleanest accepted phase. Home Stages 1–5 now use the exact same alpha silhouette in Morning, Afternoon, Evening, and Night. Phase changes alter only the painted color/lighting treatment.

This fixes the reported back-of-house clipping, cut rock, shifted silhouette, and temporary reappearance of the baked Stage 0 roofline.

Runtime phase swaps are now synchronized to the same frame as the painted Stage 0 map swap rather than crossfading the evolved Home independently.

### Lantern Terrace phase repair

Terrace Stages 0–5 now have explicit Morning, Afternoon, Evening, and Night registered overlays on the exact same Stage 0 footprint. Evening and Night have separate emissive layers for practical lantern/string-light glow.

The terrace no longer changes its art phase ahead of the painted Sanctuary map, which was a source of apparent shifting and incorrect Evening/Night lighting.

### Vegetable garden

Stage 5 uses the existing approved Option B vegetable-garden source asset, enlarged for readability while staying on the same 500×450 Home canvas. All four time phases share the exact same garden silhouette. The approved KONO sign/heart artwork is preserved.

### Bridge fishing visual repair

The old simple/blocky fishing-kit overlays are replaced at runtime by four-phase registered full-map overlays derived from the project’s approved bridge-fishing reference and exact Stage 0 bridge crop. The original bridge remains authoritative; only fishing props/cast state are overlaid.

Fishing behavior is unchanged: bridge action, casting, bite/reel flow, catches, and per-profile catch persistence remain intact.

## Compile repairs carried forward

- Popup alpha handling is safely typed instead of calling `setAlpha` on a generic `GameObject`.
- `FishingSystem` and `KonoInteractionSystem` avoid constructor parameter properties so `erasableSyntaxOnly` is supported.
- Koi swim-path points use readonly tuple typing.

## Production locks

- All four painted Stage 0 phase maps remain byte-identical to the locked Build 21.9/22.0 baseline.
- Koi progression remains Stage 3 = one koi, Stage 4 = two koi, Stage 5 = three koi.
- Koi routes remain constrained to the existing safe pond-mask paths.
- Existing KONO context interactions remain in place.
- No new feature scope is introduced in this repair build.

## Next production priority

After Build 22.1 is visually approved in the running app: **Garden + critter interaction/polish**, followed by the final global Morning/Afternoon/Evening/Night lighting, shadow, highlight, and reflection pass.
