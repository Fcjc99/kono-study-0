# KONO art prompts and imports

How new KONO art is made and brought into the app. Attach these style references to every prompt (an
image tool matches a picture far better than words):

- `public/garden/kono/source/approved-kono-rounded-style-sheet.png` (KONO's look)
- `public/garden/kono/source/approved-kono-sprite-sheet.png` (KONO's 12 poses)
- `public/garden/terrace-23.0/afternoon.png` (the island's painted look, for rooms and furniture)

Keep the original files you get back (they aren't stored in the repo): the import tools read them again.

## Shared style (top of every KONO prompt)

> Cute cozy pixel-art mascot style matching the attached KONO reference exactly: soft rounded shapes,
> fluffy cream fur drawn with fine pixel strands, a warm reddish-brown pixel outline, pink blush cheeks,
> simple shiny black eyes, small orange-yellow feet. Soft lighting from the upper left, warm pastel colors,
> no harsh black outlines except the eyes. Front-facing or 3/4 view. No text, letters, numbers, watermarks
> or frames.

## KONO colors (Paint shop)

> [Shared style] Repaint the attached KONO pose sheet as a **[COLOR]** KONO. Keep the exact same 12 poses in
> the same 4×3 grid, at the same positions and sizes, with the same face, feet and outline. Change only the
> fur: **[description]**. Background: flat pure green #00FF00, no shadows on the background.

- 1536 × 1024, named `kono-<color>.png`.
- Import: `python3 -I tools/import_kono_colors.py SOURCE_DIR --preview preview.png`
- A new color also needs adding to `COLORS` in the tool and to `PAINTS` in `src/store/konoLooks.ts`.

## KONO's house

Room:

> Cozy storybook interior of a small round cottage room, painted in the same soft painterly style and warm
> afternoon light as the attached island picture, seen from the same 3/4 top-down angle. Wooden floor, round
> window with daylight, warm plaster walls. Keep the floor mostly empty; put detail only on the walls and
> edges. Lamps and windows that glow at night are painted warm yellow-orange. No characters, no text.

- 1448 × 1086, named `kono-house-room.png`.

Furniture (one piece per picture):

> [Same painterly style and angle as the room] A single piece of cozy furniture: **[piece]**. Centered on a
> plain white background with at least 80 px of white around it. Lamp glass, candle flames and anything that
> glows are painted warm yellow-orange. No text.

- 1024 × 1024, named `house_NN_<name>.png` (the id is the name with `-` for `_`).
- Import (room and furniture together): `python3 -I tools/import_kono_house.py SOURCE_DIR --preview preview.png`
- A new piece also needs adding to `FURNITURE` in `src/store/konoLooks.ts` (its name, price and width).

Both tools list what they make in `tools/public-allowlist.json`, so the build ships it.
