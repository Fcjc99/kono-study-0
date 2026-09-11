# KONO Production Build 12 — Foundation Lock & Evolution Hooks

## Purpose

Lock the Living Sanctuary foundation and prepare permanent, profile-scoped task-driven evolution without changing the painted map yet.

## Progression foundation

- Added a versioned `SanctuaryProgressState` for every study profile.
- Existing profiles migrate safely when the application loads.
- Existing completed tasks are credited during migration.
- Every task can earn progression credit only once, preventing repeated check/uncheck farming.
- Reopening a task updates the current completion count but does not erase earned world history.
- Subject credits, completion dates, total credits, stage readiness, and feature stages are stored separately.
- New profiles automatically receive an isolated Sanctuary save.
- Restoring the Summer 2026 plan preserves its Sanctuary progression.

## World-engine hooks

- React sends progression directly to Phaser through `SANCTUARY_EVENTS.progress`.
- Removed the Sanctuary scene's four-second localStorage polling loop.
- Landmark progress now reads the active profile's progression snapshot.
- Environment state and progression state are independent:
  - Environment: time, weather, wind, lighting, water.
  - Progression: task credits, milestones, unlocked stages, future feature stages.
- The F8/mobile debug panel shows current stage, ready stage, and next task threshold.
- Progression remains hidden in the normal Sanctuary and is visible only in the F8/mobile debug console.

## Stage thresholds prepared for Evolution 1.0

- Stage 0: 0 tasks
- Stage 1: 3 tasks
- Stage 2: 8 tasks
- Stage 3: 15 tasks
- Stage 4: 25 tasks
- Stage 5: 40 tasks

Production Build 12 only records readiness. Production Build 13 will introduce the first visible growth sequence and decide when a ready stage becomes permanently unlocked.

## Foundation QA retained

- Live ZIP-code weather remains profile-scoped.
- Weather cache/fallback behavior remains intact.
- Rendering pauses while hidden or offscreen.
- Reduced Motion and quality tiers remain supported.
- Production environment asset validation remains part of `npm run validate`.
