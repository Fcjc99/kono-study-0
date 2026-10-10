# Seasonal art spec: Harvest (November) and Winter

Two art packs follow the October Halloween set: **Harvest** for November and **Winter** for
December 1 to February 14. Valentine's week (February 1–14) reuses the Winter island and adds
floating hearts. Each pack has two parts:

1. **The island**: four pictures, one for each time of day.
2. **Decorations**: separate pieces that players place in Decorate.

Both parts go through the same import tools as Halloween. Once a pack is imported, KONO needs a small
code change to switch it on (see "After import").

## Shared style rules (match the Halloween set)

- A cozy, painterly storybook look in the same 3/4 top-down view as the current island and the
  Halloween pieces. Soft light, warm colors, no hard black outlines.
- No text, letters or numbers anywhere, except blank panels that are meant to be written on.
- No watermarks and no frames.
- Things that give off light are painted **warm yellow-orange**: lamp glass, windows, candle
  flames, jack-o'-lantern style faces. The importer finds that color and makes it glow in the
  evening and at night.
  - String-light bulbs should be **pale cream with a warm tint**. Mark the piece `"bulbs": true`
    (see below) so the bulbs glow as well.
- Paint everything in **afternoon light**. The importer creates morning, evening and night from it,
  so do not paint dark or night versions of decorations.

## 1. The island (4 pictures)

| File | What it shows |
|---|---|
| `<season>_sanctuary_morning.png` | Soft early light, a little mist |
| `<season>_sanctuary_noon.png` | Bright afternoon |
| `<season>_sanctuary_evening.png` | Golden hour; lamps start to glow |
| `<season>_sanctuary_night.png` | Night sky; lit windows and lamps |

- Use `harvest` or `winter` for `<season>`.
- Each picture must be exactly **1448 × 1086 px** (PNG, RGB).
- Draw on the regular island's **exact footprint**: same shoreline, cliffs, terraces, pond and paths.
  KONO walks the island using the regular map's paths, and placed decorations sit on its ground.
  Start each picture from the current island (`public/garden/terrace-23.0/afternoon.webp`) and
  repaint it for the season. Do not move land or water.
- Keep the open ground clear. Players fill it with decorations, so put seasonal detail along the
  edges, on cliffs, in trees and in the sky.
- Water stays water (frozen is fine for Winter). The water's edge must line up with the regular map.

Import:

```
python3 -I tools/import_season_island.py harvest SOURCE_DIR
python3 -I tools/import_season_island.py winter SOURCE_DIR --folder winter-v2
```

- Use `--folder winter-v2` because a Winter island already exists. The new folder name stops
  browsers from showing their saved copy of the old pictures.
- Add `--moon` if the night picture has a large moon that should glow.

## 2. Decorations

- One PNG per piece, **1536 × 1024 px** (landscape) or **1024 × 1536 px** (tall pieces such as trees),
  on a **plain white background**. The importer cuts each piece out of the white.
- Center the piece and leave at least 80 px of white around it.
- A soft shadow on the ground is fine. Avoid a large white or pale ground patch under the piece. If a
  piece has one, mark it `"paleGround": true`.
- Do not paint parts that should be see-through (gaps in a fence, inside a handle) as white. Paint
  them as background white connected to the outside, or as clear gaps.
- Name files `<season>_NN_<short_name>.png` (for example `harvest_04_apple_cart.png`).

### Harvest (November) — 14 pieces

