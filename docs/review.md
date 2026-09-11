# Production readiness audit — 22.8.6 snapshot

Read-only audit of `C:/Users/jeffr/Documents/ChatGPT/KONO/KONO-PRODUCTION-BUILD-22.7.40-POND-UI-STABILITY`. No source/build/browser/user-data mutations. Local production outputs were inspected; no fresh deployment, network latency test, browser heap profile, or dependency vulnerability scan was performed.

## Highest priorities

### P1 — Stop loading the entire graphics catalogue before the first frame

`src/game/scenes/Stage0Scene.ts:117` preloads all four phases and all six full-map stages. `src/game/systems/FluidSystem.ts:30` preloads 4 phases × 4 layers × 12 frames. Tree/home and other systems are also preloaded unconditionally. Quality is first applied in `Stage0Scene.ts:145`, after this allocation decision.

Executing the actual preload method against a recording loader, without constructing Phaser or accessing a browser, yields **429 texture registrations, 414 unique image URLs, 162,689,184 bytes of unique PNG payload**. The registered textures contain **505,083,388 bytes (481.7 MiB) of RGBA pixel data**. This is a calculated pixel footprint, not a browser heap/GPU measurement; decoded image copies and GPU resources can add costs. Every referenced file exists.

| Group | Textures | Encoded bytes | RGBA pixel bytes |
| --- | ---: | ---: | ---: |
| Full maps | 24 | 56,417,527 | 150,962,688 |
| Water animation | 192 | 98,825,463 | 223,069,056 |
| Trees | 24 | 3,251,204 | 38,688,000 |
| Home/related | 40 | 2,772,625 | 33,313,824 |
| Other | 149 | 1,576,224 | 59,049,820 |

Practical first change: load the current phase/current unlocked stage first, then load the next phase/stage on demand; use a reduced water frame/resolution budget on small devices. There are also 15 repeated URLs loaded under different texture keys, including grass and pond decorations. A texture alias/shared key avoids duplicate decode/upload even when HTTP caching saves transfer. Preserve the artwork; the loading policy is the main problem.

### P1 — Offscreen navigation can leave an entire Phaser game undisposed

`src/components/GardenCard.tsx:229` calls `game.loop.sleep()` when the canvas leaves the viewport. Cleanup disconnects the observers and visibility listener, then calls `currentGame.destroy(true)` at line 270 without waking the loop. In the installed Phaser implementation, `node_modules/phaser/src/core/Game.js:712` only sets `pendingDestroy`; actual destruction occurs in `step` at line 456 and `runDestroy` at line 729. `node_modules/phaser/src/core/TimeStep.js:781` stops RAF when sleeping.

Concrete trigger: scroll below the Sanctuary, navigate to Notes/Subjects, then return. A sleeping game has no scheduled frame to process its destruction, and the app has removed its own wake listeners. This can retain the renderer, listeners and large texture allocations. Queue destruction and ensure a frame can run; verify the Phaser `DESTROY` event after offscreen unmount, not merely removal of the React canvas parent.

### P1 — Saved notes render unsanitized HTML

`src/App.tsx:263` stores note `body: body.trim()` from the textarea. Formatting controls intentionally insert raw `<b>`, `<i>` and `<mark>` markup at line 266. `StickyNoteView` uses `dangerouslySetInnerHTML` at line 127 with no sanitizer. Pasted HTML can therefore add event-bearing elements or arbitrary page content; the result persists in local storage and also renders in pinned Sanctuary notes. An injected event handler executes with access to same-origin planner data.

Practical change: sanitize an explicit formatting allowlist before rendering/saving, or store structured rich text and render its supported marks as React elements. Keep the existing bold/italic/highlight feature; reject event attributes, scripts, external embeds and unintended CSS. Include a regression test for event-handler HTML saved through the note editor. This is a local input-to-DOM finding, not a claim of an externally exposed server endpoint.

### P1 — Storage failure can crash saving, and recovery can overwrite data

`src/App.tsx:145` calls `localStorage.setItem` in an effect without a guard or error UI. Quota exhaustion or blocked storage throws through the application after an edit. Separately, `load()` at line 80 catches parse/migration failures and returns the seed plan; the same mount effect then writes that seed over the prior value. There is no export/backup/recovery UI in the current app.

Practical change: centralize validated loading and guarded persistence, retain the raw failed payload for recovery, and show a visible unsaved warning with an export option. Do not automatically overwrite a failed-to-load store. Add tests using an in-memory storage stub that throws on writes and returns malformed JSON; no user storage needs to be touched.

## Next priorities

### P2 — Sanctuary features have no keyboard or screen-reader equivalent

