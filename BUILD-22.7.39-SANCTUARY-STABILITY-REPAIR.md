# KONO 22.7.39 — Sanctuary Stability Repair

This pass intentionally does **not** redesign the Lantern Terrace. It stabilizes the Sanctuary before the Stage 1 terrace rebuild resumes.

## Fixed

### 1. Reopen-all now returns the Sanctuary to true Stage 0
- A populated profile with zero completed assignments now migrates to a fresh Stage 0 progression state.
- Reopening the final completed assignment resets lifetime credits, active-day credit history, and every feature stage to 0 immediately.
- A second guard in `syncCurrentTaskCompletion` repairs stale in-memory/saved progress when every assignment is reopened.
- Completing assignments again earns progression again from Stage 0 normally.

### 2. KONO mascot pathing repair
- Removed the invalid `(0.455, 0.600)` spawn point, which sat inside the pond exclusion ellipse.
- KONO now starts on the verified `west-junction` navigation node.
- Added a runtime safe-position recovery guard so an invalid position cannot trap KONO against the water exclusion check.
- Existing path graph, pond exclusion, bridge route, terrace route, house route, and interaction targets remain intact.

### 3. Level 5 koi restored as clearly visible swimming pond life
- Stage 5 still contains exactly 3 koi.
- Koi render above painted water/lily detail but below pond sparkles.
- Stage 5 koi scale is increased to 0.70x source size for better readability in the Sanctuary card.
- Evening/night koi visibility is strengthened without altering any base Sanctuary map artwork.
- Swim circuits remain calm but are now visibly moving (~50–70 seconds per circuit).

## Artwork protection
- The four user-restored Stage 0 terrace phase maps remain byte-locked by `STAGE0-LOCK-22.7.38.json`.
- All Home evolution and Cherry Tree evolution art files are byte-identical to 22.7.38 in this pass.
- The 20 legacy Terrace Stage 1–5 runtime maps are also byte-identical to 22.7.38 and remain **unapproved**. No new terrace art was created.

## QA
- Progression runtime test: complete tasks -> reopen all -> all feature stages return to 0: PASS.
- Stale saved progression + zero completed assignments -> migration resets to Stage 0: PASS.
- TypeScript/TSX syntax validation: PASS.
- Pond koi asset validation: 48 koi frames present and valid: PASS.
- Stage 0 original lock: PASS.
- Protected Home/Tree/Stage 0 art hash comparison: PASS.
- Legacy Terrace Stage 1–5 unchanged comparison: PASS.

The older Home/Tree/Terrace validators in this repository have historical assumptions that already fail on the 22.7.38 baseline (for example, older transparency/reference paths). The new 22.7.39 validator checks the actual locked 22.7.38 bytes instead, so those stale failures are not treated as regressions introduced by this build.
