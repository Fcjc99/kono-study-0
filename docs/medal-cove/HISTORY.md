## Painted KONO harbor cinema (November 5)

The placeholder block lighthouse and flat mountains are replaced with a painted sunset Sanctuary harbor. KONO explores the shore, follows a butterfly, hops and waves between actual event scenes. Tower medals assemble beside KONO, the captured ball bounces in, and Tide/clear scenes use a rounded skiff with a wake. The shared painter covers both the continuous console and in-world display. The backdrop is a cached 361 KB WebP; particles and paint rates remain bounded.

The foreground now fits the screen independently of its covering backdrop. A ResizeObserver sizes the console canvas to its actual aspect ratio so wide screens cannot crop KONO. The three wheels, 124px console budget, gameplay, odds, physical bodies, user music, and saved preferences are unchanged. Motion still follows active simulation time and stops when paused, Off or reduced motion.

Validation: production cinema at 320/390/720 px visually reviewed, moving/still captures checked, event/timeline and responsive pose tests, music regression suite, bonus presentation/launch, console, Practice, gameplay and TypeScript/Vite build. Full WebGL machine rendering and real-phone performance remain unverified in this cloud browser. The developer-only tools/cinema_review.html fixture is not a production entry point.

## Supplied music soundtrack (November 5)

Coin Sound and Calm Sanctuary Variation alternate in the default background mix. Both transitions have 1.25-second equal-power crossfades, including the circular loop seam. The original individual backgrounds remain selectable. Jackpot Celebration plays on a real jackpot win, Tower Building and Release on physical construction, and Kono’s Bonus Adventure on an actual bonus launch. One event cue plays at a time: jackpot outranks tower, which outranks bonus; the background ducks under it. Cues do not reroll or award anything.

The header has independent FX and music switches. Music and its volume/background choice persist on this device. No audio loads or plays before a user gesture; music pauses for options, detail dialogs, camera editing, hidden tabs, errors and round end. Stalled cues have a bounded active-time watchdog. The original short synthesized coin impacts remain, because the uploaded Coin Sound file is a two-minute instrumental song.

All supplied MP3s decoded cleanly. Focused controller tests cover interrupted playback promises, independent cue failure, mute, pause/resume, priority, stalled cues, track changes and cleanup. Production CPU tests verify actual bonus, jackpot and construction cues. Browser media QA verifies playback and UI persistence separately; this cloud browser has no WebGL, so full 3D audiovisual synchronization on a phone remains unverified.

## Continuous KONO cinema (November 4)
The window below the three wheels is now one continuously present Sanctuary character scene. Idle breathing and event reactions use active simulation time (24fps paint cap), pause with gameplay, and obey Off/reduced motion. Jackpot, tower, ball and draw-result scenes share the existing painter; no gameplay odds or physics changed.

The former jackpot/reserve/capture/tray/delivery dashboard is in the Details drawer. Only necessary lane choice, early Launch, outcome Map and earned Clear actions can overlay the scene. The original124px console budget is unchanged. Hidden duplicate bonus canvases are not mounted.

Verified continuous idle/event tests, pause/Off/outcome cleanup, details/provenance, gameplay, launch/Practice and TypeScript/Vite. Actual isolated390px cinema browser review passed; this environment still lacks WebGL, so full3D phone appearance is unverified.

## Direct Tide shower (floating trays removed)

Tide no longer creates suspended reservoir floors, glass rails or gate colliders. The chosen lane receives paced ordinary dynamic medals; only their actual downward crossing or real field contact marks delivery and only tray contact credits the hand. Spawn-volume clearance, the 900-medal budget, fixed awards, FIFO requests and shared tower-route arbitration remain. A blocked pile retains the owed award rather than spawning overlapping coins or silently paying the wallet. The temporary lane light is decorative, not a hidden solid.

The small delivery panel now shows lane/shower status instead of a gate schematic. Camera and three-wheel layout are unchanged. Current targeted regressions include `test_direct_tide_feed.cjs`, `test_tide_delivery_panel.cjs`, and all modes of `test_reference_tide_compatibility.cjs`. Historical reservoir-specific tests describe the removed mechanism; no claim is made that the entire legacy aggregate was run. Full GPU appearance remains unverified in this environment.

## Crowded-frame stability and crafted assets

The 60 Hz physics loop now bounds catch-up to two steps per displayed frame and stops after one when measured physics work exceeds 10 ms. Under load, the simulation slows rather than jumping through four expensive steps before rendering. Only elapsed wall-clock debt is dropped: body identities, fixed dt, reward rights and simulation events are preserved. Mobile rendering caps DPR at 1.5 and uses SMAA without redundant MSAA.

Boat targets have convex beveled hulls, rolled gunwales and plank seams; the input has shell rims, and the pusher has a scalloped ceramic wave-inlaid apron. These are cosmetic geometry over unchanged contact surfaces. CPU throat-ray, bounds and full-tower visibility checks pass. Full GPU appearance and phone performance remain unverified.

Regression: `node tools/test_frame_budget.cjs`, `node tools/test_crafted_assets.cjs`. Controlled normal-60Hz 900-medal physical-state hashes match the previous release. Crowded physics remains costly; this is not a universal coin-bug or FPS guarantee.

## Coin sound and character-first screen update

Coin launch, new pin contacts and actual tray collection use synthesized metallic effects. Enable Options → Sound on; its tap unlocks audio and previews the drop. Effects are rate-capped during dense payouts and respect mute. No Candy Crush recording is included.

Both animation screens prioritize KONO and Sanctuary scenery, with only compact event/result badges. Full explanations remain accessible and in Map. Physics, odds and board dimensions are unchanged.

`node tools/profile_crowded_board.cjs` measures real Rapier/production CPU work at starting stock and 900 medals, excluding GPU, browser UI and audio. Safe loop allocation/WASM-read reductions preserve exact physical-state hashes in controlled 360-frame comparisons. Crowded physics still exceeds a 60 Hz budget in some frames; these measurements are not phone FPS guarantees.

## KONO character cinema — November 4

Both animation displays now use richer character-led scenes. The compact bonus strip branches from the immutable selected reward into a bounded coin fountain, a growing medal tower, or a JP star portal. The cabinet screen uses actual KONO sprite sheets to accompany captured balls, cheer beside towers, ride the Tide boat, and surf the completed-clear wave. Idle KONO gently breathes. All motion follows active simulation frames; Off/reduced and pause remain honored, and cached images and bounded particle counts avoid unbounded work. Decorative imagery does not award medals or imply delivery to the wallet. Rules, board geometry and camera are unchanged.

Validation: character fit across 5 aspect ratios, deterministic outcome-specific story tests, screen timeline9, bonus presentation5, launch, gameplay9 and Practice9, build. Browser component pixels reviewed at320/390 widths and actual CanvasTexture event artwork reviewed independently; full WebGL game unavailable in cloud browser.

## Designer clarity pass — November 4

The supplied phone/tablet screenshot showed the physical coin game competing with full-width dashboard bands, a cropped character scene, and delivery bookkeeping hiding the player's next goal. This pass prioritizes seeing the coin journey and understanding earned progress rather than adding more overlays.

- At widths of 800px and above (with height above550px), all three wheel faces remain together in a340px side console, giving the tiered machine the full remaining height. Portrait phone sizing is unchanged. A900×850 viewport now gives the machine560×747px.
- JP, reserve and lantern progress remain visible while rewards deliver. The ledger retains every queue; the idle line gives the current delivery summary.
- Wheels are labeled Left / Middle / Right ship to explain the physical target association. Their artwork and mixed reward distributions are unchanged.
- KONO's complete animated scene fits its panel without cropping. First-frame poses are initialized.
- No physics, payout, saved-camera or automatic-flipper behavior changes. Saved close cameras are not overwritten; select Tiered for the fitted overview.

Design reference: SEGA's Babel developer history describes fixing excessive passive waiting by keeping coin play active during bonus sequences (https://babeltower.sega.jp/babel/making/index06.html). This pass preserves active DROP during the existing bonus presentation; it does not add SEGA's multiplier rules.

Verification: responsive DOM measurements at900×850,390×844,320×740 and844×390; CPU camera/projection checks including full240-medal tower; focused gameplay, flipper, character, console and pause tests. Browser WebGL is unavailable, so these do not establish full GPU visual quality.

