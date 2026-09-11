# Shared island registration — 22.8.4

User approved aligning Stage 0 on 2026-09-08. The original locked sources are retained unchanged.

Runtime assets live in `public/garden/registered-22.8.4`, a versioned namespace that cannot reuse old cached terrace files. QA displays the current version explicitly.

Afternoon is the canonical geometry. Every other phase is a pointwise RGB grade of exactly the same pixels; alpha is unchanged. This applies to all 24 base maps, all cottage/tree stages, vegetable garden, fishing kit, and every water animation frame. No independent phase image generation or phase-specific offset is allowed.

The existing 22.8.3 afternoon Stage 0 map supplies the road-seed cleanup. The existing afternoon ground plate clears the complete original terrace footprint once. Each of the five existing pixel-rendered transparent sprites is composited at left=960, bottom=552. No new artwork was generated in this revision. Binary terrace alpha is checked before compositing.

Rebuild with Node and sharp available: `node tools/terrace-22.8.4/build-registered.cjs PROJECT_ROOT OUTPUT_DIR`. Use a separate output directory, inspect, then copy to the registered runtime directory. Original inputs are never overwritten.

Run `python tools/validate_sanctuary_registration.py` (Pillow required) and `node tools/test_sanctuary_progression.cjs`. The registration test compares every pixel against the canonical phase grade, every alpha channel, and checks that upgrades change only the terrace footprint. Historical lock validators refer to older runtime builds and are not the current acceptance test.
