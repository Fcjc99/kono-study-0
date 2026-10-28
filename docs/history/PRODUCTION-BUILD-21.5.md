# KONO Production Build 21.5 — Pond Stage 3–5 Polish + Option B Garden

## Scope

Build 21.5 starts from Production Build 21.4 so the Planner calendar/events, subject customization, undo-delete subjects, and Montreal weather changes remain intact.

This build does **not** rebuild the pond from scratch. Stages 0–2 are preserved and the existing pond/evolution asset library is retained.

## Pond progression

- Stage 0 — Natural pond (preserved)
- Stage 1 — Rippled water (preserved)
- Stage 2 — Lily pond (preserved)
- Stage 3 — First koi: 1 koi
- Stage 4 — Koi garden: 2 koi + reeds + moss stones + first shore flowers
- Stage 5 — Sanctuary pond: 3 koi + second lotus + additional reeds/stones/flowers + subtle water sparkles

## Koi swimming repair

The existing 48 koi PNG frames remain in use: 3 designs × 8 directions × 2 tail frames.

The old single mathematical ellipse/orbit was removed. Each koi now uses its own closed route derived from the **intersection of the eroded production pond masks for Morning, Afternoon, Evening, and Night**. The routes reserve sprite-size padding from shoreline/rocks so koi stay inside safe water in every phase.

Additional behavior changes:

- slower, calmer swimming speeds
- three distinct routes instead of one shared orbit
- koi scale reduced slightly for better pond fit
- direction sprite selected from route heading
- koi render below lily/lotus layers so plants can visually sit above the fish
- pond decorations now receive phase tinting so they follow the lighting foundation

## Stage 4–5 shoreline placement

Reeds, moss stones, and shore flowers now use deliberate map anchors on the pond edge instead of the old shallow center-radius offsets. This keeps shoreline plants out of the middle of the water.

## Stage 5 vegetable garden

The previous temporary vegetable patch is replaced by the user-approved **Option B** design:

- raised wooden bed
- lantern post
- flower pot
- three tidy crop rows
- small KONO sign
- true transparent PNG
- four phase-matched overlays
- kept small and placed on the lawn without touching the house stairs or main path

## QA files

- `docs/PRODUCTION-BUILD-21.5-POND-STAGES-0-5-QA.jpg`
- `docs/PRODUCTION-BUILD-21.5-POND-STAGES-3-5-QA.jpg`
- `docs/PRODUCTION-BUILD-21.5-POND-STAGE5-ALL-PHASES-QA.jpg`
- `docs/PRODUCTION-BUILD-21.5-KOI-SWIM-PATH-QA.png`
- `docs/PRODUCTION-BUILD-21.5-OPTION-B-GARDEN-MAP-FIT-QA.png`

## Next area

The next purposeful evolution target is the **Lantern Terrace**, with KONO interactions such as sit/read/study/tea/rest. After that, the bridge can become a fishing activity spot rather than receiving arbitrary structural upgrades.
