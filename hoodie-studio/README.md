# Hoodie Studio

The products are grouped under three tabs:
- **Men's:** hoodie, crewneck, tee, basketball uniform, soccer kit
- **Women's:** hoodie, crewneck, performance polo, racerback tank, soccer kit, colour-block track set (jacket and shorts)
- **Accessories:** six-panel cap, golf balls

Your design carries over when you switch between products.

A standalone 3D product customizer for a pullover hoodie. It's one HTML page plus `hoodie.glb`, with no build step: three.js loads from a pinned CDN version.

Open `index.html` through any static server, for example `npx serve hoodie-studio`. It is separate from the KONO app and is not part of the Vite build.

## What it does
- **Pages:** Shop (a card for every product), Studio, About and Orders. Team and bulk enquiries come in by email.
- **The studio has three steps:**
  1. **Colour:** pick the garment colour and, where the garment has them, a separate colour for the hem, cuffs and collar (trims and socks on uniforms).
  2. **Logo & text:** upload a logo or add text. Choose a placement (Left chest, Centre chest, Upper back or Full back; picking a back spot moves the item to the back) and a size, or drag it on the garment. Sleeves take one centred item. Text shrinks to fit its spot.
  3. **Size & quantity:** for one piece, or a team roster with names, numbers and sizes.

  Fabric and decoration (print or embroidery) are agreed with the client, so the studio doesn't ask about them.
- The garment is a realistic 3D model. You can orbit, pan and zoom it, or jump to the Front, Back, Left or Right view.
- **Undo and redo:** Ctrl/⌘+Z and Ctrl/⌘+Shift+Z. Start over can also be undone.
- **Designs:** save designs on this device, or share them as a code or a link.
- **Review before the bag:** pictures of every side and the full spec.
- **Bag:** edit, duplicate and remove items.
- **Production files:** a zip for each item or order with:
  - a full-size PNG for each print area at its real size (up to 300 dpi);
  - one names-and-numbers file per player;
  - previews;
  - a printable order sheet;
  - `order.json`.
- **Pricing:** every rule is in `PRICING` in `index.html`. The first logo or text area is included, each extra area and names/numbers add a price per piece, and bulk discounts apply at 12, 24, 48 and 100 pieces.
- **Orders:** Checkout sends an order request, and no payment is taken.
  - On claude.ai, orders go to the page's database. The owner sees them all under Orders and can set their status.
  - Elsewhere, the order downloads as a zip, or opens an email if `SHOP.email` is set.
- **Size charts** use standard athletic sizing. Replace them with your supplier's specs in `SIZE_CHARTS`.
- The current design, saved designs and the bag are kept in localStorage.

The code for patterns, per-part colours and 2D pattern pieces is still in `index.html` and `tools/`, but the studio no longer shows those controls.

## How it works
- Each file in `models/` is made from a real garment model in `models-src/` by `tools/prepare-model.mjs`. The script:
  - merges the mesh, squares it up to face forward, scales it into the studio's space and bakes ambient occlusion into vertex colours;
  - precomputes a print surface for the front, back and each sleeve: only the triangles visible from that side, with planar UVs;
  - for CLO/Style3D exports, extracts the sewing pattern pieces: each panel is one piece and its UVs are the piece laid flat. It merges the inner and outer fabric layers, names each piece from where it sits on the body, and lays the pieces out side by side at their true relative size.
  - quantizes and meshopt-compresses the result (0.3–3 MB per model).
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
