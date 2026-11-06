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

## Needs the owner's answer

| What | Where | Made with | What to confirm |
|---|---|---|---|
| Arcade songs: Sweet swap, Gem blitz, KONO blast, KONO Flow 1–5 (also KONO Beat's songs) | `public/audio/games/` | Suno (per its README) | Made on a paid Suno plan (Pro or Premier)? Under Suno's terms, songs made on a paid plan belong to you for any use. Songs made on the free plan stay Suno's and are for non-commercial use only. |
| Medal Cove soundtrack (6 tracks) | `public/audio/medal-cove/` | Supplied with Medal Cove (likely Suno) | Same question |
| Main theme | `public/audio/main-theme.mp3` | Unknown | Where it came from |
| Completion chime | `public/audio/completion.wav` | Unknown | Where it came from |
| All the art: KONO, the island, rooms, decorations, Medal Cove scenery, icons | `public/garden/`, `public/games/cove/`, `public/landing/`, `public/icons/` | An AI image tool, from KONO's own style sheets (`docs/kono-art-prompts.md`) | Which tool and plan. Most (ChatGPT/OpenAI, Google) give you the rights to what you make. Midjourney needs a paid plan for commercial use. |

Once these answers are in, tick the launch checklist's licensing item and move its Trello card to Verified.
