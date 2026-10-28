# KONO Production Build 13.1 — Tree Evolution Layer Fix

Fixed the TypeScript build errors in `TreeEvolutionSystem.ts` by adding the missing render-layer constants:

- `RenderLayers.evolutionGround` at depth `24.5`
- `RenderLayers.evolutionFront` at depth `27`

The ordering now keeps the evolution mound above base vegetation, the tree on its existing evolution layer, and growth petals/leaves immediately in front of the tree without covering front ambient or vegetation effects.
