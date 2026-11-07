# What KONO ships, and the license for each

For the launch checklist's "asset licensing" item. Checked November 2026 from the repository: every file
under `public/`, the fonts and the code libraries in `package.json`.

## Clear

| What | Where | License |
|---|---|---|
| Fonts: DM Sans, Newsreader, Caveat, Zen Old Mincho, Zen Kaku Gothic New | Google Fonts, loaded at runtime | SIL Open Font License: free for any use, commercial included |
| Code libraries: React, three.js, Phaser, Supabase, Capacitor, tesseract.js, pdf.js, jsPDF, zod, drizzle, rapier, postprocessing | npm | MIT, Apache-2.0 or Zlib: free for any use; keep their notices (they ship inside the build) |
| Sound effects made in code (coin clinks, ticks, Meowdoku/KONO Hop/KONO.io tunes) | `src/arcadeAudio.ts`, `src/game/audioClock.ts` | KONO's own |
| Nothing from other companies | — | The SEGA links in `docs/medal-cove/HISTORY.md` are design references only. No SEGA, Nintendo or stock image or sound is in the app. |

## Confirmed by the owner (November 2026)

| What | Where | Made with | License |
|---|---|---|---|
| Arcade songs: Sweet swap, Gem blitz, KONO blast, KONO Flow 1–5 (also KONO Beat's songs) | `public/audio/games/` | Suno, paid plan | Songs made on a paid Suno plan belong to their maker for any use, commercial included |
| Medal Cove soundtrack (6 tracks) | `public/audio/medal-cove/` | Suno, paid plan | Same |
| Main theme and the "done" chime | `public/audio/main-theme.mp3`, `public/audio/completion.wav` | Suno, paid plan | Same |
| All the art: KONO, the island, rooms, decorations, Medal Cove scenery, icons | `public/garden/`, `public/games/cove/`, `public/landing/`, `public/icons/` | ChatGPT (OpenAI's image tool), from KONO's own style sheets (`docs/kono-art-prompts.md`) | OpenAI's terms give the person who makes it the rights to the output |

New music or art should come from the same paid Suno plan and ChatGPT, or be added here with its source.
