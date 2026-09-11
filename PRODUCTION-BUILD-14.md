# KONO Production Build 14 — Subject-Linked Pond Evolution 1.0

Production Build 14 adds the second active task-driven Sanctuary landmark.

## Koi pond progression

Science and marine-science task completions now permanently advance the pond:

- Stage 0 — Still water
- Stage 1 — First ripples
- Stage 2 — Lily shimmer
- Stage 3 — First koi
- Stage 4 — Koi pair
- Stage 5 — Living pond

Thresholds are 0, 1, 2, 3, 5, and 8 credited science tasks.

## Art direction

This build does not replace the approved painted pond with a generic object sprite. It preserves the existing phase-specific water artwork and adds restrained, low-opacity life beneath and above the water:

- smaller progression-aware ripple timing
- subtle lily glints
- underwater koi shadows
- reduced-motion support
- rain and darkness response

## Progression architecture

- Progression schema upgraded from version 2 to version 3.
- Subject names are normalized into stable progression categories.
- Existing saves migrate automatically.
- Science credits remain permanent even when a completed task is later reopened.
- Duplicate completion credit remains blocked.
- Tree and pond progression remain independent per study profile.

## Validation

Run:

```bash
npm install
npm run validate
npm run build
npm run dev
```
