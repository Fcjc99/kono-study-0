# Hoodie Studio

A standalone 3D product customizer for a pullover hoodie. It's one HTML page plus `hoodie.glb`, with no build step: three.js loads from a pinned CDN version.

Open `index.html` through any static server, for example `npx serve hoodie-studio`. It is separate from the KONO app and is not part of the Vite build.

## What it does
- A floating, realistic hoodie built from a real garment model. Orbit, pan and zoom it, or jump to the Front, Back, Left or Right view.
- Colourways and a custom colour. Per-part colours only appear for models that come in separate parts.
- Fabric finishes: fleece, French terry and brushed.
- Four print areas: front, back, left sleeve and right sleeve. Each one takes text layers (10 fonts, ink colour, size, letter spacing, arc, rotation, outline), built-in graphics and uploaded images.
- Drag a print directly on the 3D model to move it. Arrow keys nudge it, and Delete removes it.
- Size, quantity, live pricing (each extra print area adds a fee), an "Add to bag" button and a PNG snapshot.
- The design is saved to localStorage.

## How it works
- `hoodie.glb` is made from a real garment model, `models-src/hoodie-sweatshirt-melatmod.glb`, by `tools/prepare-model.mjs`. The script:
  - merges the mesh, scales it into the studio's space and bakes ambient occlusion into vertex colours;
  - precomputes a print surface for the front, back and each sleeve: only the triangles visible from that side, with planar UVs;
  - quantizes and meshopt-compresses the result to about 7 MB.
- To rebuild the model: `cd tools && npm install && npm run model`.
- To swap in another garment, point the script at a different GLB. You may need to adjust the placement frames near the top of step 4 to suit its shape.
- The knit texture is applied in the shader by triplanar bump mapping, so the garment needs no UV unwrap.

## Credits
The 3D models are licensed CC BY 4.0, and the studio page shows the credit for the model in use.
- Hoodie: ["Hoodie Sweatshirt"](https://sketchfab.com/3d-models/hoodie-sweatshirt-d1b0dc66056b4ea7bc616b0d3bb7cf22) by melatmod. Rescaled, recoloured and shaded with baked ambient occlusion for this studio.
- T-shirt (not used yet): ["T Shirt"](https://sketchfab.com/3d-models/t-shirt-c1a3e5eb9b5445f4b7d4be82f1127eba) by funlab117.
