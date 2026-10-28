# KONO Production Build 15

## Home & Lantern Evolution 1.0

### Home progression
The painted cottage remains part of the original island artwork. Progression adds restrained details around it rather than replacing it with a mismatched full-house sprite.

Task-credit thresholds:
- Stage 0: 0 — Quiet cottage
- Stage 1: 10 — Warm doorstep
- Stage 2: 20 — Window planters
- Stage 3: 35 — Garden welcome
- Stage 4: 55 — Cozy home
- Stage 5: 80 — Sanctuary home

### Lantern progression
Lantern ambience grows from productive study days. A productive day is a calendar day on which at least one previously uncredited task is completed.

Productive-day thresholds:
- Stage 0: 0 — Resting lights
- Stage 1: 1 — First glow
- Stage 2: 3 — Home lights
- Stage 3: 5 — Lantern path
- Stage 4: 7 — Terrace lights
- Stage 5: 14 — Festival glow

### Save compatibility
Progress schema is version 4. Existing saves migrate automatically. Older saves with task credit but no recorded completion dates receive one migration day so their first lantern stage is not lost.

### Validation
Run:

```bash
npm run validate
npm run build
npm run dev
```
