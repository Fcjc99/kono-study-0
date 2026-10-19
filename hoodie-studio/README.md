# Hoodie Studio

A standalone 3D product customizer for a pullover hoodie. It's one HTML page plus `hoodie.glb`, with no build step: three.js loads from a pinned CDN version.

Open `index.html` through any static server, for example `npx serve hoodie-studio`. It is separate from the KONO app and is not part of the Vite build.

## What it does
- A floating, cloth-simulated hoodie with a hood, lining, drawstrings, kangaroo pocket, ribbed cuffs and hem. Orbit, pan and zoom it, or jump to the Front, Back, Left or Right view.
- Colourways, plus per-part colours (body, sleeves, hood, trims, lining, drawstrings).
- Fabric finishes: fleece, French terry and brushed.
- Four print areas: front, back, left sleeve and right sleeve. Each one takes text layers (10 fonts, ink colour, size, letter spacing, arc, rotation, outline), built-in graphics and uploaded images.
- Drag a print directly on the 3D model to move it. Arrow keys nudge it, and Delete removes it.
- Size, quantity, live pricing (each extra print area adds a fee), an "Add to bag" button and a PNG snapshot.
- The design is saved to localStorage.

## How it works
- `hoodie.glb` is the garment, built by `tools/build-hoodie.mjs`. The builder:
  - shapes the hoodie around an invisible mannequin;
  - runs a cloth simulation so gravity forms the drape, the gathers above the rib bands and the folds in the sleeves and hood;
  - sinks the seams and adds the rib bands, hood rim, drawstrings and kangaroo pocket;
  - bakes ambient occlusion into vertex colours.
- To rebuild the model: `cd tools && npm install && npm run build`. It takes about 1.5 minutes.
- The print areas (front, back and both sleeves) are stored in the GLB's scene extras. The studio projects each one onto the folded surface, so prints follow the fabric.
- The knit texture is applied in the shader by triplanar bump mapping, so the garment needs no UV unwrap.
- To use a different model, such as one from Sketchfab or CLO, export it with mesh names that match `PART_MAT` in `index.html` and add the `placements` extras.
