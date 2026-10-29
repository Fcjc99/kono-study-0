# KONO Production Build 21.9 — Bridge Fishing Functionality

Build 21.9 starts directly from Production Build 21.8. The Lantern Terrace afternoon/evening pass, pond koi progression, Stage 5 vegetable garden, Home, cherry tree, water, atmosphere, and all existing Sanctuary evolution art remain locked.

## Bridge fishing is now playable

The existing **Garden Bridge** landmark now has a **Go Fishing** action.

1. Tap/click the bridge and choose **Go Fishing**.
2. The bridge switches from its idle fishing setup to the cast state.
3. Wait for the bobber/ripple cue.
4. When the HUD says **Bite! Tap the bridge to reel in!**, tap/click the bridge again.
5. A successful reel produces a catch; waiting too long lets the fish escape.

The wait and bite timing are intentionally short enough for mobile testing and respect Reduced Motion.

## Fishing visuals

Two new authored transparent pixel-PNG overlays are full-map registered at **1448×1086**:

- `public/garden/evolution/bridge-fishing/bridge-fishing-idle.png`
- `public/garden/evolution/bridge-fishing/bridge-fishing-cast.png`

The setup stays compact at the bridge: a slim rod and small bucket, with the cast state adding the line and bobber. The existing Sanctuary ripple PNG is reused for the water response. The fishing layer renders below the global lighting/shadow layer so Morning/Afternoon/Evening/Night lighting still affects it.

## Catch system

Current catch pool:

- Silverleaf Minnow — common
- Moonfin — common
- Cloudtail — uncommon
- Lantern Bream — rare

Catch totals and personal best size persist per KONO profile in local storage. Fishing does **not** currently award task XP or alter Sanctuary evolution, so it cannot interfere with study progression.

## Bridge landmark UI

The Garden Bridge card now shows:

- Fishing spot status
- Total catches
- Existing active-day bridge progress
- Best catch / best size
- **Go Fishing** action

During an active session, bridge taps are routed to the fishing state machine rather than reopening the landmark card.

## Locked from Build 21.8

117 production files covering the approved terrace, koi pond, critters, and Stage 0 phase maps were hash-checked and remain byte-identical to Build 21.8. The new bridge system does not modify the terrace, koi routes, vegetable garden, or Stage 0 map art.

## QA

See `docs/bridge-fishing-21.9-qa/` for:

- transparent idle/cast sprite QA
- Afternoon and Night fitted bridge QA
- locked 21.8 asset hash manifest

## Next production priority

**KONO interactions** — movement/placement and context actions around the house, terrace, pond, bridge, and reading/rest spots — before the garden/critters expansion and the final four-phase global lighting/reflection polish.
