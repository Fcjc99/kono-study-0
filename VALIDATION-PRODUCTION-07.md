# Production Build 07 Validation

- 32 TypeScript and TSX files passed isolated syntax transpilation with `erasableSyntaxOnly`.
- Changed engine, scene, weather-system, and debug-panel files passed a strict TypeScript check using local API stubs, including `noUnusedLocals` and `noUnusedParameters`.
- All relative source imports resolve to existing local files.
- Weather-transition simulations were exercised for clear → rain and rain → clear:
  - cloud and wind lead arriving rain;
  - precipitation builds later;
  - precipitation tapers before cloud recovery;
  - water response lingers during recovery.
- Reduced Motion, quality, density, and weather-debug hooks remain connected.
- The archive is checked with Python's ZIP integrity test after packaging.

A dependency-backed Vite build still requires local package installation with `npm install`.
