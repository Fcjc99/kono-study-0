# KONO Production Build 09 — Cloud Readability Pass

## Focus
- Make sanctuary clouds readable and game-like instead of faint overlays.
- Improve sky depth across all phases and weather states.
- Preserve the existing living sanctuary stack while tuning only cloud visibility, scale, and motion.

## Changes
- Rebuilt the cloud layout into layered far / mid / front bands.
- Increased cloud scale so shapes read against the sky.
- Raised default visibility during clear weather so the sky never feels empty or static.
- Increased cloud density for cloudy, rain, and snow states.
- Added stronger phase-aware tinting for morning, evening, and night.
- Smoothed drift speeds so motion is readable without feeling floaty.
- Kept low and balanced quality modes by capping visible cloud count instead of disabling the whole system.

## Expected Result
- Clouds should now be clearly visible in morning and afternoon.
- Evening skies should feel fuller and warmer.
- Night skies should still show fewer clouds, but they should remain readable.
- Weather changes should read more clearly through cloud coverage.