## Animated bonus strip (current update)
The screenshot's tiny Ball Chance icon/text panel is replaced by a panoramic SVG action scene: shutter lifts, ball enters a curved route, orbits and settles into the immutable outcome, then an outcome-specific medal flight, growing tower or JP star handoff plays. Animation is driven by authoritative game frames, with reduced/off and pause behavior preserved. Decorative medal sprites do not count rewards. The fixed 79px region and physical playfield dimensions are unchanged. Outcome Map remains accessible with complete odds disclosure.

## External side construction workshop (November 4, 2026)

Tower construction now takes place entirely beyond the right coin-deck edge on an attached side porch. The same held medal bodies build there, then travel visibly on the supported carriage to the board. Main-field starting towers remain real dynamic stacks, not building stations. The longer loaded travel uses a correspondingly longer transfer duration, while the empty motor remains speed-limited. A lower physical side sill and a small forward relocation of the right Tide gate provide a real collision-safe route; meshes and colliders agree.

The default Tiered view preserves its prior phone board scale and includes the full side workshop. Exact saved custom camera poses remain unchanged. CPU projection checks cover a maximum 240-medal building tower beside, rather than over, both coin-deck surfaces. GPU phone appearance remains unverified.

## Tiered machine and automatic flipper (November 3, 2026)

The upper physical plinko board, pins, ship targets and launcher now share a raised geometry contract above the coin beds and towers. A continuous rear apron connects the real falling-medal route to the existing shelf. The new Tiered camera fits that hierarchy inside the toolbar-safe stage. Short portrait screens use a taller scrollable layout rather than shrinking the whole machine. The old saved camera is retained, available through Camera → Restore saved view; choosing a preset no longer deletes it. Newly saved views still persist.

Manual aim is replaced by a visible left-right sweeping flipper. Tap/hold DROP queues at most two paid medals; actual launch samples the visible flipper position at that release, so queued medals no longer replay stale manual aim. The sweep and release stop during camera editing and other gameplay pauses. Reward tables, medal size, pusher/tower motors and the three large wheels remain unchanged, but the new physical input path and timing can change individual outcomes.

A separate in-cabinet animation display sits between the ships and coin deck. It illustrates actual capture, tower-award, Tide-award and clear-completion events, with labels distinguishing queued delivery from wallet credit. It creates no medals or outcomes and consumes no additional DOM board space. Motion preferences and active-simulation timing apply.

Validation: final actual-stage projection checks cover all three ship targets with the full 240-medal tower at bay and dock, including moving center-target extremes. All 42 sampled plinko points remain visible. Camera restore, automatic launch, pause, bounded queue accounting, production routes and default Board Clear pass. In the isolated 93-source physics sweep, 92 medals exit alone and one genuinely balances on a pin; subsequent ordinary sweep inputs dislodge that exact original without a scripted kick. Browser checks cover DOM and the event-screen texture; full GPU scene/phone visuals remain unverified. This is a complete-machine view, so coins are smaller than in a saved close-up. A full tower can naturally overlap the lower screen artwork; key award text is in its upper third.

## Event animation pass

Real capture, collection, reserve increases and newly earned lanterns trigger bounded console reactions. Larger tower awards, Tide awards and completed Board Clears now have distinct narrow-edge ceremonies driven by active simulation time; pausing freezes their poses. Full/Subtle/Off and reduced-motion preferences remain honored. No game rules or physics changed.

# KONO Medal Cove · Reference-machine review build

## Interactive motion (November 3, 2026)

This presentation/interaction update starts from `480272d26ea0e996b9274bcf0d5bf4d96fd27dab`. Physical tower, Tide, Board Clear, cabinet and feeder-capacity controllers remain unchanged.

- Captured-ball and jackpot draws have a short 60-frame armed window. An optional **Launch ball** action starts that exact stored draw early; otherwise it launches automatically. The action cannot select a pocket, reroll, spend medals or award anything. Monotonic IDs reject stale/repeated actions, including across retry. Result dwell and the selected prize remain authoritative. Starting earlier can change subsequent event timing; this is not a promise that every later random event follows the identical order.
- The illustrated bowl now shows continuous frame-derived entry, orbit, deceleration and settling. Full uses a stronger orbit/trail; Subtle still moves; Off/reduced-motion retains a stable accessible display. No separate animation clock advances rewards. The Map remains an explicit informational dialog, with the complete outcome map and normal pause/focus behavior.
- A bounded, depth-tested scene-light pool responds to accepted feed, actual launch, pin contact beginnings, pocket hits and actual collection. Persistent resting pin contact does not repeatedly trigger an impact; contact history retires ended pairs. These are decorative lights, not additional physical coins. No reward, force, camera or RNG changes come from them.
- Tower deposit rings follow completed layers and carriage trails follow measured support movement. No faster or fictitious physical transfer is introduced.
- Tide lane controls have pointer/keyboard preview and a stage-driven carriage/gate illustration. Preview alone does not choose a lane. The existing activation commits the exact request/lane once; release feedback follows actual increases, never an imaginary payout while obstructed.
- A successfully accepted Practice sample now closes the Practice dialog and resumes immediately, so the selected animation can actually play. A rejected sample retains the dialog and its reason; no sample rights or Practice provenance are changed.
- The fixed event-region/board-space budget, three approved wheels, saved camera, pause/hidden-tab controls and reduced-motion settings are retained. Cloud browser QA verifies actual DOM motion and controls, not GPU rendering of the 3D machine.

## Responsive play and reward flow (November 3, 2026)

This update starts from `671ab1ca58fe4591e14e90e7f3667f2632414eae`. The three approved wheels, saved camera poses, award tables, physical medal provenance, and main KONO app are preserved.

- Player input has two visible accepted-but-unlaunched slots. Both tap and held input check physical plus staged input capacity **before** charging; a held feed waits while full, then resumes. Already paid medals retain their exact FIFO and aim. The selected aim and pending launch are shown separately. A controlled twenty-second comparison accepted 63 of 100 attempts, launched 62 and left one queued (maximum two), rather than accepting 100 with 43 still queued. This is admission backpressure, not faster physics or synthetic credit.
- Ball challenge presentation no longer waits for an entire physical Tide payout. Results still serialize with an explicit dwell. A separate physical route owner alternates only at empty, safe boundaries; center Tide parks before handing the route to a tower. Each machine retains its immutable award FIFO and real collision checks. Purges also require ownership. Actual route, capacity and obstruction reasons are visible rather than hidden in the ledger.
- The secondary HUD and event region have a fixed height. Details and outcome maps use deliberate, keyboard-accessible modal dialogs that pause the game, stop held input and restore focus. Automatic bonus displays remain nonmodal. At 390 by 844, browser DOM measurements give a 427.8-pixel stage (50.7% of the viewport), unchanged by open details and bonus states. Very short 320 by 568 screens scroll rather than crush the machine; DROP requires scrolling on that fallback.
- A circular illustrated chance bowl replaces the plain outcome list in ordinary play. It depicts the already selected software outcome, not another physics simulation or timing-based skill game. The accessible map retains all eight or twelve equally likely pockets. Off/Subtle/Full, reduced motion, paused and hidden-tab states are respected. Main reel results now dwell for 72 frames before the next queued draw.
- Tower cues follow actual stock, completed layers, supported movement and obstruction. Faster mechanical transfer/reset was tested and **rejected** after a lateral-speed regression; original motor timing and geometry remain. Safe route scheduling, not force or speed manipulation, improves availability.
- Board Clear retains its same-body magnetic transport, actual tray capture before credit, protected balls, held supply and honest refill. It now prioritizes higher stock, uses nearer catcher lanes and fully swept overhead routes, and resets recovery after reaching a waypoint. Ordinary bounded transport is tuned separately from the original slow pinch recovery. Timing is layout-dependent: the final common 606-medal case improved from 11,160 to 4,816 simulation frames (56.8% shorter on the final source); crowded 772 took 6,215 versus 6,146, and synthetic 900 took 5,008 versus 3,763. The supported-ball 606 case took 4,568 frames. A distinct dense lifecycle 900 case completed in 6,419 frames; a geometry-derived, fully swept low escape resolves a preserved-ball overhang trap without moving the balls or exempting collisions. Long clears remain possible; no universal speedup, duration or GPU performance claim is made.

