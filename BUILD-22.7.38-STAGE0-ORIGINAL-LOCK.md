# KONO 22.7.38 — Stage 0 Original Lock Restore

Scope: Lantern Terrace Stage 0 baseline only.

## Restored and locked
The four user-supplied original Stage 0 full Sanctuary maps are now the exact runtime Stage 0 files:
- Morning
- Afternoon
- Evening
- Night

They are copied byte-for-byte into `public/garden/islands/terrace-evolution/<phase>/stage-0.png` and duplicated as recoverable lock sources under `public/garden/evolution/lanterns/source/locked-stage0-22.7.38/`.

`STAGE0-LOCK-22.7.38.json` records the exact SHA-256 hash, dimensions, mode, and paths for every locked phase. `tools/validate_build_22_7_38.py` fails if any Stage 0 runtime map or lock source changes.

## Stage 0 permanent rules
Do not redraw, recolor, resize, recenter, crop, tint, overlay, relight, or replace these four Stage 0 maps unless the user explicitly unlocks Stage 0.

## Stage 1 reset direction
The rejected 22.7.37 Stage 1 concept/QA folder has been removed from this build. Legacy Stage 1–5 runtime files remain only so the existing runtime asset paths are intact; they are NOT approved and are NOT locked. Future terrace evolution must be rebuilt from these restored Stage 0 maps.

No unrelated Sanctuary systems were intentionally changed.
