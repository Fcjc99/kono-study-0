# KONO Production Build 17.2 — Evolution QA & Bamboo Lighting Fix

This corrective build addresses the TypeScript errors reported in Build 17.1, improves Bamboo Grove daylight integration, and adds subject-level bulk-completion controls for testing Sanctuary evolution.

## TypeScript build fixes

- Removed the unused `ASSET_WIDTH` constant from `BambooEvolutionSystem`.
- Replaced the invalid `quality === "medium"` branch with the supported `high | balanced | low` quality model.
- Removed the unused `sceneBounds` property from `PondEvolutionSystem`.

## Bamboo integration

- Brightened the afternoon bamboo palette so it no longer appears nearly black against the sunlit island.
- Increased daylight saturation and local terrain blending.
- Retuned morning, evening, and night grading from the brighter authored baseline.
- Preserved the thinner, irregular stalk silhouettes and terrain-integrated base from Build 17.1.

## Subject evolution testing

Each Subject workspace now includes a **Complete all** button.

- Completes every unfinished assignment in that subject in one action.
- Credits each assignment exactly once through the normal Sanctuary progression engine.
- Uses each assignment due date for bulk-test completion history, allowing productive-day lantern progression to be tested.
- Changes to **Reopen all** when the subject is fully complete.
- Reopening tasks does not erase permanent Sanctuary growth credits.
- The panel explains which Sanctuary feature the selected subject affects.

### Progression reminder

- Every subject advances the cherry tree, cottage, and garden.
- Spanish/language assignments advance the Bamboo Grove.
- Science and Marine Science assignments advance the pond.
- Lantern progression is based on productive completion days.

## Validation

- 43 TypeScript/TSX files passed syntax validation.
- Environment, tree, pond, home, lantern, garden, critter, bamboo, and foundation validators passed.
- New Evolution QA validation passed.
- Full npm installation remains blocked in the packaging environment because the configured package registry returns 404 for `@eslint/js`.
