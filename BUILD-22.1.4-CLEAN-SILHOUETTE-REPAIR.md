# Build 22.1.4 — Clean Silhouette Repair Pass

This pass locks in the clean-silhouette rule for Sanctuary asset work.

## Changes
- Removed the visible flat cutout shelf from the Stage 5 house silhouette across Morning, Afternoon, Evening, and Night house PNGs.
- Mirrored that alpha cleanup into the full-silhouette house copies used for QA/source parity.
- Scrubbed RGB data from fully transparent pixels across key Sanctuary evolution PNGs (home, terrace, vegetable patch, bridge-fishing) so assets remain clean transparent silhouettes with no hidden cutout debris.

## Hard rule going forward
All future Sanctuary asset edits should ship as clean silhouette PNGs only: no pasted-on patches, no rectangular cutout edges, and no hidden opaque shelf artifacts.