The final seed-17, ninety-simulation-second natural-input probe accepted 269 drops, launched 267 and retained two (maximum two). Accepted-to-launch delay averaged .571 seconds, with 95th percentile 1.15 and maximum 3.0. The same attempted-input policy previously admitted 440 and left 185 unlaunched. These are not equal accepted-play sequences: admission and random-event timing differ, so payout totals are not a statistical balance comparison. In the new run, 112 earned tower medals reached the field; another 243 were still pending at a physical obstruction. The old run had zero tower handoff by ninety seconds. No Tide occurred naturally in the new run, so separate controlled compatibility tests establish Tide/tower mutual exclusion and eventual delivery. No payout deadline is guaranteed.

Browser checks cover DOM layout and controls only: this cloud browser cannot initialize WebGL. Physics checks run the production CPU/Rapier code, not a phone GPU. Temporary QA fixtures are not part of the published build.

## Sanctuary bonus console (November 3, 2026)

Presentation-only update from `a0b923e59bb90398893be109b10a4c193560493d`: the two pale jackpot/accounting bands are replaced by one indigo-and-brass console with original SVG shell, lantern, medal, tower and reel emblems. Jackpot, five-lantern progress, tower reserve, reel queue, captured balls and actual tray collection remain visible. A native keyboard-accessible disclosure retains the complete supply/delivery ledger and starting-stock explanation. Brief accents follow actual award, collection, capture and lantern changes, respecting Off/Subtle/Full, reduced motion, pause and hidden tabs. The three large wheels, camera and physics/rules are unchanged.

Validation: focused console, delivery-presentation, bonus-presentation, bonus-reveal and reference-view regression checks; TypeScript/Vite build; browser DOM responsive review. The cloud browser cannot run WebGL, so this is not a new GPU/phone physics verification. Local QA fixtures are excluded from the published source.

A private, standalone Three.js/Rapier review of the user's original KONO machine. **The main KONO app is unchanged.** This reference-machine build starts from live `c6119dac57fee7e54b3b3dbe69eac968739bd1e1`; earlier releases are documented below as history. The existing `.git` and `.openai/hosting.json` identity and owner-private audience are retained.

## Tower Island reference layout (November 2026)

This build starts from live `c6119dac57fee7e54b3b3dbe69eac968739bd1e1`. It was based on the actual supplied **46742.mp4** pixels (81.872 seconds), not a guessed description. The clip shows a compact two-level bed, two hollow ring towers aligned front/back, a clear builder bay on the right and red prize balls. It does **not** establish a complete build/transfer/reset cycle; the mechanism below is KONO's implementation, not a claimed copy of unseen video motion.

- The ordinary-size medals remain radius `.31`, thickness `.11`. The deck is now **8.4 × 10.25**, front edge `z=2`; the real catcher moves with it. The original 1.6-unit pusher stroke is retained, with its raised shelf front travelling `−3.75…−2.15`. Its 4.3-deep physical plate keeps the rear edge behind the apron across the full stroke; the rear deck/backwall extend .65 to give that plate honest travel clearance. The solid rear apron and pin-board input route remain.
- Two genuinely dynamic starting formations contain **192 rear medals** on the moving `.6`-high shelf and **288 front medals** near the collection edge. Eight medals form each hollow ring, center radius `.82`, with alternating half-step layers. There are no decorative cylinder proxies, welded field towers, forced collapses or award multipliers. Safe loose stock adds roughly 125 medals; exact random loose-stock count can vary.
- **128 additional unawarded starting-stock medals** stand on the real right-bay carriage. The next requested tower award builds its exact medal count atop them (bounded by a 240-medal physical batch), then the same bodies move and release. `stockHeld` / `stockReleased` are separate from earned `planned` / `pending` / `released`; only earned members increment reward-delivered totals. The stock portion is never silently refilled after release. Small later awards remain honest small rings.
- Six real glossy coral prize balls have separate `ballsStartingSupply`; they are not reported as wheel-awarded balls. Actual capture still grants exactly one ordinary ball challenge per ball.
- The right builder has a visible outer glass guard and a fully enclosed transparent forward wedge with matching convex collision geometry. The old right seesaw was removed **both visually and physically**; its side slide now feeds the raised shelf directly. No invisible seesaw or roof cavity remains.
- The carriage uses two fore/aft shutters, stays in the right lane, and resets empty by moving home with open leaves, raising them in the bay, then closing at the higher plane—not by closing through a narrow low throat or lifting through a fallen tower. Loaded cargo uses conservative full-shape sweeps. Polished shutter faces use zero friction (coin, deck and shelf friction are unchanged), so withdrawal slips beneath loose medals instead of conveying them. Released tower bodies receive eight temporary extra solver iterations during withdrawal, then return to the ordinary setting. After the unchanged eight-iteration startup settle, dynamic medals approaching the rear apron request twenty-four extra contact-solver iterations in a bounded near-wall zone. This treats all medal origins equally and changes no forces, materials or collision volumes. Independent solver requests combine by maximum, so ending either request never cancels the other or restores a stale setting. Empty powered movement is bounded to `.008` world units per physics step; ordinary loose medals are exempt only from its conservative preflight, **not from real collision response**. Fixed fixtures, balls and held cargo still stop it. The original body IDs and provenance remain. A physically occupied empty bay is purged with its real floor before new construction; existing foreign medals are neither credited nor removed by that operation.
- Sanctuary Tide keeps every original award amount and choice. Its center-forward cassette now travels between `x=2.0` and `.8` at `z=1.3`; side lanes sit at `z=.65`. This is an intentional physical placement change, not an odds change. Every medal still needs genuine tray contact to count as collected.
- Board Clear retains balls and held supply. Once all old targets have actually settled/retired, it can restore whole unawarded field ring formations at the **actual stopped shelf position**, plus loose stock. A formation obstructed by preserved bodies or insufficient capacity is skipped as a whole rather than partially spawned through them. No bay stock or award is manufactured by the refill.
- The three approved large HUD wheels and Sanctuary textures remain. The redundant world-space reserve coin diagram is hidden; the numeric reserve is unchanged. **Reference view** is explicit and reversible; saved locked camera poses are not overwritten.

### Verification boundary

The targeted rear-zone accuracy comparison used the same 700-step live sequence after startup: process CPU median 17.124 ms / p95 29.333 ms for 24 extra iterations versus 15.271 / 29.418 ms for 16 (at most 21 medals boosted). This is a contended Node/Rapier harness comparison, not browser or phone FPS. The 24-iteration setting was selected because the full 121-medal plus legal-input, side-feed and normal-play probes retained the existing `.025` rear-contact bound without new exceptions.

Tests execute the real Three.js scene and Rapier/controller code with GPU drawing stubbed. New reference suites cover raw initial fixture clearance (before settling), exact stock/award provenance, default-stock repeated tower cycles, real shutter motion/contact recovery, three Tide choices and cross-mechanism ordering, startup balls, Board Clear and camera restoration. The configured suite was checked across the completed aggregate and final targeted reruns. Its initial maximum-stock Board Clear failure was repaired, then every affected clearing and interruption path was rerun successfully; unrelated runtime sources stayed unchanged. The official production build and TypeScript checks pass.

The current two-cycle contact audit observed worst transient shutter-edge compression of `.045662`, below `.025` after nine physics steps, below `.020` after ten and separated after twelve. The measured contact point lies on the physical shutter edge, not a buried flat face. Actual per-step empty-shutter displacement stayed within `.0080004` (floating-point allowance), with zero fixed-fixture penetration and no body crossing through a shutter. The actual-source rear regression also passes all side-feed, 121-medal-plus-play and ordinary-play cases: maximum depths `.024425`, `.019725` and `.021164`, respectively, with zero rear escapes or underpasses and no transient exceptions needed. These are CPU/contact results, **not GPU screenshots, Android frame-rate measurements, or a claim that every released medal is collected**.


### Final Board Clear recovery and verification

A rare upright medal could numerically wedge between two protected prize balls.
The recovery now uses a short, bounded tangent slip from those existing contacts:
real colliders stay enabled, the complete oriented shape is checked against all
other obstacles, and sampled penetration against the two existing contacts may
not deepen. Leveling resumes only after clearance. The original impulse limit
is unchanged, slip speed is capped at .6, and neither ball is moved. There is no
translation/rotation shortcut, deletion, replacement or early collection credit.
The regression also checks an unrelated platform blocks an unsafe escape path.

