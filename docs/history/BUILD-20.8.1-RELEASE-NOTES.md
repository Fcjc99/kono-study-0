# KONO Production Build 20.8.1 — Home Roofline Occlusion Repair

- Corrected the final Stage 5 sprite anchor inside its 500×450 transparent canvas.
- Stage 5 visible alpha now starts ~48 px higher, matching Stages 1–4 and covering the original map-painted Stage 0 roofline.
- No opaque terrain rectangle or masking patch was added. The fix stays a clean transparent pixel-PNG replacement asset.
- Morning, afternoon, evening, and night Stage 5 sprites share identical alpha geometry.
- Stage 0–4 home assets are unchanged. Tree placement, pixel pond/koi, global lighting, progression thresholds, and bamboo removal are unchanged.
