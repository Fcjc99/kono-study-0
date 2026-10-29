# KONO v0.95.2 — Living Sanctuary Performance Pass

- Replaced dozens of independent infinite weather tweens with one lightweight scene update loop.
- Targets 60 FPS with smooth delta stepping and a 30 FPS minimum fallback.
- Requests high-performance rendering and increases WebGL batching.
- Pauses the world when the Sanctuary is offscreen or the browser tab is hidden.
- Caps large frame deltas to avoid weather jumping after tab switching or device stalls.
- Preserves clearly visible cloudy, rain, breezy, and snow states with fewer simultaneous moving objects.
- Keeps mobile weather density while reducing per-frame animation-management overhead.
