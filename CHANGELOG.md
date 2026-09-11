# Production Build 21.9 — Bridge Fishing Functionality

- Added interactive Garden Bridge fishing loop with cast, bite, reel, catch, and miss states.
- Added transparent full-map idle/cast fishing PNG overlays and reused the existing Sanctuary ripple asset.
- Added per-profile catch persistence and best-catch tracking.
- Preserved Build 21.8 terrace, pond/koi, critter, garden, and Stage 0 phase assets byte-for-byte.

# Production Build 19.1 — Home Layering & Compact Landmark Popups

- Replaced overlapping multi-house home stages with one cottage sprite per stage.
- Kept the painted starter cottage for stage 0 and aligned stages 1–5 over its footprint.
- Regenerated 24 phase-specific home textures.
- Replaced full-window landmark modals with compact 350px cards.
- Added explicit X close, rapid-click protection, and landmark-to-landmark content switching.

# KONO Production Build 15.3 — Tree Phase Integration Pass

- Rebuilt tree phase textures from the painted map palettes.
- Removed legacy mound cover overlays.
- Added feathered ground integration, phase crossfades, and phase-aware petals/shadows.

# KONO Production Build 15.2 — Cherry Tree Integration Polish

- Expanded the cherry-tree runtime canvas and added a visible stage-by-stage scale curve.
- Registered every stage to one root point and corrected the center placement.
- Added phase-matched cover plates that remove the baked stage-0 mound beneath the evolving tree.
- Darkened and regraded morning, evening, and night tree assets for better map integration.
- Added a subtle ground shadow and restrained continuous petal drift for mature stages.
- Preserved progression thresholds, profile saves, weather, pond, home, and lantern systems.

# KONO Production Build 05 — Sky, Wind & Atmosphere Depth

- Added a production cloud library derived from approved KONO artwork.
- Added multi-depth cloud parallax driven by shared wind and weather state.
- Removed the duplicate procedural weather-cloud field.
- Added moving cloud shadows, restrained mist, and morning/weather haze.
- Added a modular vegetation wind system with quality and Reduced Motion scaling.
- Moved waterfall mist ownership from FluidSystem to AtmosphereSystem.
- Added a reproducible atmosphere asset generator and manifest.

# KONO Production Build 01 — Sanctuary Production Foundation

- Moved water animation into a dedicated `FluidSystem`.
- Added 96 paint-matched ocean, pond, waterfall, and foam frames.
- Added a reproducible production-water generator and manifest.
- Added the F8 World Debug Console with FPS and fluid controls.
- Lazy-loaded Phaser and the Sanctuary scene.
- Removed the superseded procedural and broad-crop water system.
- Added the Production Art Bible, research notes, and quality bar.

# v0.95.1 — Weather Presence Pass

- Increased Cloudy, Rain, Breezy, and Snow visibility.
- Connected the debug density control to persistent weather particles.
- Added slow world-space cloud banks for Cloudy, Rain, and Snow.
- Added continuous wind-driven leaf movement for Breezy weather.
- Increased rain and snow density while preserving mobile performance scaling.
- Increased rainy pond-ripple frequency.

# KONO Changelog

## v0.7.8 — Sakura Refinement

### Added
- Signature Bubble Star completion celebration with a glass-star pop, glitter burst, Sakura particles, and completion sound.
- Daily schedule notes directly inside the Sanctuary schedule.
- Schedule notes automatically appear on the Notes corkboard and remain editable from the Notes page.
- Unified three-stat hero summary for tasks, exams, and notes.

### Improved
- Full typography audit using one consistent interface family and one display family per theme.
- Cleaner, more organized Sanctuary hero banner while retaining all useful information.
- Stronger Sakura visual language across page heroes, cards, corkboards, buttons, and illustrations.
- Professional theme redesigned throughout as a restrained Apple-inspired interface with neutral surfaces, minimal decoration, clean cards, and subtle completion feedback.
- Bubble Star completion controls are now used in Sanctuary and Subject task lists.
- Mobile hero, schedule-note editor, and celebration sizing refined for small screens.

### Removed
- Decorative Sakura artwork from Professional theme surfaces.
- Mixed display-font treatment outside intentionally handwritten sticky-note styles.

## v0.95.0 — Living Sanctuary Foundation

- Replaced the static Sanctuary image with the production Phaser world.
- Added continuous four-phase time blending with two-hour-style transition windows.
- Added layered lantern, dew, ripple, ambient flora, and weather systems.
- Added Clear, Cloudy, Rain, Breezy, and Snow ambience.
- Added mobile performance scaling and reduced-motion behavior.
- Added hidden world-debug controls via `?sanctuaryDebug=1`.
- Connected Sanctuary growth hooks to the active KONO application storage.
- Kept the custom companion intentionally out of this release.

## Production Build 01.1
- Fixed FluidSystem constructor compatibility with TypeScript `erasableSyntaxOnly`.


## Production Build 03 — Fluid Production Calibration
- Rebuilt fluid assets as transparent phase-matched overlays.
- Fixed phase mask coverage and waterfall consistency.
- Replaced oversized diagonal waves with short horizontal highlights.
- Slowed the production fluid cadence.
- Removed generic morning sparkle particles.

## Production Build 04 — Fluid Motion Recovery
- Replaced faint highlight-only ocean frames with displaced painted-water frames.
- Increased water-body movement while retaining calm horizontal flow.
- Rebuilt waterfall with a solid shared silhouette across all four phases.
- Removed center-split and rock-remapping waterfall artifacts.
- Expanded each fluid loop from 8 to 12 frames.
- Adjusted frame interpolation so motion remains readable instead of averaging into stillness.

