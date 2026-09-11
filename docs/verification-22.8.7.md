# Local visual release 22.8.7 — verification

Project: `C:/Users/jeffr/Documents/ChatGPT/KONO/KONO-PRODUCTION-BUILD-22.7.40-POND-UI-STABILITY`

Local QA: [http://127.0.0.1:5174/?sanctuaryQA=1](http://127.0.0.1:5174/?sanctuaryQA=1). Header must read `0.99.94-production-22.8.7`. No hosted deployment, account/backend setup, user-data migration, assignment completion or profile modification was performed.

## Changed

- Replaced terrace maps with 24 versioned maps using localized native-boundary ground reconstruction. No pixels outside the terrace repair zone change. The original four-phase skies, saturation and other map regions are retained.
- Removed the old night terrace's duplicate posts/bench fragments and final post-cap remnant. Daylight stage 0 maps remain unchanged.
- Increased Kono's scene-height ratio from 0.043 to 0.064 (about 49% larger). Added a 26px phone readability floor, capped to 12% of map height for tiny embeds. Shadow size follows the displayed mascot; foot anchors, routes, lighting and sleep behavior remain unchanged.
- Added the current terrace validator and expanded mascot size/anchor regression checks. Updated version files and included the production-readiness reports.

Previous edited text files were copied to `C:/Users/jeffr/Documents/ChatGPT/App/production-review-22.8.7/previous-22.8.6`. Old artwork families remain available; no source artwork was deleted. Removing archival assets from the deployment output remains a separate release task.

## Passed

- `npm run build`: TypeScript and Vite production build successful.
- `node tools/animation-regressions.cjs`: 18 navigation nodes, 324 complete pond-safe routes, 1,800 mid-route retargets, pause/invalid-delta limits, stable evening poses, preserved destination reactions, readable sizing/pose anchors, koi motion toggles and growth-petal cleanup.
- `node tools/test_sanctuary_lighting.cjs`: permanent night sleep, shaded mascot, morning wake, no interaction wakeups, six evening-light terrace stages, sun/moon transitions.
- `node tools/test_sanctuary_progression.cjs`: pure progression thresholds, duplicate credit, profile isolation and migration checks. This does not test all App.tsx persistence flows.
- `node tools/review-animation-regressions.cjs`: six evolution crossfade/retarget/order/interruption cases.
- `tools/validate_native_sanctuary.py`: the retained 280-asset native package, immutable source hashes, original sky/sun/moon colors, home silhouettes and water masks/motion passed before integration; integration does not alter those files.
- `tools/validate_terrace_ground.py`: 24 active 22.8.7 maps, unchanged exterior pixels, unchanged daylight stage 0, opaque full maps, binary terrace sprite masks and six distinct stages per phase.
- Browser: verified the 22.8.7 header; inspected stage 5 evening and night, night stage 0, phone-width night rendering and reduced-motion toggle. No browser console errors returned. The QA tab was left at stage 5, evening, desktop width, motion enabled.

Image validators were executed with the bundled Python runtime containing Pillow/numpy; dependencies must be pinned in a portable CI setup.

## Still failing / not verified

- Baseline `npm run lint`: 27 errors, 1 warning. This is not a fully green release.
- App-level data/security findings in the readiness reports remain unresolved. No claim of production readiness, account isolation, cross-device sync, or exhaustive glitch-free behavior is made.
- No hosted network/performance measurements, real-device compatibility matrix, browser heap profile, dependency vulnerability scan, or end-to-end account tests were performed.
