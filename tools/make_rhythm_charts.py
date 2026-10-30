#!/usr/bin/env python3
"""Makes KONO Beat's charts from the arcade's songs: finds where the music hits (onsets), keeps the strongest
ones that fit each difficulty (Easy about 1 a second, Medium about 2, Jeff tier about 4 with chords), snaps them
to the song's 16th notes where they're close, and puts each in a lane by how bright it sounds (low on the left,
high on the right). Needs ffmpeg and numpy. Writes src/game/data/rhythmCharts.json.
  python3 tools/make_rhythm_charts.py"""
import json, subprocess, numpy as np
SR, N, HOP = 22050, 1024, 256
FPS = SR / HOP
# file, title, bpm, first beat (from tools/measure_beat.py)
SONGS = [
    ('candy', 'Skipping Motif', 120.00, 0.381),
    ('gems', 'Crystal Discoveries', 99.98, 0.052),
    ('blast', 'Satisfying Resolutions', 107.90, 0.129),
    ('flow-1', 'Floating Pads', 90.78, 0.57),
    ('flow-2', 'Shimmering Motif', 100.05, 0.53),
    ('flow-3', 'Late Night Pulse', 113.2, 0.22),
    ('flow-4', 'Soaring Euphoria', 129.85, 0.33),
    ('flow-5', 'Transcendent Arpeggios', 136.6, 0.26),
]
LEVELS = {'easy': (0.42, 1.0), 'medium': (0.2, 2.2), 'jeff': (0.1, 4.3)}  # min gap (s), notes per second

def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32)

def onsets(x):
    frames = np.lib.stride_tricks.sliding_window_view(x, N)[::HOP] * np.hanning(N)
    mag = np.abs(np.fft.rfft(frames, axis=1)); freqs = np.fft.rfftfreq(N, 1 / SR)
    spec = np.log1p(10 * mag)
    flux = np.maximum(0, np.diff(spec, axis=0)).sum(axis=1)
    # Loudness changes over the song: compare each frame with what's around it (about 3 s).
    w = int(3 * FPS); local = np.convolve(flux, np.ones(w) / w, 'same') + 1e-6
    strength = flux / local
    peaks = []
    for i in range(3, len(strength) - 3):
        s = strength[i]
        if s > 1.35 and s == strength[i - 3:i + 4].max():
            band = mag[i + 1]
            centroid = float((band * freqs).sum() / (band.sum() + 1e-9))
            peaks.append(((i + 1) / FPS, float(s), centroid))
    return peaks

def chart(peaks, dur, bpm, first, gap, density, chords):
    lo, hi = 2.0, dur - 4.0
    cands = sorted([p for p in peaks if lo <= p[0] <= hi], key=lambda p: -p[1])
    target = int((hi - lo) * density); kept = []
    for p in cands:
        if len(kept) >= target: break
        if all(abs(p[0] - k[0]) >= gap for k in kept): kept.append(p)
    kept.sort()
    # Snap to the song's 16th notes when within 40 ms (the beat feels steadier); otherwise keep the hit.
    step = 60 / bpm / 4; out = []
    for t, s, c in kept:
        g = first + round((t - first) / step) * step
        out.append((g if abs(g - t) < 0.04 else t, s, c))
    # Lanes by brightness: the song's own quarters of its brightness range.
    cs = np.array([c for _, _, c in out]); edges = np.quantile(cs, [0.25, 0.5, 0.75]) if len(cs) else [0, 0, 0]
    notes, run, prev = [], 0, -1
    strong = np.quantile([s for _, s, _ in out], 0.94) if out else 9e9
    last_chord = -9
    for t, s, c in out:
        lane = int(np.searchsorted(edges, c))
        # No more than three in a row in one lane: step to the next one.
        run = run + 1 if lane == prev else 1
        if run > 3: lane = (lane + 1 + int(t * 7) % 2) % 4; run = 1
        prev = lane
        ms = int(round(t * 1000))
        if chords and s >= strong and t - last_chord > 0.6:
            notes.append([ms, lane]); notes.append([ms, (lane + 2) % 4]); last_chord = t
        else:
            notes.append([ms, lane])
    return notes

songs = []
for file, title, bpm, first in SONGS:
    x = load(f'public/audio/games/{file}.mp3'); dur = len(x) / SR
    peaks = onsets(x)
    charts = {name: chart(peaks, dur, bpm, first, gap, dens, name == 'jeff') for name, (gap, dens) in LEVELS.items()}
    songs.append({'id': file, 'title': title, 'bpm': bpm, 'ms': int(dur * 1000), 'charts': charts})
    print(file, f'{dur:.0f}s', {k: len(v) for k, v in charts.items()})
with open('src/game/data/rhythmCharts.json', 'w') as f:
    json.dump({'songs': songs}, f, separators=(',', ':'))