## Production Build 06 — Lighting & Time Transitions
- Added continuous daylight profiles and a modular LightingSystem.
- Added progressive lantern, star, haze, cloud, vegetation, mist, and water-light responses.
- Replaced ghost-prone map crossfades with a concealed single-map transition.
- Expanded F8 lighting and phase diagnostics.

## Production Build 07 — Integrated Weather Simulation
- Added staged weather arrival and recovery through a dedicated WeatherManager.
- Added pooled rain, snow, breeze, and weather-shade rendering through WeatherSystem.
- Connected cloud cover, wind, precipitation, lighting, mist, water, vegetation, and pond ripples to one shared weather state.
- Added natural rain tapering, lingering clouds and water response, calmer snow water, and gust-wave breezy behavior.
- Expanded desktop and mobile world-debug controls for weather tuning and live simulation readouts.
- Removed weather-particle lifecycle logic from Stage0Scene.

## Production Build 08 — Environment Cleanup & QA

- Rebuilt fluid masks to prevent rocks and shoreline pixels from entering animated water.
- Standardized all runtime waterfall animation on one neutral water-only frame set.
- Reduced runtime fluid texture loading from 192 frames to 48 frames.
- Reduced public fluid asset size by approximately 75%.
- Removed redundant background, dew, and transition code from `Stage0Scene`.
- Reduced hidden React telemetry and resize overhead.
- Added mobile safe-area and canvas framing refinements.
- Added repeatable environment and TypeScript validation commands.

## Production Build 12 — Foundation Lock & Evolution Hooks
- Added versioned, profile-scoped Sanctuary progression saves.
- Added one-time task-credit protection and stage readiness thresholds.
- Added direct React-to-Phaser progress events.
- Removed Stage0Scene localStorage progress polling.
- Added progression readouts to the Sanctuary and World Debug Console.
- Added migration and foundation validation tooling.
## Production Build 13.2 — Approved Tree Sprite Integration
- Replaced the active generic placeholder tree renderer with `TreeEvolutionSystem`.
- Connected the approved phase-specific cherry-tree sprite set for all six growth stages.
- Added phase switching for the evolution sprites during live time-of-day changes.
- Preserved a common root anchor so each stage grows from the same dirt mound.
- Removed the retired placeholder renderer and its generic tree assets from the production package.


## Production Build 14 — Subject-Linked Pond Evolution 1.0
- Upgraded Sanctuary progression saves to schema version 3.
- Added stable subject-category credits and automatic migration from previous saves.
- Connected science and marine-science completions to six permanent pond stages.
- Added progression-aware ripple timing, lily shimmer, and underwater koi shadows.
- Preserved the approved painted pond and all four phase-specific water animations.
- Added pond landmark progress, debug diagnostics, reduced-motion support, and validation tooling.

## Production Build 16 — Garden & Critter Foundations
- Added permanent six-stage garden progression at 0, 4, 10, 18, 30, and 45 task credits.
- Added fixed garden anchor zones around the cottage, tree, pond, terrace, bridge, and lower island.
- Added short ambient butterfly, dragonfly, frog, bird, and moth visits.
- Added weather, phase, performance, density, and Reduced Motion safeguards for wildlife.
- Added schema version 5 migration, Garden landmark details, and debug diagnostics.


## Production Build 17 — Bamboo Grove & Habitat Evolution
- Upgraded Sanctuary progression saves to schema version 6.
- Connected Spanish and language-study credits to bamboo thresholds at 0, 1, 2, 3, 5, and 8.
- Added six authored bamboo stages and 24 phase-specific runtime textures.
- Added fixed-anchor stage and phase crossfades with phase-aware ground shadow.
- Added restrained leaf drift for established and mature groves.
- Added occasional bird landings near evolved bamboo.
- Added Bamboo landmark content, debug diagnostics, asset generation, and validation tooling.

## Production Build 17.1 — Bamboo Grove Art Replacement
- Replaced the bright circular bamboo mound with a smaller terrain-integrated grove.
- Added muted sage/forest palette, thinner irregular stalks, and phase-local color grading.
- Moved the grove right/lower beside the terrace and reduced shadow/leaf intensity.

## Production Build 18 — Structural Home Evolution
- Replaced procedural cottage decorations with six structural home stages.
- Added 24 phase-integrated home textures and shared-anchor crossfades.
- Added stage-aware home shadow and restrained chimney smoke.
- Preserved task thresholds, profile saves, Complete all testing, lanterns, bamboo, garden, critters, pond, tree, water, and live weather.

## Production Build 19 — Unified Evolution Transitions
- Added a central queue so bulk assignment completion evolves one map feature at a time.
- Added stable tree, home, garden, pond, bamboo, and lantern milestone ordering.
- Added subtle map-local milestone accents and compact stage-title notices.
- Added queue coalescing, profile-switch cancellation, and Reduced Motion immediate application.
- Updated public and debug version labels to Production 19.

## Production Build 22.7.21 — Terrace Crisp Native Pipeline
- Replaced the transparent-difference terrace reconstruction with clean full-map baked Sanctuary states.
- Restored crisp Stage 0–5 terrace geometry across Morning, Afternoon, Evening, and Night.
- Locked runtime to 24 direct full-map texture swaps with no terrace sprite/tint/glow overlay path.
- Added crispness, no-alpha, no-overlay, and non-terrace pixel-integrity validation.