Final same-body checks passed: all **772** crowded live medals with **128** held
stock medals and **six** protected balls (6146 physical frames); all **900**
synthetic live targets (3763 frames); the normal **606**-medal field (11160 frames);
and the supported-ball, repeated-clear, held-award and interruption cases.
Every collection used real tray contact and retirement before fresh stock.
Large clears can therefore be lengthy; these are measured simulation sequences,
not instant-reset promises or phone-performance measurements. Both starting
ring formations return when their real locations are clear. Saved camera and
three HUD wheels remain unchanged. The explicit **Reference view** is reversible.

## Run and verify

```sh
npm ci
npm run dev
npm test
npm run build
```

`dist/` is the production output. On the managed Sites host use the official `build-site.mjs` helper; the Site owner packages and publishes. No backend, paid service, real-money feature or new currency is added.

## Previous tall two-coin workshop release (historical)

The following section documents the prior live release, not the ring-tower candidate above.

Tower prizes now use **two ordinary medals per layer**, arranged in alternating
shallow chevrons. Nothing is stretched or duplicated: diameter remains .62 and
thickness .11. Mini 20 is ten layers / 1.118 high (2.5× the former .446); 30 is
fifteen layers / 1.678 high (3× the former .558). A full tower has 72 medals in
36 layers / 4.030 high—1.8× the old 120-medal broad stack, and three times the
height of the same 72 medals in the previous six-wide layout.

The narrower matching split cradle builds at the same left workshop, slides
those same bodies to center, and lowers before opening. Empty leaves withdraw
only as far as x=±2.88 at their outside rims (clear of the parked Tide floor),
then rise to 5.20 before closing and returning. All cargo, fixture and leaf
sweeps remain active. Obstructions retain the actual award and show waiting,
not a forced animation, deletion, or payout impulse.

Larger rights remain exact FIFO requests in bounded 72-medal batches:
120 = 72 + 48; 145 = 72 + 72 + 1. The 900-body cap is unchanged. Smaller capacity
still builds a valid exact partial batch; neither odds nor earned rewards grow.
The saved camera, physical shelf stroke and three large HUD wheels are unchanged.

Light traces mark **real completed layers**, a light crown and small upward
head retraction respond to actual construction, and carriage edge lights track
actual support motion. Ready/release accents and selected Tide-lane tracers
are cosmetic only. Existing Off / Subtle / Full, reduced-motion and pause
controls apply; effects neither advance delivery nor alter any physical body.

Focused final-candidate checks verify complete same-body 20/30/72 construction,
upright support until opening, ordinary toppling, and safe empty reset. Production
20/30/85/120/145 awards retain exact FIFO rights. The compact production fixture
releases 73 original medals and resets without extra drops; its concurrent
73-tower/25-Tide fixture conserves all 98 medals with zero fixture penetration.
The new pile changes one player-input contact at the rear apron seam: measured
compression is .030311 for one physics step, then .022466 and .016576; the same
body separates after 12 steps, with no rear escape or underpass. This is reported
as transient solver compression, not zero overlap. The rear regression retains
.025 for ordinary contacts; only an original player-input frontal seam impact
may briefly stay below .035, must arrest inward velocity and fall below .025
on the next step and below .020 within two steps. No physics tuning was changed.

A separate synthetic seeded FIFO (20 + 30 + 121) needs 231 ordinary gravity-fed
fixture inputs to free its last 49 medals; this is backpressure evidence, not
an automatic-delivery or collection-rate promise. No hand credit is fabricated.

Independent checks cover 230 full cargo/head/leaf swept hulls, unchanged
portrait/desktop default camera projections, and identical rules/body poses
under all visual effect modes. All 39 configured test commands passed against unchanged application source,
including the targeted rear-contact recovery rerun. TypeScript and the production
build passed. This is CPU physics, geometry and UI evidence, not a WebGL phone
rendering or performance certification. CPU/Rapier/projection tests are not rendered WebGL or device-performance
proof.

## Previous side-workshop release (historical)

Tower awards now build as the **actual ordinary medal bodies** at the left
workshop `(−2.65, 1.10, −2.0)`, travel on the split carriage to the central dock,
and lower just .30 before releasing to ordinary gravity. No overhead delivery,
replacement shower, cleared corridor, payout impulse, or wallet credit is used.
The six-medal staggered layers, 120-medal batch ceiling, 900-body cap, request
provenance and FIFO remainders are unchanged. A 145 award remains 120 + 25.

A complete loaded-route preflight runs before departure; every subsequent
increment checks both real support leaves and every upright held medal against
all foreign colliders. A ball or high pile leaves the award supported and shows
**Waiting for space**. The player can continue ordinary dropping. At center the
empty opened leaves rise, close only after a clear sweep, travel left closed,
and lower into the workshop. Every reset increment is also collision checked.
An admitted tower retains route ownership; an earlier active Tide finishes
before tower admission. Board Clear and pause/resume preserve the same cargo.

Practice now includes **Mini tower · 20**. This explicitly adds sample field
supply, makes the round permanently Practice, leaves reserve/hand unchanged,
and collects only through genuine tray contact. Real mini awards automatically
use the same smaller physical bundle; no new earned odds or rewards were added.
The status names the actual built count, lateral movement and physical release.

Bonus accents use a bounded, non-blocking queue: warm tower, teal Tide,
lavender ball and cyan completed Board Clear. Small towers stay local; larger
awards can briefly tint the edges without covering the center or changing the
camera. **Bonus effects: Off / Subtle / Full** persists in existing tools,
respects reduced motion and has no separate automatic sound or payout timer.

The change intentionally moves tower entry from the rear shelf to the center
of the live pile. Later batches may wait behind a standing earlier tower;
there is no promised collection rate or fixed delivery deadline through an
occupied board. No saved camera or any of the three large HUD wheels changes.

### Previous side-workshop verification notes (historical)

The final frozen-source aggregate passes all **35 test commands / 197 groups**,
followed by TypeScript and the production Vite build.

Real production Three/Rapier checks retain the original objects for 20, 30,
85, 120 and 145 awards, repeated awards, capacity trims, obstructing balls,
upright medals and high piles. Mini 20/30 handoff occurs at frames 238/278
(about 4.0/4.6 seconds); both complete their safe empty reset in the seeded
fixture without extra drops. Timing is not forced when contacts obstruct it.
A 121 award can release 120 and fully reset, then wait with its final 1 supported
at the side behind the standing first bundle. In the final compact regression,
72 ordinary legal drops allow that remainder to complete at frame 5371; the owed medal is never clipped.

A separate natural-play check follows an original 20-tower medal all the way
to genuine tray contact after 236 legal drops over 6207 frames, spending only
actual hand and earned winnings. Delivery alone is never called collection.
The rear-stop regression now preserves the first 100 original input IDs and
allows later legal play: one medal naturally balances on a pin at
`(.9707,1.8845,−6.15)` after 5000 frames, far behind the new pavilion. In the final run, 25 further
real-hand drops over 992 frames release the remaining original input; every original exits, with zero rear underpasses.
No pin friction, medal identity, or reward rule is changed to make tests pass.

The pavilion posts sit outside the live bed at x=−4.45, not among starting
stock. An initial overlap audit guards against architectural startup impulses.
The actual static pavilion triangle vertices match all four visible meshes;
full closed/open carriage sweeps and the tallest construction envelope clear
those solids. All 26 carved target/chute shell meshes stay outside legal medal
apertures. CPU scene checks preserve 135/285 desktop and 133/285 portrait visible
bed-medal samples. These are physics/geometry checks, **not rendered GPU
screenshots or mobile frame-rate verification**; WebGL was unavailable here.

## Rear pin-board apron repair (after live `7f8e5dd`)

The reported green-shelf underpass was reproduced with actual production bodies.
The painted board ended at y=1.05 above the .60 shelf, while the farther-back
scraper ended at .86. Both gaps admitted a .11-thick flat medal, and the painted
board itself had no physical backplate. Shelf retraction carried ordinary
medals through that opening; this was not just camera occlusion.

