# KONO Medal Cove in KONO

Medal Cove is developed as its own project and copied into KONO whole. This is version 36 (source commit
`085eb4b4998f3efa4478131e891ff7a5cef25854`, packaged 2026-11-05). `HISTORY.md` is that project's own README.

## How it's wired in

- `src/components/MedalCoveGame.tsx` is KONO's wrapper. BreakGames lazy-loads it inside GameScreen. It starts the
  game's own music player (`src/useMedalMusic.ts`). The music follows KONO's Sounds setting and the game screen's
  🎵 button. A round that used **Practice** (sample medals) earns no KONO coins and sets no best.
- The game's code is copied as-is into `src/components`, `src/store`, `src/medalMusic.ts` and `src/useMedalMusic.ts`.
  The only edit was removing seven pieces of dead code KONO's stricter TypeScript settings reject.
- Its styles: `src/components/medal-cove.css` (as-is), plus `src/components/medal-cove-kono.css`. The latter holds
  the rules from the stand-alone page's `standalone.css` that style the game itself, keyed to `.medal-cove`
  instead of `.standalone`. The page's own header, options drawer and resets are left out.
- KONO-wide rules that would restyle the game skip `.medal-cove`: the cozy-theme button look (`team-themes.css`,
  `refresh.css`, `cozy-controls.css`), and the workbench small-text, base-button and large-text sizes
  (`workbench.css`).
- `src/arcadeAudio.ts` is the stand-alone copy, a superset of KONO's: it adds three coin sounds and
  `unlockArcadeAudio`. `konoSounds.ts` and `webgl.ts` are unchanged.
- Assets: the six soundtrack files in `public/audio/medal-cove/` and `public/games/cove/cinema-sanctuary.webp`.
  New public files must be listed in `tools/public-allowlist.json`.
- `eslint.config.js` turns off a few style and React-compiler rules for the game's files only, so they stay
  identical to their source.

## Tests

- `npm test` runs `npm run test:cove`: the game's own tests that pass and take under 15 s each (about 75 s in all).
- `npm run test:cove:slow` runs the passing ones that take longer (1–2 min each).
- These don't apply in KONO, because they check the stand-alone page (`src/main.tsx`, `standalone.css`):
  `test_framing`, `test_gameplay`, `test_music_runtime`, `test_sound_access`.
- These already fail in the v36 package itself (each one looked into in [TEST_TRIAGE.md](TEST_TRIAGE.md): none is a bug a player would notice):
  - `test_tide`, `test_tower_park`, `test_whole_route`, `test_sanctuary_tide`, `test_delivery_presentation`,
    `test_scene_geometry`
  - `test_board_clear_transport`, `test_board_clear_lifecycle`, `test_compact_cabinet`, `test_rear_backstop`
  - `test_side_tower_blocking`, `test_sanctuary_silhouettes_audit`, `test_reference_stock`,
    `test_reference_geometry`
- These ran over 5 minutes and were not finished: `test_sanctuary_runtime`, `test_pile_dynamics`, and
  `test_side_tower_acceptance` (its `tray` variant passes).

## Taking a newer version

1. Copy the new package's `src/` over KONO's, except `main.tsx`, `standalone.css` and `components/GameScreen.ts`
   (KONO has its own).
2. Diff `arcadeAudio.ts` first: other games use it.
3. Copy `public/` assets (and list new ones in the allowlist), and copy `tools/`. Keep the KONO coin-rate check
   at the end of `tools/test_medal_cove.cjs`.
4. Re-derive `medal-cove-kono.css` from the new `standalone.css`.
5. Run `npm run check` and the "KONO Medal Cove" end-to-end flow.
