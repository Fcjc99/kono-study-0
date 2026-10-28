# KONO Production Build 22.7.40 — Pond + Sanctuary UI Stability

## Scope
This pass fixes the regressions reported after reopening assignments. It does **not** redesign the Lantern Terrace and does **not** change the approved Home or Cherry Tree artwork.

## Pond water alignment
- Root cause found: the animated pond/ocean/waterfall crops were still being generated from `public/garden/islands/stage-0`, while the actual runtime map now uses the user-restored locked files under `public/garden/islands/terrace-evolution/<phase>/stage-0.png`.
- Morning, evening, and night therefore placed an animation painted from a different source map over the restored Stage 0 pond.
- Regenerated all production-water frames from the exact runtime Stage 0 phase maps.
- No Stage 0 map pixels were changed.

## Koi restoration
- Stage 3 = 1 koi, Stage 4 = 2 koi, Stage 5 = 3 koi.
- Fish visibility now self-heals every update and every stage sync, including after reset/reopen and page sleep/wake.
- The three Stage 5 koi use one verified safe-water circuit with permanent ~1/3-lap spacing, preventing them from overlapping and reading as missing.
- Slightly increased readable size/depth without changing the pond artwork.

## Sanctuary sizing / interaction spacing
- Desktop Sanctuary frame is capped at 920 px wide in the native 4:3 ratio (about 690 px high) instead of expanding toward ~900 px tall.
- The time-of-day toolbar is centered to the same width as the Sanctuary for cleaner spacing.
- Landmark popup panels are vertically centered instead of pinned to the top of the canvas.
- KONO interaction text (for example `Rest at Home`) now appears in the visible center band instead of near the top edge, so it remains visible if the page is slightly scrolled.

## Protected content
- User-restored Stage 0 terrace maps: byte-identical / locked.
- Home evolution artwork: byte-identical.
- Cherry Tree evolution artwork: byte-identical.
- Terrace Stages 1–5: unchanged and still unapproved for later rebuild.

## Validation
- `npm run validate`: PASS.
- TypeScript/TSX syntax validation: PASS (47 files).
- Full `npm run build` cannot resolve `vite/client` and `node` because the supplied archive's dependency installation is incomplete; this is the same sandbox dependency limitation documented in prior builds.