The original painted board now has a matching solid back, and a visible pink
apron continues its rear plane down to y=.605. Both visible slabs and their
colliders use `BOARD_BACKSTOP`. The .005 clearance allows the unchanged shelf
to travel without admitting a medal. The front glass remains decorative: no
new front wall blocks the normal pin-board-to-shelf departure. Existing input
constraints, pocket logic, handoff velocity, materials/friction, stock, 8.4 bed,
six-medal layers, 120-medal batch, Tide, Board Clear, camera and HUD are unchanged.
This does not implement the separately discussed side-building tower animation.

Matched 5,000-step production replays counted original loose medal bodies whose
centers passed behind the painted board's rear face (z<−6.41, y<1.05):

| Ordinary route | Before | With visible rear apron |
|---|---:|---:|
| 72 medals through the two side feeders | 17 | 0 |
| 121 tower medals, including the next batch | 4 | 0 |
| 100 legal drops plus Practice 100 center Tide | 50 | 0 |

The corresponding under-board center counts (z<−6.29) were 18/5/58 before and
zero after. Samples are taken after **every actual physics step**, not just the
last pose drawn in a callback. No body is removed, moved, or pushed by the audit.
The full tower still releases all 121 original bodies and parks idle. All 100
legal inputs reach a pocket or the ordinary forward handoff. An independent
27-drop comparison preserves all exit frames and the same five pockets / 22
forward exits. Three independently placed, supported flat medals that formerly
rode back to z≈−7.25 now contact the apron and tip forward naturally, with no
test force or relocation after creation.

`tools/test_rear_backstop.cjs` preserves the production regressions, exact visible
mesh/collider match and reward/body conservation. The shortened-shelf fixture
also includes the new actual backstop: 31/36 clear-bed and 33/36 seeded-bed board
departures reach wood, as do 30/36 left and 31/36 right trough medals. These are
CPU Three/Rapier checks, not GPU screenshots or phone-performance measurements.

All 28 package modules pass 172 groups (the 168-group baseline plus four new
rear-stop groups) against frozen production source; TypeScript and build pass.
The long reward-transit test now waits for **both** first original-body tray
contact and full 100-medal delivery instead of assuming they coincide. It keeps
the same 16,000-frame bound, uninterrupted legal-drop schedule, exact award and
60-frame one-settlement identity checks: first contact occurs at frame 8,558
after 199 legal drops, and all 100 release at frame 13,814 (peak 816/900 bodies).
Real loose-medal traffic can pause the tower return and therefore later Tide
waves; nothing is forced through that obstruction. This run establishes a
natural route, not a promised collection rate. The 900-medal Board Clear still
collects every original target at the real tray, including pin-board and
under-deck starts, while preserving the ball (4,042 physical frames).

## Compact layered-tower cabinet (after live `ca75ee9`)

