# Hoodie Studio

A standalone 3D product customizer for a pullover hoodie. It's a single HTML file with no build step: three.js loads from a pinned CDN version.

Open `index.html` through any static server, for example `npx serve hoodie-studio`. It is separate from the KONO app and is not part of the Vite build.

## What it does
- A floating, procedurally modelled hoodie with a hood, lining, drawstrings, kangaroo pocket, ribbed cuffs and hem. Orbit, pan and zoom it, or jump to the Front, Back, Left or Right view.
- Colourways, plus per-part colours (body, sleeves, hood, trims, lining, drawstrings).
- Fabric finishes: fleece, French terry and brushed.
- Four print areas: front, back, left sleeve and right sleeve. Each one takes text layers (10 fonts, ink colour, size, letter spacing, arc, rotation, outline), built-in graphics and uploaded images.
- Drag a print directly on the 3D model to move it. Arrow keys nudge it, and Delete removes it.
- Size, quantity, live pricing (each extra print area adds a fee), an "Add to bag" button and a PNG snapshot.
- The design is saved to localStorage.

## How it works
- The torso is a superellipse tube parameterised by arc length, so prints don't stretch around the body. Front and back prints are composited onto one canvas texture. The pocket uses the same UVs, so a print carries straight across it.
- Sleeves are tapered tubes along a curve and each has its own canvas texture. The hood is an ellipsoid shell with a face opening.
- To add a product such as a tee or a crewneck, reuse `makeSection` and `makeSleeve` with new profiles.
