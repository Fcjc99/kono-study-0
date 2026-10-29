# KONO Production Build 19.2

## Original Cottage Restoration

This build removes the full replacement-house art introduced in Builds 18–19.1. The Sanctuary now keeps the original cottage painted into every time-of-day map as the permanent visual foundation.

Home progression is additive and uses registered 500×450 crops taken directly from the corresponding morning, afternoon, evening, and night maps. This prevents mismatched palettes, duplicated buildings, coarse night posterization, and visible replacement plates.

### Home stages

- Stage 0 — Original cottage
- Stage 1 — Covered entry
- Stage 2 — Side porch
- Stage 3 — Chimney cottage
- Stage 4 — Dormer cottage
- Stage 5 — Expanded sanctuary cottage

The existing thresholds remain 0, 10, 20, 35, 55, and 80 permanent task credits.

### Preserved

- Compact landmark cards with explicit X close
- Rapid-click protection for landmark cards
- Profile-scoped progress
- Complete All / Reopen All subject testing
- Cherry tree, pond, bamboo, garden, critter, lantern, weather, and fluid systems

### Validation

Run:

```bash
npm install
npm run validate
npm run build
npm run dev
```
