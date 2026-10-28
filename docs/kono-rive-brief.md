# Animated KONO: brief for the Rive file

KONO's corner (tap KONO in the KONO bar) can play a live, animated KONO instead of the pose pictures. The app side is built (`src/components/KonoRive.tsx`); it needs one file made in the [Rive editor](https://rive.app).

## Deliverable

- One file: `kono.riv`, saved to `public/garden/kono/kono.riv`.
- One artboard, square, KONO centred with a little room around the ears (it's shown at 112 × 112 px, drawn at 2× for sharp phones).
- Transparent background. Match the existing pixel style (see `public/garden/kono/idle.webp`, `happy.webp`, `sleep.webp`): either import those PNGs and rig them with bones/meshes, or redraw KONO as vectors in the same colours.
- Keep it light: under 150 KB is a good target.

## State machine

Name it **`KONO`**. The app sets these inputs (names are exact and case-sensitive; anything missing is skipped, so a first version can be just `mood` + `pet`):

| Input | Type | What the app sends | What KONO should do |
|---|---|---|---|
| `mood` | Number | 0 calm, 1 happy, 2 celebrate, 3 worried, 4 busy, 5 sleepy | A looping idle per mood: calm sips tea, happy bounces gently, celebrate is excited, worried looks around with a "?", busy reads a book, sleepy yawns and droops |
| `asleep` | Boolean | true when KONO is tucked in for the night | Eyes shut, slow breathing, floating z's. Overrides mood |
| `lookX` | Number | −100 (far left) … 100 (far right), where the finger/pointer is | Eyes (and a little of the head) follow |
| `lookY` | Number | −100 (top) … 100 (bottom) | Same, up and down |
| `pet` | Trigger | A pat, a tickle, a heart | Squish down and spring back, big smile, a heart |
| `wave` | Trigger | Hello when you open the app | Wave a paw |
| `cheer` | Trigger | A high five after something got finished | A happy hop, arms up |
| `eat` | Trigger | A snack | Munch, then a satisfied smile |

Every idle should loop seamlessly and blink now and then. One-shot reactions (triggers) should return to the current mood's idle when they finish (about 1–2 s).

## Turning it on

1. Put the file at `public/garden/kono/kono.riv`, and add it to `tools/public-allowlist.json`.
2. In `src/game/data/konoRive.ts`, change `KONO_RIVE` to `{ src: '/garden/kono/kono.riv', stateMachine: 'KONO' }`.

Until then KONO's corner shows the pose pictures exactly as before. The animation also steps aside when Reduced motion is on, when KONO wears an outfit or a paint (the file only has plain KONO), or if the file can't play on a device.
