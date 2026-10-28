# Production Build 19.1 — Home Layering & Compact Landmark Popups

## Home layering

- Replaced the multi-building compound assets with one connected cottage sprite per stage.
- Stage 0 continues to use the cottage already painted into the island.
- Stages 1–5 now fully cover the painted starter cottage instead of stacking extra houses behind it.
- Re-anchored the home at source position 300 × 660 for consistent ground contact.
- Regenerated all 24 morning, afternoon, evening, and night home textures.
- Preserved the existing home progression thresholds and profile save data.

## Landmark information cards

- Replaced the full-sanctuary modal with a compact card capped at 350 px wide.
- Added a permanent X close control.
- Clicking outside no longer closes the card.
- Rapid duplicate clicks no longer make the card disappear.
- Clicking a different landmark immediately replaces the card content.
- Reduced text to stage, progress, short description, and next milestone.
