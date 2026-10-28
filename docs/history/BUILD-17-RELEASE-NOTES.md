# Build 17 Release Notes

## Added

- Bamboo Grove evolution system
- Six distinct authored bamboo stages
- Four phase-specific texture sets
- Spanish/language subject progression
- Mature-grove leaf drift
- Bamboo bird habitat visits
- Bamboo landmark and debug diagnostics
- Schema version 6 migration

## Preserved

- Approved cherry-tree sprites and phase integration
- Pond, home, lantern, garden, and critter progression
- Live ZIP-code weather
- Fluid, cloud, lighting, atmosphere, and performance systems
- Per-profile progression and duplicate-credit protection

## Validation

Run:

```bash
npm install
npm run validate
npm run build
npm run dev
```

The included validators pass in this package. A complete Vite compile requires the local npm dependencies; the build environment used to package this release could not retrieve `@eslint/js` from its internal registry.
