# Arcade soundtracks

Each game plays its own looping track from this folder when it is here, and its built-in tune when it
isn't (src/arcadeAudio.ts; a new file also goes in its RECORDED list and in tools/public-allowlist.json). Files are MP3, about 1–2 minutes, made to loop.

| File | Game |
| --- | --- |
| `candy.mp3` | Candy crush — “Skipping Motif” (Suno) |
| `gems.mp3` | Gem blitz — “Crystal Discoveries” (Suno) |
| `meow.mp3` | Meowdoku |
| `flap.mp3` | Flappy KONO |
| `paper.mp3` | KONO.io |
| `blast.mp3` | KONO blast — “Satisfying Resolutions” (Suno) |
| `flow-1.mp3` … `flow-5.mp3` | KONO Flow, a new one every three levels — “Floating Pads”, “Shimmering Motif”, “Late Night Pulse”, “Soaring Euphoria”, “Transcendent Arpeggios” (Suno) |

KONO Flow's notes play on the beat of its song, so each `flow-N.mp3` has its tempo and first beat in
`FLOW_GRID` (src/arcadeAudio.ts). A new or replaced Flow track needs measuring:
`python3 tools/measure_beat.py public/audio/games/flow-1.mp3` (ffmpeg + numpy), and its numbers copied in.
Keep the songs in D major or B minor so the notes (D E F# A B) stay in key.
