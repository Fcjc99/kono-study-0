# KONO Production Build 20 — Sanctuary Rollback & Clean Home Reset

## Active evolution systems
- Cherry tree
- Pond
- Sanctuary garden
- Lantern terrace
- Ambient critters

## Reset systems
- Home is locked to the original map-painted Stage 0 cottage.
- Home stages 1–5, overlay renderer, smoke, generated assets, and transition hooks are removed.
- Bamboo Grove renderer, assets, landmark, subject mapping, transition hooks, and critter habitat dependency are removed.

## Save compatibility
The prior `home` and `bamboo` keys remain reserved in progression saves so older profiles load safely. Both are normalized to Stage 0 and have no active next threshold. Existing task credit is preserved for the active systems and future approved Home artwork.

## Next workflow
Create and approve each new Home sprite independently before adding any renderer back to the application.
