# KONO Production Build 20.6
## Tree Height Lock + Pixel Pond Foundation

### Cherry blossom placement
- Kept the approved horizontal plateau center at source X = 704.
- Raised the tree ground anchor from Y = 314 to Y = 272 so the tree sits deeper on the upper platform and farther from the stairs.
- Moved the cherry-tree landmark hitbox and evolution milestone accent with the visual anchor.
- Tree scale, approved six-stage artwork, time-of-day grading, and petals remain unchanged.

### Pond evolution rebuilt around PNG assets
The pond no longer generates placeholder koi or glints from Phaser geometry. New pond visuals are transparent pixel-art PNGs stored under `public/garden/evolution/pond/`.

Stages:
0. Natural pond
1. Rippled water
2. Lily pond
3. First koi
4. Koi garden
5. Sanctuary pond

### Real koi sprite system
- Three koi designs: orange/white, red/white, and gold/black.
- Eight directional PNG sprites per koi so fish do not rely on continuously rotating a single image.
- Two tail frames per direction for a restrained swim cycle.
- 48 total koi animation PNGs.
- Fish remain readable through morning, afternoon, evening, and night using phase-aware opacity/tinting.

### Additional pixel pond assets
- lily-pad variations
- pink lotus
- reeds
- mossy shoreline stones
- ripple sprites
- water sparkle
- shoreline flowers

### Art pipeline rule
New Sanctuary world/evolution assets should be pixel-art PNG assets, with transparent backgrounds where appropriate. Procedural vector/geometry stand-ins should not be used for final world art.

### Bamboo
Bamboo remains removed.