| # | id | Name in Decorate | Size | Notes |
|---|---|---|---|---|
| 01 | `harvest-cottage` | Harvest Cottage | home | Small farmhouse cottage with lit windows and a wreath of wheat |
| 02 | `golden-maple` | Golden Maple | tree | Large maple in gold and red with a few falling leaves |
| 03 | `pumpkin-squash-patch` | Squash Patch | 300 | Mixed squash and gourds on vines (not jack-o'-lanterns) |
| 04 | `apple-cart` | Apple Cart | 220 | Wooden cart with apple crates |
| 05 | `cornucopia` | Cornucopia | 170 | Woven horn spilling fruit and vegetables |
| 06 | `pie-table` | Pie Cooling Table | 200 | Small table with two pies and a checked cloth |
| 07 | `sign` | Gratitude Sign | 280 | Wooden sign with a **blank cream panel** for writing; autumn leaves on the frame |
| 08 | `study-cider` | Study Corner Cider | 210 | Book stack, notebook and a mug of cider on a crate |
| 09 | `corn-bundle` | Corn Stalk Bundle | 150 | Tied dried corn stalks with a ribbon |
| 10 | `harvest-lamp` | Harvest Lantern Post | 150 | Wooden post with a lit lantern |
| 11 | `hay-wagon` | Hay Wagon | 240 | Small hay wagon with a blanket |
| 12 | `sunflower-row` | Sunflower Row | 220 | Late-season sunflowers in a short row |
| 13 | `turkey-friend` | Turkey Friend | 140 | A round, cute turkey, friendly and toy-like, not realistic |
| 14 | `harvest-arbor` | String-light Arbor | 260 | Wooden arch with vines and **cream bulbs** (`"bulbs": true`) |

### Winter (December 1 – February 14) — 14 pieces

| # | id | Name in Decorate | Size | Notes |
|---|---|---|---|---|
| 01 | `snowy-cabin` | Snowy Cabin | home | Log cabin with a snowy roof, lit windows and chimney smoke |
| 02 | `snowy-pine` | Snowy Pine | tree | Tall pine with snow on its branches |
| 03 | `snowman` | Snowman | 150 | Scarf, mittens and a little hat |
| 04 | `gift-pile` | Gift Pile | 170 | Wrapped presents in pastel and red |
| 05 | `cocoa-stand` | Hot Cocoa Stand | 220 | Small stall with a lit lamp and steaming mugs |
| 06 | `skate-pond` | Skating Pond | 300 | Small frozen pond with skates resting at its edge |
| 07 | `sign` | Winter Sign | 280 | Snowy wooden sign with a **blank cream panel** for writing |
| 08 | `study-cocoa` | Study Corner Cocoa | 210 | Blanket, books and cocoa with marshmallows |
| 09 | `gingerbread-house` | Gingerbread House | 180 | Small iced gingerbread house with lit windows |
| 10 | `winter-lamp` | Snowy Lamppost | 150 | Old-fashioned lamppost with a lit lamp and a garland |
| 11 | `sled-gifts` | Sled with Gifts | 200 | Wooden sled loaded with presents |
| 12 | `wreath-fence` | Wreath Fence | 280 | Snowy fence with a wreath and **cream bulb** lights (`"bulbs": true`) |
| 13 | `snow-bunny` | Snow Bunny Friend | 130 | A cute white bunny with earmuffs |
| 14 | `ice-lanterns` | Ice Lanterns | 170 | Three small ice lanterns with candle flames |

Size column:
- `home` and `tree` mean the piece is sized like the existing homes and trees.
- A number is the piece's width in pixels on the 1448-wide island.

### Manifest and import

Each pack has a manifest at `tools/season_packs/<season>.json`, in the same format as
`tools/season_packs/halloween.json`:

```json
{"season": "harvest", "name": "Harvest", "decor": [
  {"id": "harvest-cottage", "label": "Harvest Cottage", "file": "harvest_01_harvest_cottage.png", "size": "home"},
  {"id": "harvest-arbor", "label": "String-light Arbor", "file": "harvest_14_string_light_arbor.png", "size": 260, "bulbs": true}
]}
```

Import (pass one or more folders holding the PNGs):

```
python3 -I tools/import_season_decor.py tools/season_packs/harvest.json SOURCE_DIR [MORE_DIRS] --preview sheet.png
```

The importer writes:
- `public/garden/registered-22.8.6/<season>/<id>/<phase>.webp`
- `src/game/data/<season>Decor.ts`
- the new pictures into the public allowlist

With `--preview`, it also saves a contact sheet showing each piece in day and night light, so you
can check the cutouts and the glow.

## After import (code, done once per season)

1. `src/game/sanctuary/season.ts`: add the season's dates (Harvest is `11-01` to `11-30`) and its
   map folder.
2. `src/game/data/buildAssets.ts`: add a Decorate category built from the generated `<SEASON>_DECOR`,
   the same way Halloween is built.
3. Optional: a small effects system for things that move, such as falling leaves for Harvest or
   snowfall for Winter. Winter already has one (`game/systems/WinterSystem`).
4. Optional: seasonal stickers can use the art, the same way the Halloween stickers use
   `HALLOWEEN_STICKER_ART`.
