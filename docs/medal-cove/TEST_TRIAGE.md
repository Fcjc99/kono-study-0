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

## Looked into: also out of date, or harmless

Each of these was run with the game's own numbers printed. None turned out to be a bug a player would notice.

| Test | What fails | What's really happening |
|---|---|---|
| `test_tide`, `test_sanctuary_tide`, `test_board_clear_lifecycle` | reserve slots outside the tide's rails; tide holds 1 coin, not 12; the board-clear test waits for the tide to hold 3 | The tide was redesigned to drop one real medal at a time with no tray or rails (`store/tide.ts`: "no suspended tray, stacking layer, collision floor"). The board clear itself is fine. Its test stalls earlier, waiting on the old tide. |
| `test_scene_geometry` | camera isn't at eye height 1.7 | The game opens on the high "Tiered" view (camera at y 10.75). |
| `test_side_tower_blocking` | the shutters go past the cabinet wall (x 3.95) | The side tower's home is the right build bay outside the cabinet (`TOWER.x` 5.6). |
| `test_reference_geometry` | fastest sideways speed 9.6, limit 8 | The fastest piece is a coin already falling off the front, below the board (y −1.2, z 6.5). Energy stays within bounds. |
| `test_tower_park`, `test_reference_stock` | the tower isn't home within 1000 steps | Not stuck: home at step 1050. The empty shutters wait about 8 s on their way back for coins they just dropped. This is honest, but it delays the next tower a little. Shorten it only if it feels slow. |
| `test_rear_backstop` | a coin sinks 0.032 into the back wall, limit 0.025 | 0.007 over, about 2% of a coin's width. Not visible, and it didn't pass through. |

## Too slow to finish here

`test_sanctuary_runtime`, `test_pile_dynamics` and `test_side_tower_acceptance` (its full run, not `tray`)
took more than 5 minutes on the cloud machine's software graphics. Try them on a real computer.
