# KONO Production Build 22.7.18 — Terrace Baked PNG / No Lighting Overlays

Scope remains terrace-only.

## Hard lock
- 24 independent terrace Sanctuary PNG states: 6 stages × 4 phases.
- Morning: painted PNG, terrace practical lights OFF.
- Afternoon: painted PNG, terrace practical lights OFF.
- Evening: painted PNG, terrace practical lights ON.
- Night: painted PNG, terrace practical lights OFF.
- Runtime LightingSystem is state-only and renders no dark wash, cool wash, warm wash, tint, multiply layer, additive highlight, moon rim, sun glow, horizon glow, or other lighting overlay.
- Stage0Scene swaps directly to the correct full Sanctuary phase/stage PNG.
- No terrace runtime sprite overlay is used.

This build specifically removes the runtime lighting pass that was visibly washing the terrace after the phase PNG had already been painted.
