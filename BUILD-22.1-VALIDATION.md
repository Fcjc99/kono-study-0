# Build 22.1 Validation

Status: **PASS — repository validation suite**

`npm run validate` passes the Build 22.1 chain:

- TypeScript/TSX erasable-syntax validation: PASS — 46 files
- Production environment: PASS — 192 fluid frames / 4 source scenes
- Foundation lock: PASS
- Tree evolution: PASS
- Pond evolution + koi: PASS
- Garden/critter foundation: PASS
- Home evolution transparency: PASS
- Build 21.1 Home silhouette / foundation / lawn fit: PASS
- Build 21.5 koi safe paths + Option B garden: PASS
- Build 21.7 terrace footprint/style constraints: PASS
- Build 22.1 visual-repair validator: PASS

Build 22.1 additionally verifies:

- Four Stage 0 painted maps remain byte-locked.
- Home Stages 1–5 have identical alpha geometry across all four phases.
- Stage 5 garden has identical phase geometry and transparent safety padding.
- Terrace Stages 0–5 have identical alpha geometry across all four phases.
- Separate Evening and Night terrace emissive layers exist where lights are active.
- Fishing idle/cast overlays remain registered to the approved bridge area in all four phases.
- Home, terrace, and fishing art now swap on the same frame as the painted phase map.
- The three reported TypeScript error patterns are repaired.
- Koi counts/routes, fishing functionality, and KONO interactions remain present.

## Full bundle note

A complete `tsc -b && vite build` cannot be executed in this sandbox because the uploaded archive does not include the project dependency installation (`node_modules`), so TypeScript cannot resolve the installed project type packages (`vite/client` and `node`) here. The repository syntax validator runs TypeScript with `erasableSyntaxOnly: true`, and all project asset/runtime validators pass.
