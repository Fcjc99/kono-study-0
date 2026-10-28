# KONO Identity Edition — Sprint 1

## Completed in this build
- Removed the oversized Sanctuary greeting hero so the world opens first.
- Rebuilt the Sakura sidebar as a walnut desk organizer.
- Kept the cassette player inside the sidebar and removed mascot treatment.
- Moved the active profile selector beneath the cassette player.
- Added centralized KONO design tokens and a dedicated Identity stylesheet loaded last.
- Reworked planner/task surfaces into compact paper strips while preserving Assignment → Subject hierarchy.
- Reworked subject workspaces into notebook/binder surfaces.
- Rebuilt board framing and dedicated board header regions to prevent title overlap.
- Standardized warm ivory, walnut, cork, Sakura, sage, and brass materials.
- Added intentionally designed mobile behavior.
- Added `docs/design-system.md` for future upgrades.

## Build note
The source changes are complete. Run `npm install` once on the development computer, then `npm run dev`. The bundled dependency folder from the supplied project was incomplete and did not contain the Vite/Node type definitions required for a clean build inside the packaging environment.
