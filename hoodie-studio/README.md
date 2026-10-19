# Hoodie Studio

The products are grouped under four tabs:
- **Unisex:** hoodie, crewneck, tee
- **Men's:** basketball uniform, soccer kit
- **Women's:** performance polo, racerback tank, soccer kit, colour-block track set (jacket and shorts)
- **Accessories:** six-panel cap, golf balls

Your design carries over when you switch between products.

A standalone 3D product customizer for a pullover hoodie. It's one HTML page plus `hoodie.glb`, with no build step: three.js loads from a pinned CDN version.

Open `index.html` through any static server, for example `npx serve hoodie-studio`. It is separate from the KONO app and is not part of the Vite build.

## What it does
- A floating, realistic hoodie built from a real garment model. Orbit, pan and zoom it, or jump to the Front, Back, Left or Right view.
- Colourways and a custom colour. Per-part colours only appear for models that come in separate parts.
- Every part can be edited. Click a pattern piece (in 2D or on the model) or a kit part (jersey, trims, shorts, socks), or pick it from the Parts list, to give it its own colour and pattern. Sets also have a "whole jacket" and a "whole shorts" option.
- All-over patterns (repeat prints): stripes, pinstripe, Breton, plaid, gingham, check, dots, chevron, waves, camo and heather, or upload your own tiles. You can keep up to 12 uploaded tiles and delete them. You can set the pattern colour, scale and angle.
- A 2D pattern-pieces view, like Fabra's, for garments that have a flat layout (the tee and the crewneck). It shows each sewing pattern piece next to the 3D garment. Click a piece in 2D or on the garment to give it its own colour or switch its pattern on or off. Patterns are cut per piece, the way a cut-and-sew garment is.
- Fabrics: Jersey Athletic, Cotton, Fleeced and French Terry.
- Four print areas: front, back, left sleeve and right sleeve. Each one takes text layers (10 fonts, ink colour, size, letter spacing, arc, rotation, outline), built-in graphics and uploaded images.
- Drag a print directly on the 3D model to move it. Arrow keys nudge it, and Delete removes it.
- Size, quantity, live pricing (each extra print area adds a fee), an "Add to bag" button and a PNG snapshot.
- The design is saved to localStorage.

## How it works
- Each file in `models/` is made from a real garment model in `models-src/` by `tools/prepare-model.mjs`. The script:
  - merges the mesh, squares it up to face forward, scales it into the studio's space and bakes ambient occlusion into vertex colours;
  - precomputes a print surface for the front, back and each sleeve: only the triangles visible from that side, with planar UVs;
  - for CLO/Style3D exports, extracts the sewing pattern pieces: each panel is one piece and its UVs are the piece laid flat. It merges the inner and outer fabric layers, names each piece from where it sits on the body, and lays the pieces out side by side at their true relative size.
  - quantizes and meshopt-compresses the result to about 7 MB.
- To rebuild a model: `node prepare-model.mjs <source> ../models/<name>.glb <preset>`. The presets are in `PRESETS` in `prepare-model.mjs`.
- The script also reads OBJ files (gzipped ones too), and it can:
  - drop CLO stitch geometry (`minPieceTris`) and inner fabric layers (`dropInner`);
  - simplify dense meshes and subdivide low-poly ones;
  - keep a weave or dimple normal map;
  - split team kits into a jersey part and a shorts part.
- To add a garment: run `node prepare-model.mjs <in.glb> ../models/<name>.glb <preset>`, add a preset for its print areas in `PRESETS`, then add it to `PRODUCTS` in `index.html`. Only the geometry is used; any textures baked into the source are dropped.
- The knit texture is applied in the shader by triplanar bump mapping, so the garment needs no UV unwrap.

## Credits
- Women's polo, racerback tank, basketball uniform, soccer kit, track set, cap and golf ball: supplied by the project owner. Check the licence of each model before using it commercially. Only geometry and surface-detail (normal) maps are used: all printed and branded colour textures were left out.
The 3D models are licensed CC BY 4.0, and the studio page shows the credit for the model in use.
- Hoodie: ["Hoodie Sweatshirt"](https://sketchfab.com/3d-models/hoodie-sweatshirt-d1b0dc66056b4ea7bc616b0d3bb7cf22) by melatmod. Rescaled, recoloured and shaded with baked ambient occlusion for this studio.
- T-shirt: ["T Shirt"](https://sketchfab.com/3d-models/t-shirt-c1a3e5eb9b5445f4b7d4be82f1127eba) by funlab117. Squared up, rescaled, recoloured and shaded with baked ambient occlusion.
- Crewneck: ["Off-white printed hoodie"](https://sketchfab.com/3d-models/off-white-printed-hoodie-f4306b3c6b8f484a9889dfea3745cba2) by Style3D CG. Geometry only: the original printed texture is not used.
