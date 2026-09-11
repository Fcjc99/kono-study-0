
# Build 22.7.0 — KONO Pathing + Interaction + Completion Polish

This build leaves the approved 22.6.9 terrace artwork unchanged and focuses only on KONO behavior and task-completion timing.

## KONO pathing
- Rebuilt KONO's navigation network around the actual Sanctuary island paths.
- Added a hard pond exclusion ellipse so KONO cannot step into water even if a future route target is malformed.
- Re-routed pond travel around the north, west, east, and bridge edges instead of diagonal shortcuts.
- KONO still walks to the house, mailbox, garden, cherry area, pond edge, bridge, and terrace.

## Sanctuary reactions
- KONO can naturally pause and react at landmarks during wandering.
- Garden: happy reaction.
- Pond edge: curious reaction.
- Terrace: tea at evening, sleepy at night.
- Cherry area: reading/rest reaction.
- Explicit user interactions still take priority over ambient reactions.

## Task completion timing
- Global completion celebration shortened to 520 ms.
- Particle count reduced to 4.
- Bubble-star animation no longer overshoots or spins.
- Checkbox pop reduced to a small 3% scale pulse.
- Sanctuary evolution queue spacing reduced to 760 ms and the evolution accent reduced to one gentle ring + 2 motes.
- Evolution accents now finish before the next feature begins, avoiding stacked/spasming transitions.

## Preserved
- 22.6.9 terrace repaint/integration is untouched.
- Critter PNG silhouettes are untouched.
- Existing four-phase environment system remains intact.
