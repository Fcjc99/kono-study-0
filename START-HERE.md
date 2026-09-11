# KONO Production Build 22.1

## Latest production milestone — Sanctuary Visual Repair

Build 22.1 repairs the uploaded Build 22.0 project before any new features are added. It locks Home geometry to the accepted Afternoon silhouette across all four phases, rebuilds the Stage 5 Option B vegetable-garden overlays, gives the Lantern Terrace explicit Morning/Afternoon/Evening/Night art plus Evening/Night emissive passes, and replaces the blocky bridge-fishing overlays with registered approved-style four-phase assets. Painted Stage 0 maps remain byte-locked. See `PRODUCTION-BUILD-22.1.md` and `BUILD-22.1-VALIDATION.md`.

## Previous milestone — KONO Context Interactions

Build 22.0 added context actions across Home, Garden, Cherry Tree, Pond, Bridge, Mailbox, and Lantern Terrace while preserving the Sanctuary interaction framework. See `PRODUCTION-BUILD-22.0.md` and `BUILD-22.0-VALIDATION.md`.

## Install and run

```bash
npm install
npm run validate
npm run build
npm run dev
```

## Live local weather

Open **Settings → Living Sanctuary → Local weather connection**.

1. Choose **Live local weather**.
2. Enter a five-digit U.S. ZIP code.
3. Select **Save ZIP**.

Each study profile stores its own ZIP code. KONO refreshes current conditions about every 20 minutes and retains recent cached conditions during temporary network failures.

## Sanctuary evolution foundation

Task credits are now saved independently for each profile. Progression remains visually dormant until Production Build 13. Checking the same task repeatedly cannot earn duplicate growth credit.

## World Debug Console

Desktop: press `F8`.

Mobile or desktop URL:

```text
?sanctuaryDebug=1
```

The debug console shows:

- time and weather simulation
- live FPS
- fluid controls
- current evolution stage
- ready evolution stage
- total credited tasks and the next stage threshold

Debug controls do not overwrite the saved ZIP code or permanently change progression.

## Production Build 15.2 cherry-tree polish

The six approved cherry-tree PNGs are now registered to one root point, scale visibly by stage, replace the baked mound cleanly, and use phase-matched lighting with mature-stage petal drift. See `PRODUCTION-BUILD-15.2.md`, `docs/PRODUCTION-BUILD-15.2-NOTES.md`, and `docs/EVOLUTION_ART_LOCK.md` before creating Home, Lantern, Bamboo, or other future evolution assets.

## Production Build 15.3 tree phase integration

Morning, evening, and night tree textures are now derived from their painted map palettes rather than generic tinting. The visible mound-cover oval has been removed, the authored mound edge is feathered into terrain, and time-of-day swaps crossfade. See `PRODUCTION-BUILD-15.3.md` and `docs/PRODUCTION-BUILD-15.3-NOTES.md`.


## Production Build 16 garden and critter foundations

Permanent garden zones now advance from total task credits, while butterflies, dragonflies, frogs, birds, and moths make sparse phase-appropriate visits. Wildlife respects weather, quality, ambient density, and Reduced Motion. See `PRODUCTION-BUILD-16.md`, `BUILD-16-RELEASE-NOTES.md`, and the QA previews in `docs/`.


## Production Build 17 bamboo grove evolution

Spanish and language-study task credits now grow a six-stage bamboo grove on the upper terrace. The grove uses authored transparent sprites, separate time-of-day texture sets, profile-safe save migration, and occasional bird visits at later stages. See `PRODUCTION-BUILD-17.md`, `BUILD-17-RELEASE-NOTES.md`, and the Build 17 QA previews in `docs/`.
