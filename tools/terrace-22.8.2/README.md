# Registered terrace evolution — 22.8.2

Stage 0 remains byte-for-byte locked across all four phase maps. Stage 2 uses the supplied transparent lounge PNG. Stages 1, 3, 4 and 5 were created with built-in imagegen, followed by user-authorized alpha-edge cleanup. Exact variant prompts are in `exact-prompts.md`. Rejected checkerboard drafts are not runtime assets.

Progression: quiet bench → supplied corner lounge → planted reading lounge → blossom pergola → lush flowering pergola with tea, books and cushions. Terrace progression remains based on productive days (1, 3, 5, 7, 14), independently of assignment-based tree/home/garden levels.

Runtime uses exactly one full-map texture for the selected terrace stage and time of day. Each upgrade is built independently from the matching locked Stage 0 map, never from the previous stage. Only pixels within (940,280)–(1320,615) may differ; the pond, tree, house, bridge, path stairs and island perimeter remain unchanged. Individual phase placements account for the different deck positions in the original locked phase artwork.

Four phase-specific grass plates remove the old deck and fixtures before the new transparent sprite is composited. Ground-plate prompt: remove only upper-right deck, poles, light string, back bench and front stool; fill with continuous grass matching that phase; preserve full 1448×1086 island, camera, every other object and lighting. Only the local grass patch is consumed, never the full generated island.

Inputs are in `inputs/`. `build-terraces.cjs PROJECT_ROOT INPUT_DIRECTORY OUTPUT_DIRECTORY` requires Sharp (`NODE_PATH` may point to an installed Sharp runtime). It generates staged maps and a manifest; it does not overwrite Stage 0. Copy reviewed maps to the runtime phase directories and manifest to `SANCTUARY-REGISTRATION-22.8.2.json`.

Validation: `npm run build`, `node tools/test_sanctuary_progression.cjs`, `python tools/validate_sanctuary_registration.py` (Pillow required). Development-only `/?sanctuaryQA=1` has isolated stage and phase controls without changing saved assignments. Normal app version is exposed through `src/version.ts`.
