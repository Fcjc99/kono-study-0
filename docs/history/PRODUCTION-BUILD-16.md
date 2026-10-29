# KONO Production Build 16 — Garden & Critter Foundations

## Purpose

Build 16 establishes permanent garden progression and sparse, behavior-based wildlife without changing the approved cherry-tree, pond, weather, fluid, home, or lantern systems.

## Garden progression

The garden advances from total permanent task credits:

- Stage 0 — Quiet grass: 0 tasks
- Stage 1 — First blooms: 4 tasks
- Stage 2 — Pathside garden: 10 tasks
- Stage 3 — Cottage garden: 18 tasks
- Stage 4 — Living sanctuary: 30 tasks
- Stage 5 — Flourishing garden: 45 tasks

Garden props use fixed anchor zones around the cottage, cherry tree, pond, terrace, bridge, and lower island. Existing profile isolation and one-time task credit protection remain active.

## Critter foundation

The Sanctuary can now host short ambient visits:

- Butterflies in morning and afternoon after the first garden stage
- Dragonflies near the pond after pond life begins to develop
- Frogs near the pond in evening and night
- Birds that arrive, perch briefly, and leave after later garden stages
- Moths around the lantern terrace in evening and night

Critters do not loop continuously. They appear, linger or travel briefly, and leave. Rain, strong wind, performance quality, ambient density, and Reduced Motion affect their availability and frequency.

## Art and layering

- Garden props reuse the cleaned painterly-pixel atmosphere library.
- Critters use compact transparent pixel sprites sized for ambient use.
- Garden assets receive live time-of-day and weather tinting.
- Critters render below weather foreground effects and above permanent garden layers.

## Save migration

The Sanctuary progression schema is now version 5. Earlier saves migrate automatically. The new `garden` feature stage is derived from permanent task credits and remains isolated per profile.
