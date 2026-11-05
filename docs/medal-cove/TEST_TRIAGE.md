# Medal Cove v36: the 14 failing tests

These 14 tests fail in the v36 package itself as well as in KONO, so KONO's wiring didn't cause them. Each was
run on its own (`node tools/<name>.cjs`). Below: the first assertion that fails, and what it most likely means.
The tests come from the stand-alone project, so fix them there (a later version copied into KONO replaces
`tools/`); this list is for that.

## Out of date: the game changed on purpose, the test still checks the old version

These look safe to update to the current design (check the reason fits what you meant).

| Test | What fails | Why |
|---|---|---|
| `test_whole_route` | the button reads `Route`, test wants `Reference view`; then the HUD's `cove-pockets` tower-reserve readout isn't found | The button was shortened (its aria-label still says "Reference view of whole route") and the tower-reserve readout was removed from the dashboard. |
| `test_board_clear_transport` | `rt.tideMachine.status().gates.find(g=>g.lane==='center')` is undefined | The tide no longer has gate parts (`status().gates` is always `[]` in `store/tide.ts`). |
| `test_delivery_presentation` | no `sanctuary-tower-event` inside the dashboard after a wheel win | The "tower grows +2 layers" notice is no longer shown at all; only its CSS is left in `bonusConsole.css`. |
| `test_sanctuary_silhouettes_audit` | 7 silhouettes matched, test expects 4 | More silhouettes were added to the sanctuary. |
| `test_compact_cabinet` | 7 side-wall colliders, test expects 6 | `sideWallSections` now makes one more wall section. |

## Worth a look: these could be real bugs

| Test | What fails | What it could mean |
|---|---|---|
| `test_tide` | some of the 12 reserve coin slots sit outside their lane's box (`halfWidth .40`, `railHeight .86`) | Waiting tide coins may poke through or clip the rails. Either the slot spacing or the box size changed without the other. |
| `test_sanctuary_tide` | a 25-coin tide release is held 1 at a time (`maxHeld` 1, test expects 12) | Tide batches now release one by one. That's slower, and may be intended. |
| `test_scene_geometry` | the starting camera isn't at eye height (`FRONT_EYE_HEIGHT` 1.7) | The front view now starts somewhere else. That's fine if intended; otherwise the framing changed by accident. |
| `test_rear_backstop` | a reward coin sinks 0.032 into the back wall (limit 0.025) | Coins can dig into the back wall, and at worst pass through it. |
| `test_reference_geometry` | pieces gain energy or speed beyond the limits (`maxEnergyExcess`, `maxUpSpeed` < 6, `maxHorizontalSpeed` < 8) | Something in the machine kicks coins or balls (an overlap pushing out, or a mover too fast). |
| `test_tower_park` | the tower never finishes parking within 1000 steps | The side tower can get stuck on its way back. |
| `test_board_clear_lifecycle` | the board-clear flow never starts (stage `idle`, total 0) after an earned clear | An earned board clear may not deliver. Check this first. |
| `test_reference_stock` | the stock mechanism is still `returning` when it should be `idle` | It returns more slowly than before, or it can stall. |
| `test_side_tower_blocking` | the side tower's front and back shutters swing outside the cabinet width on return | The shutters clip through the cabinet sides. |

## Too slow to finish here

`test_sanctuary_runtime`, `test_pile_dynamics` and `test_side_tower_acceptance` (its full run, not `tray`)
took more than 5 minutes on the cloud machine's software graphics. Try them on a real computer.