The user approved a narrower station inspired by real tower-pusher proportions,
not a copy of a commercial cabinet. The inspected references were the official
[Babel W playfield photograph](https://babeltower.sega.jp/root/assets/flow/pc/flow_06.png)
and [Horiatale tower close-up](https://hori-a-tale.sega.jp/_nuxt/img/image05.600f8d4.png).
The dimensions below are original KONO simulation choices, not measurements of
those machines. Sanctuary artwork and the three large HUD wheels are unchanged.

- **A rebuilt 8.4-wide station, not a squashed image.** The bed narrows from 10.4
  to 8.4 (19.2%), while medals remain .62 across and .11 thick. The shelf is 8.0
  wide; its 2.4 depth and 1.6 stroke remain unchanged. Matching deck, segmented
  glass/colliders, pins, input range, pockets, side troughs/seesaw, collector,
  connected staggered starting stock and Board Clear slots all use the new
  available width. Both side delivery assemblies move inward 1.0. Depth remains
  13.6: the request does not silently shorten the collection journey as a second
  economy adjustment. Front and Whole route bounds fit the rebuilt cabinet.
- **One real layered bundle.** Six ordinary medals form each alternating,
  staggered layer: 2.19×1.164 footprint, 2.4×1.24 cradle. A batch holds at most 120
  actual medals (20 layers), within the unchanged global 900-medal budget.
  Twenty is three complete layers plus two; thirty is five complete layers.
  There is no ring multiplier or fake huge tower. Larger awards retain their
  exact FIFO remainder; capacity can produce a smaller valid partial layer.
- **Supported construction, then ordinary physics.** The same registered bodies
  build, lower and release upright. Every support translation—including opening
  and return—now tests its actual swept shape against fixtures and traffic.
  An opening leaf can withdraw from verified cargo resting entirely above its
  own top face, including an ordinary medal that arrived later. This narrowly
  permits gravity release, not a new award; side/underside obstruction, fixed
  fixtures and every closing/returning sweep still stop the mechanism.
  The release plane is .80; cradle underside .72 leaves .12 clearance over
  the .60 shelf for an ordinary flat medal. Taller obstacles still stop it.
  No planar impulse, correction, teleport, replacement shower, friction change
  or automatic wallet credit was added.
- **Feeders beside a clear central route.** Left/right narrow reservoirs are at
  x=±3.38, z=0. The center cassette normally parks at x=3.38, z=−3.55 with its floor
  open. For a selected center award, it travels empty to x=0, closes, loads and
  releases, then parks empty again. This keeps its fixed hardware out of a
  tower's route during ordinary play. Each wave is two front/back slots up to
  six medals high (at most 12); all doors withdraw forward. Actual rail and gate
  bodies are the mesh pose source. Sweeps include parentless fixed scenery,
  balls and ordinary medals; an obstruction keeps the original award pending.
  Cargo on an extended parked floor blocks travel rather than being carried or
  erased. Tower/Tide ownership, choice, pause and provenance remain intact.
- **Your camera stays yours.** A saved pose is not migrated or overwritten.
  Whole route is an explicit reversible fit to the new bounds; return restores
  the exact saved transform/lens. No forced cut, split view or wheel redesign.

### Physical checks, not delivery-only counters

The narrower width was compared at 8.3, 8.4, 8.6 and 8.8 with unchanged coin materials.
At 8.4 the actual shortened-shelf fixture transfers 19/36 board medals on a clear
bed and 18/36 on seeded wood, preserving the existing transfer thresholds. Left
and right trough fixtures transfer 22/36 and 29/36 respectively. The current
starting stock has 285 normal medals; none are new awards or immediate credits.

A real production 100-medal center Tide, with **zero player drops**, pushes 14
original stock medals into actual tray contacts. Front-stock mean forward
advance is .946; the stopped-pusher control collects zero. This is a consequence
of live contacts near the pusher, not delivery credited as payout. The initially
tried farther-forward center location delivered but did not transmit enough
pressure to the front; it was rejected rather than relaxing the causal test.

A separate longer production run follows the original rewarded Tide body
through reservoir, live pile and actual tray contact after 255 legal drops
(frame 10766; peak 725 medal bodies). It uses no hand refill or synthetic
transport. This proves a natural path exists, not a guaranteed return for each
award. Ordinary 100-drop play collects 81 original stock medals; its stopped
pusher control collects zero.

Full 120-medal tower tests observe 120 real support contacts at handoff, initial
minimum upright factor .9976, then natural forward motion and toppling. Small
20/30 awards and 120+1 production batches retain their exact original bodies and
amounts. Board Clear stress remains 900 actual medals, preserving balls, rights,
held supply, queues and contact-only settlement. Its distribution/goal envelope
is derived from the narrow tray, not a smaller stress population.

An independent actual-production replay creates and releases all 121 original
tower medals (120 + 1), traverses every mechanism stage, and parks fully idle
by frame 3201 with no additional player drops. Original bodies advance as far
as 5.063, with no measured support/fixed-fixture penetration. A concurrent
121-tower + 25-center-Tide replay completes both original requests and parks
both mechanisms by frame 3571 after 27 ordinary legal drops. Later bonuses
earned during that play remain separately reconciled, not counted as part of
either original request.

The lifecycle contact audit now samples after **each actual physics step** and
checks newly counted bodies before the next step replaces that evidence. A RAF
callback can contain two fixed steps, so checking only the final callback pose
could miss a real first-step contact. The same .012 distance, upward normal,
original-body identity and real-tray invariants remain mandatory.

These are CPU Three geometry, production callback and installed Rapier checks.
GPU pixels, subjective appearance and phone performance have not been verified.
The final 27 package test modules pass all 168 groups, including the adapted
153-group baseline and added compact/mechanical cases. They were run in three
isolated workers against frozen production source; the final geometry-only
cradle fixture update was rerun separately. The independent compact six-group
suite also passes. TypeScript checking and the production build pass.

## Contact-flow repair (after live `24c0725`)

The static-grid feedback exposed a gap in the previous tests: a feeder handing a
reward to the board did not establish that pressure reached the front pile.
This repair changes the contact setup, **not the reward tables or collection rule**.

- **Connected, non-overlapping stock.** The old .6572 square spacing left .0372
  gaps between .62-wide medals; the first row was only .01 inside the shelf's
  full reach. Stock now uses staggered .62186 spacing, a sparse offset upper
  layer and .15 first-row engagement. The deterministic scene contains 355
  starting-stock medals rather than 359. Gravity settles them normally; nothing
  is translated or kicked after setup. The front stock is not moved closer to
  the collection edge.
- **Medals can slide across one another.** Simulated medal friction changes from
  .58 to .16. Rapier's ordinary Average combine rule makes medal/wood contact
  .37 with the unchanged .58 deck parameter. Restitution, damping, sleep, CCD,
  solver, vertical-only gravity, fixed timestep and the 1.6-unit shelf stroke
  are unchanged. These are simulation choices, not measured metal constants.
- **Same cabinet and routes.** The 13.6-deep bed, 2.4-deep shelf, actual tray,
  tower, side feeds and Tide collider routes stay unchanged. Moving the Tide
  gates onto the shelf was tested and rejected because it intersected the
  tower's lowering path. There is no conveyor force, impulse assist, teleport,
  body eviction, automatic credit, odds change or guaranteed return.
- **Watch the actual delivery.** The large gold bonus banner and purple delivery
  card no longer cover the board. Exact tower award/delivery progress is merged
  into the existing compact dashboard status. The same three real Tide gates
  have clear guards, metallic floors and contrasting edges attached to their
  actual bodies. The three approved large HUD wheels and saved camera are
  unchanged; there is no automatic cut or split scene.

### Actual-production causal checks

Independent CPU tests execute the real TSX, Rapier, rule loop and legal input
callbacks, with GPU drawing stubbed. Both baseline and candidate receive one
Practice-100 center release and the same 100 legal drop attempts across nine
fixed aim positions; neither receives a hand refill or forced capture.

| Measure | Before | Repaired |
|---|---:|---:|
| Stock medals moving >.1 after 16 drops | 26/359 | 355/355 |
| Front-row mean forward advance after 16 drops | .0033 | .3658 |
| Starting-stock tray captures after 46 drops | 2 | 35 |
| Tide physically delivered at that point | 48/100 | 100/100 |
| Starting-stock tray captures after 100 drops and settling | 42 | 103 |

The identical stopped-pusher control collects zero medals and its front-row
advance is below .001. A separate no-award/no-input run produces **zero startup
payouts**, and with the pusher stopped every seed remains exactly stationary.
A bonus-only run (100 Tide, no player drops) physically pushes seven original
front-stock medals into the tray; the stopped control produces zero. This is
contact-driven collection, not a reward credited when its gate opens.

The compact dashboard now makes **Tray collected** (all actual captures)
prominent and shows **from rewards** as its separately labeled subset. A bonus
pushing starting stock into the tray no longer leaves the only visible
collection counter at zero. Neither label includes an undelivered award.

Awarded, delivered and collected still describe different things. Those bounded
100-drop comparisons collect **zero reward-origin medals**: they demonstrate
real payout from the shared front stock, not a promise that every newly awarded
medal immediately crosses the whole bed. All pending supply, real side losses
and original-body provenance remain accounted for every frame.

A separate longer nine-aim production run establishes one **natural reward-origin
path**: an original center-Tide medal starts in its reservoir at z=-3.65,
contacts the live pile, crosses the bed and touches the real tray at z=6.480
at frame 10,767 after 255 legal drops. Only then does reward-collected become
one. There is no hand refill, impulse, relocation, replacement or forced capture.
This is an end-to-end possibility check, not a promise of that drop count or a
return for every award. `tools/test_reward_transit.cjs` preserves this path and
checks the same body's held/released/contact/capture identity and ledger.

`tools/test_pile_dynamics.cjs` covers non-overlapping stock, complete contact-chain
propagation, empty idle and stopped controls, bonus-only real tray contact and
ordinary play. `tools/audit_pusher_force_transfer.cjs` retains a reproducible
observation-only audit. The supplied phone screenshot was inspected; no GPU
screenshots, subjective excitement, phone touch/thermal or device frame-rate
improvement is claimed by these CPU tests.

## Sanctuary Tide update

- **Fixed award → placement → physical release.** A winning software JP commits one immutable award. After the 100-frame result read, Left / Center / Right selects placement only. There is no timer, automatic selection, additional wager, or odds change. The choice stays latched for the entire award.
- **Real low reserve and gates.** Up to twelve ordinary dynamic medal bodies load on the selected real floor. The visible gate slides open; those same bodies fall into the live seeded field. Physical crossing, not elapsed animation time, advances delivery. Capacity or true obstruction retains all pending material. A blocked lane says “Delivery paused — keep dropping to clear space”; Practice can provide further 12-medal hopper samples. A jackpot is not a promise of unattended delivery or eventual collection. Tower construction and Tide gate travel have explicit mutual exclusion where their physical sweeps overlap. If ordinary loose cargo lands in the selected closed reservoir, a safe empty-clearing cycle opens the real gate before loading; those already-delivered bodies retain their original provenance and are never credited again.
- **One owned sequence.** Other ball challenges and Tide rights wait visibly. Ordinary play and the three approved HUD wheels continue. Options/hidden tabs stop both physics and rules without catch-up; camera editing owns inputs but does not silently choose a lane.
- **Readable chance, no overlay.** Complete dish/JP outcome maps now sit in the dashboard with a marked ball, qualification source, software-chance disclosure, and a fixed result held for about 1.67 simulation seconds. The old camera-facing roulette and dark field veil are removed. Miss copy no longer calls every result a near miss or claims a fifth winning pocket.
- **Try JP · 100.** Practice offers the actual lane/reserve/gate sequence immediately. It explicitly supplies 100 sample medals without modifying earned JP wins, jackpot size, pocket odds, or hand credit. The whole round retains Practice provenance.
- **Original view preserved.** Whole route is an explicit reversible preview; Return saved view restores the exact pose without writing localStorage. It fits real routes, low gates, parked cradle, compact reserve and collector around the toolbar/hint. It does not force a camera cut, add a split view, or resize the 13.6-deep bed or 2.4-deep shelf.
- **Less rear obstruction.** Redundant miniature world wheels are gone while their HUD controller state remains. Decorative gantry posts sit behind/outside the board. The nonphysical reserve shows at most fifteen rings, with exact total and stored overflow text. Real cradle leaves park above the pegboard, deploy before a build and park afterward; swept collision checks move the mesh and collider together.

A round remains browser-local and is **not saved across reload or retry**. Only the camera preference persists. Repeated delivery transfer keys are idempotent within the current session; this is not a claim of payout persistence or recovery after reload. Restart explicitly begins a fresh round rather than replaying pending awards.

## Frame and lock your own camera

- **Camera** beside Front/Whole route opens a small editor at a moderate 1.25× zoom. Zoom buttons/slider, Move/Angle drag modes, position arrows and turn/tilt sliders control the same original scene. Two fingers move and pinch to zoom; a mouse wheel zooms only while editing.
- **Lock view** (or Escape) keeps the exact world-space camera position, angle, lens and zoom, closes the editor and restores aiming/DROP. It saves only this view in localStorage, not the game round. The control becomes **Unlock view**; unlocking does not jump or discard the chosen framing.
- A locked view never auto-fits a growing reserve/tower, aims, drops or animations. On portrait/landscape/fullscreen resize only aspect changes; the chosen position, lens and zoom stay fixed, so cropping can change. The HTML controls stay on-screen, independent of that crop.
- **Reset** always restores the original fitted Front and clears the camera preference; Front/Overview/side presets also deliberately replace a custom view. Camera editing blocks every medal-spending and aim path and cancels any existing feed/gesture. The editor scrolls on short screens without hiding Lock or Reset.
- Malformed/unknown/non-finite saved values are rejected, finite values are bounded, and denied/full browser storage leaves a working session-only view with an honest notice. No new camera/render layer, split scene, wheel redesign, physics or reward change is introduced.

## Eye-level Front and shorter real shelf

- **One continuous original scene:** Front now keeps the lens 1.7 world units above the wooden bed and looks slightly upward (pitch −0.035 radians). It is not a pegboard crop, split view, second camera or render-layer trick. The full usable field, collection tray, input and reserve stay in frame; Overview and all three large HUD wheels remain.
- **The actual green block is 60% shallower:** mesh and collider share a 2.4-unit depth, down from 6. Its front travels from z = −6.2 to −4.6, one original stroke farther back. The original 1.6-unit stroke, cadence, vertical gravity and material coefficients are unchanged. Shortening only its hidden rear would not have moved medals onto the wood sooner.
- The seed pile extends back across the newly exposed wood so the front face still contacts real field stock. This is starting-field stock, not a prize or wallet credit. The same-body tower construction lift lands at z = −5.1, aligned with the shorter shelf; side hoppers, right seesaw and board departures keep their physical routes.
- Moving medal/ball instances no longer rely on a bounding sphere cached from the starting pile. Later coins falling on the pin board cannot disappear because they lie outside that stale sphere.
- Real Rapier comparisons over 36 board-bottom handoffs: **0 → 22** reached actual wooden-bed contact in the clear fixture and **0 → 21** in the seeded fixture; every transferred board medal contacted the shelf. Actual left trough transfer rose **9 → 19 / 36**, and right trough plus seesaw **10 → 30 / 36**. A half-cycle-shifted seeded feed transferred 15/36. No post-handoff nudge, teleport, altered odds or guaranteed collection was added. Remaining supported shelf medals may wait for later contacts; not every drop is promised to reach the tray.

## Gameplay improvements in this release

### Every earned activation waits

- The same three large wheels are now named **Lantern Supply**, **Star Progress**, and **Tower Growth**, reflecting their existing pools. Each shows its actual waiting count.
- Mini-wheel and main-reel queues no longer clip earned entries at the former three/four limits. Fever still gives two activations to later hits, while its triggering hit remains one. Every draw keeps its own original outcome distribution.
- Mini-wheel results remain readable for 36 simulation frames before another queued spin starts. The main-reel queue has its own visible count and preserves its last settled faces.
- External tower requests remain pending until explicitly consumed; they no longer expire merely because 90 frames passed.

### One complete ball challenge at a time

A ball follows **magazine → visible rail → physical field → catcher/side return → queued challenge → shown result → delivery**. The dashboard shows arriving/on-field balls, capture total, queued challenges, and the active phase.

**One captured ball earns one challenge.** The original side-return activation rule is preserved; this is not falsely described as front-only collection. The dish and Jackpot Chance are software-selected draws, not physical roulette or a stop-button skill test. Their original tables and thresholds are unchanged.

Dish, its result, Jackpot Chance, and its result share one presentation lane. A JP cannot resolve hidden behind a later dish. Each result holds for 100 simulation frames; dish and chance easing now finish at the outcome boundary instead of waiting half a second after settling. Other captured balls wait visibly, while the pusher, dropping, the three wheels and ordinary delivery continue.

### Awarded, delivering and collected mean different things

The authoritative medal ledger commits an award when its result is fixed:

- **Awarded to field:** the committed medal supply, not spendable hand credit.
- **Delivering:** unresolved material in rain, side hoppers, bucket, tower requests, supported tower construction, or queued/loaded Tide cargo.
- **Handed to field:** an actual physical medal has left its feeder, a supported tower body has been released into ordinary physics, or a Tide medal has physically crossed below its opened gate.
- **Reward collected / lost / on field:** the fate of those delivered reward medals. Only actual tray contact credits collection.

The dashboard's collected number is **reward-source collection**, so it is comparable to its award total. Game options additionally show **all-medal tray collection**, which includes starting-field stock and the player's own drops and can therefore exceed awards. Those initial/player medals are never counted as new awards. Tower reserve is separate until a release is awarded. A Practice round explicitly labels sample-inclusive supply and remains Practice after closing its controls.

Conservation is `awarded = pending + delivered` and `delivered = live + reward collected + reward lost`. The automatic round-end gate independently inventories every holding location, input, active sequence and in-flight delivery, rather than trusting an animation timer or a partial counter. A partially filled bucket flushes after the hand empties; already banked material no longer strands that round.

The Tide panel shows fixed **award**, actual delivered, still owed and collected counts, not a time-driven fake delivery count. Tower delivery counts advance only when actual supported bodies are handed to physics.

### Real supported-stack tower prototype

The obsolete loose-coin roof chute is removed from the active scene. Both the 20/30-medal tower prizes and a released bank now use a visible construction lift:

1. Individual, normal-size medal bodies descend from a construction head onto a split support cradle.
2. Up to four ten-medal columns are built. The assembly lowers toward the real moving shelf.
3. The cradle opens. **The same Rapier bodies** become dynamic; gravity, the visible support and ordinary shelf/medal contacts can push, rotate and topple them.
4. These coins use the ordinary field, side-loss and tray-contact rules. No immediate wallet credit, replacement spray, hidden nudge or coin teleport is added after handoff.

The upper five-medals-per-ring display is explicitly a **reserve**, not a claimed physical toppling tower. A committed reserve release becomes actual construction below it. Large awards remain FIFO requests in batches of at most 40; the remainder is retained. Limited capacity produces smaller valid stacks rather than deadlocking a partially built batch. A real Rapier swept-volume query waits for obstructing balls/upright coins before lowering. Waiting for space is visible; nothing is deleted to clear the route.

This is a deliberately bounded first tower mechanism, not a claim that every enormous bank will clear instantly or that every delivered coin is guaranteed to be collected.

## Preserved play and safety

- **Front** is at standing eye height and looks slightly upward, with a full-playfield projection fitter that never puts the lens below the deck. Overview/side views show peripheral equipment. All three full wheel faces stay side by side.
- Sanctuary daylight, sky-blue/pink shell, trees, lighthouse, KONO, wood bed and green shelf remain. There is no substitute 2D playable renderer.
- Drag the nozzle or deliberately tap/drag the field to aim. Hovering does not aim. A/D or arrows aim; DROP/Space hold a steady feed. Camera editing disables aiming and medal spending; Lock view restores normal play.
- Input ownership, no catch-up burst, pointer cancel/lost capture, blur, modal and runtime-failure cancellation are preserved. Fullscreen, responsive framing and reduced-motion behavior remain.
- **Options/review and hidden tabs pause both rules and physics**, retaining selected results, queues and bodies without reroll. Ordinary bonus presentation does not pause play.
- **End round** now asks explicitly before discarding pending work and uncollected material. This browser-local session is **not saved across reloads or leaving**. Runtime failure recovery still starts a clearly fresh 100-medal round; it does not pretend to recover a partial payout.
- Practice remains optional and sticky for the round: Try JP · 100, Run ball, Ball lottery, Grow +20, Release tower and 12 medals use actual routes. They never fabricate favorable wheel outcomes or directly credit the hand.

## Rules deliberately not rebalanced

The exact `WHEELS`, `ODDS`, `DISH`, five-lamp goal, bank start 20, five medals per layer, jackpot start 100, twelve JP pockets, combo/Fever amounts and side-return ball rule are retained. This release changes queue loss, presentation scheduling and delivery mechanics, not per-draw award weights. Readable result dwell affects throughput, not selection probabilities. No odds from a Japanese commercial cabinet are invented or copied into KONO.

The supplied **KONO Medal Cove Japanese Pusher Research** report motivated the release: explicit activations, distinct delivery/collection, one complete ball route, and real construction/release before extra spectacle. It is a KONO design improvement, not a replica of any named Japanese machine.

## Files and regression evidence

- `src/store/pusher.ts`: lossless activation counters, original payout tables, result holds, serialized ball/JP lane, committed field-award quantities.
- `src/store/delivery.ts`: independent pending-work inventory, aggregate conservation and ball-progress contracts.
- `src/store/tower.ts`: real Rapier supported construction, source-preserving requests, capacity/sweep backpressure, same-body release.
- `src/components/MedalCove.tsx`: active 3D cabinet, physical settlement, provenance, matching support meshes, live status and hardened input.
- `tools/test_gameplay.cjs`: activation pressure, 50 complete ball/JP chains, immutable pause state, pending inventory, 321-medal blocked delivery, unchanged tables and production wiring.
- `tools/test_tower.cjs`: actual Rapier build/lower/support/release/topple, same-body/material conservation, pressure and performance fixtures.
- Existing rule, delivery, contact/no-drift, framing and input/Practice suites remain in `npm test`. The obsolete chute fixture was replaced with a route-wiring regression; actual new tower behavior is tested in `test_tower.cjs`.

The original stationary-bed changes remain: vertical-only gravity, fixed 1/60 step, eight solver iterations, no hidden turntable/conveyor or pin velocity kicks. Medal/ball material settings are tested simulation tuning, not measured real-world constants. Prior fixtures verify zero planar drift for an isolated resting medal/stack, contact-driven shelf motion, 93 pin-board aim paths, complete-hull framing and Front-view geometry.

## Verification boundary

The pre-Tide baseline suite contained **75 passing groups**, retained with intentional fixtures updated for the new JP path and compact reserve hull: the 58 original rule, delivery/contact, motion, framing, input/Practice, gameplay and physical-tower groups, plus 4 shortened-shelf transfer, 4 actual-scene geometry, 1 actual production-loop and 8 lockable-camera groups. The historical live-baseline 222-medal/two-support CPU fixture measured about 0.38 ms median / 0.82 ms p95. The current fixture contains 264 medals after extending the seed bed; timings vary by run and remain CPU-only measurements. Those historical build results are not a claim that the current candidate has been published.

Tests use the installed Rapier and Three.js geometry, not a fake gameplay simulation. A separate reviewer also executed the actual production scene/loop with GPU rendering disabled: 65 tower plus 57 other awarded medals fully handed off (122 awarded = 122 delivered = 122 live), with exact per-frame reconciliation and pause/resume. This is physics/control-flow evidence, not visual WebGL evidence. CPU timing is measured in this cloud test environment only; it is **not** an Android/GPU frame-rate claim. Historical live-baseline long seeded tower stress probes advanced tagged medals roughly 7.8–8.1 world units but did not observe a tower-origin medal reach the front tray before their body-cap stopping condition. Same-body release/topple and the shared ordinary tray-contact path are verified separately; end-to-end tower-origin collection is not claimed. The cloud browser has no WebGL, so live 3D appearance, subjective feel and device thermal/touch performance require a WebGL-capable browser. Honest fallback/UI layout can still be inspected. The mechanism review is explicitly an illustration, not playable or evidence of rendered physics.

The earlier Canvas mockup remains historical Git commit `62e08c7fa0a285382f824466f6aa819a69f13130`, not the active app.

### Eye-level regression evidence (November 2026)

The production scene itself is exercised with GPU drawing stubbed. At 1080×790 and 390×550, the camera is at y = 1.7 and its world direction points upward. All 63 sampled points on the actual falling-medal face plane above the catcher mouths are clear of opaque cabinet triangles. More than 130 initial medal tops, including at least 20 front-row medals, remain visible after ordinary coin-on-coin depth occlusion; no camera layer hides the coins or gantry. Front → Overview → Front restores the intended full-hull framing. These are Three.js projection/raycast results, **not rendered screenshots or a subjective appearance claim**.

The production loop also checks every frame while 65 tower medals and 57 side-feed/rain medals hand off: 122 awarded = 122 delivered, with no pending supply, exact live-body reconciliation and unchanged hidden-tab/options pause/resume. All 9 tower groups still pass with the shorter shelf, including ball obstruction, support contact, same-body release/toppling and occupied-lift recovery. GPU appearance and device performance still need a WebGL-capable browser.

### Lockable-camera regression evidence

`tools/test_camera.cjs` checks real Three.js projection, finite/bounded and failed-storage handling, one-/two-pointer gesture rebasing, and the actual production scene's registered pointer/wheel/keyboard handlers. It verifies edit-time DROP/Space/aim gating, held-feed cancellation, lock/Unlock/Escape/Reset, exact pose retention during reserve growth and resize, React control callbacks, and saved-pose reload at another aspect ratio. These CPU tests deliberately stub GPU rendering; they do not certify rendered appearance or device touch/frame-rate performance.

### Sanctuary Tide verification boundary

New suites exercise the real Rapier gates (`test_tide.cjs`), parked cradle sweeps (`test_tower_park.cjs`), reversible production camera and dense actual-scene obstruction (`test_whole_route.cjs`), complete software outcome maps/React markup (`test_bonus_presentation.cjs`), independent reward/gate contracts (`test_sanctuary_tide.cjs`), and actual integrated production callbacks, pause, queued rights and same-body seeded-board contact (`test_sanctuary_runtime.cjs`). The aggregate ledger still checks every holding location independently. A fixture that moves a released medal to the collection tray verifies collection accounting only; it is not a claim that a spontaneous entire JP reaches the tray.

No GPU screenshots, real-phone frame rate, thermal performance, touch usability, perceived excitement, or player comprehension are certified in this cloud environment. The approved concept is implemented and simulation/geometry-tested, but rendered appearance and feel still require a WebGL-capable phone. No full-bed resize or new jackpot family is included.

The precise-gate production fixture demonstrated genuine pile backpressure at 69 of a 100-medal center sample after passive simulation. Continuing with ordinary available-hand DROP completed the same 100-medal request; no force, teleport, deletion or fabricated collection bypassed the blockage. A separate gravity-trough and within-bay-stagger comparison performed worse and was rejected; neither prototype is part of the release.

## Board Clear bonus (2026-11-02)

- Every **earned Jackpot Chance win** now also grants one optional **Board Clear**. This intentionally adds bonus value without changing a draw, outcome table, jackpot amount, or RNG consumption. The player chooses when to use each token; repeated clicks cannot reuse one.
- **Practice → Board Clear** offers one explicitly labeled sample per round, without consuming an earned token or pretending to win a jackpot. Further samples need a new practice round.
- The clearly labeled **magnetic sweep** is a special powered collection effect, not ordinary pusher physics. Cyan halos show energized medals. The collector steers the same dynamic Rapier bodies with bounded impulses and gradual leveling torque along collision-queried routes, then releases them over distributed positions in the real front tray. It never teleports a target, disables its contact, credits the hand, or deletes an uncollected target. An obstructed target remains present and owed.
- The request takes effect at a completed simulation boundary. Rules/draw time, incoming feeds, ball-rail motion, tower/Tide/bucket machinery and their queues pause. Balls, held-but-not-delivered reward bodies, and already-consumed pocket inputs retain their physical pose and resume afterward. Loose delivered medal bodies (including not-yet-captured pin-board inputs) join the sweep; their original IDs and reward/Tide provenance stay intact.
- Only the existing upward-facing tray-contact settlement adds hand/won/reward-collected credit, once. Targets remain visible resting in the tray, then return through the existing grate. Fresh starting stock is seeded **only after every original target has been collected and retired**. It is not an award, is not immediately credited, respects the body budget, and avoids preserved balls/held supply/the stopped shelf.
- Hidden tabs and Options pause the entire bonus. Camera editing pauses collection while keeping camera controls usable; it does not replace or save a new camera. End round explicitly warns that an active sweep and unused clears will be discarded. Round state, including tokens and an active sweep, remains browser-local and is not restored after reload; only the pre-existing camera preference is saved.
- The original single scene, saved camera, three HUD wheels, ordinary contact-driven pusher, Sanctuary Tide conservation and independent supply ledger are retained. CPU production tests run real Rapier/rules/React-tree code with GPU painting stubbed; they are not pixel validation.

### KONO character reward scene
The Ball Chance console now uses the existing KONO sprite sheets to act out a captured-ball adventure: wave, carry the ball across the Sanctuary, open treasure and celebrate the authoritative reward. This is procedural sprite animation, not a video file or a physical lottery. Simulation frames drive movement; pause/hidden state freezes it, reduced/off motion uses still poses. The outcome map and launch controls remain accessible. No physics, timing, odds, board sizing or wheel changes.