`src/game/scenes/Stage0Scene.ts:702` creates pointer-only landmark rectangles; lines 714 and 940–959 wire opening, actions and close controls to `pointerdown`. `src/components/GardenCard.tsx:338` supplies only a nonfocusable div/canvas with an aria label. The label does not expose the landmark controls, fishing, or context actions.

Add a compact DOM landmark/action list synchronized with the canvas state, with native buttons and a DOM dialog or equivalent accessible popup. Keep pointer interaction intact. Test opening a landmark, triggering an action and closing using keyboard alone.

### P2 — Startup and capability failures leave a blank Sanctuary

`src/components/GardenCard.tsx:140` imports Phaser and the scene asynchronously; line 257 invokes `void boot()` without catch/error state. There is no asset load-error handler or visible retry/loading state. `new ResizeObserver` at line 222 and `new IntersectionObserver` at line 235 are unconditional. A rejected chunk request or unsupported observer throws with no product fallback; failed image loads also have no user-facing recovery.

Add loading progress, catch/report boot failures, use a static current-phase image fallback, and retry deliberately. Feature-test observer APIs and fall back to window resize plus visibility handling where needed. Confirm behavior for blocked chunks, an image 404 and disabled/unavailable rendering; no need to simulate those against user data.

### P2 — Production artifact includes obsolete source/history assets

Measured `public`: **1,202 files / 597,029,163 bytes**; existing `dist`: **1,207 files / 599,134,444 bytes**. The old `public/garden/registered-22.8.4` directory alone contributes **151,391,078 bytes / 277 files** despite no references in `src`. Current scene/system paths point at `registered-22.8.6`. Additional original/source families are also copied into the static output.

Use an explicit production asset allowlist or move archival source inputs outside the deployable public tree. Keep archived artwork in the repository. This reduces deployment/storage size; do not confuse the full 599 MB build size with first-visit network transfer. Add a budget check and missing-reference validation to the build.

Existing chunk measurements (raw / locally gzipped): app JS 307,481 / 89,512 bytes; Phaser 1,375,290 / 356,128; scene 123,025 / 33,011; CSS 299,025 / 55,088. Lazy Phaser import is already present. The image footprint dominates the startup problem.

### P2 — OS reduced-motion preference is ignored by the canvas

`src/App.tsx:38` defaults `reducedMotion` to false. It is passed directly into GardenCard and Phaser; no JavaScript `matchMedia` usage exists. CSS media queries reduce DOM animation, but they cannot reduce canvas animation. Initialize from `prefers-reduced-motion` when no explicit user override is stored, and respond to preference changes with the existing motion event.

### P2 — Desktop/mobile music controls represent separate players

`src/components/Sidebar.tsx:18` renders the supplied `musicPlayer` both in the desktop sidebar and mobile header. Each position mounts a separate `MusicPlayer`, whose playing state and audio element are local (`src/App.tsx:174–180`). CSS hides one presentation but does not combine player state. Start desktop music then cross the responsive breakpoint: the visible controls can say paused while the hidden player continues; pressing play can create overlapping playback.

Own one audio element/state above both layouts, and render synchronized controls for it. Verify a resize while music is playing.

## Small follow-ups

- Command palette: `src/App.tsx:170` advertises arrow-key navigation and Enter-to-open, but the global handler at line 149 only implements Ctrl/Cmd-K and Escape. Add active result selection, ArrowUp/Down/Enter handling, dialog semantics, a focus trap and focus return.
- Undo timers: App.tsx lines 225, 246, 264 and 273 create timers without unmount cleanup. These are bounded short-lived timers, not the large resource leak above. Reuse a small undo hook with cancellation; decide whether undo should survive navigation.
- Privacy: the client bundle includes the seeded student name, profile dates, daily routine and default weather locations (App.tsx:35–58). Live weather is enabled by default and sends the configured place to Open-Meteo (`src/game/weather/liveWeather.ts:130`, `:140`); Google Fonts is loaded externally (`src/App.css:1`). Before broad distribution, decide whether personal seeds should become generic onboarding, make external weather behavior clear, and consider self-hosted fonts. Actual hosted response/security headers were not inspected, so no claim is made that they are absent.
- Weather cleanup already aborts requests and removes its timer/listener on unmount. The scene shutdown method explicitly destroys its systems. Keep those existing paths; the main lifecycle defect is getting the queued game destruction to run.

## Evidence artifacts

`measure-preload.cjs` transpiles local TypeScript in memory, substitutes a recording loader, and executes only the actual scene preload method. It does not create a browser/game, fetch URLs, or modify project files. `preload-inventory.json` contains every key/path/dimension; `preload-measurements.json` contains the aggregate sizes and duplicates. These scripts and this report are the only audit outputs, under `App/production-review-22.8.7`.
