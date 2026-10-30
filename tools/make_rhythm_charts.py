#!/usr/bin/env python3
"""Makes KONO Beat's charts from the arcade's songs, with every note on the song's own beat grid.
First the grid: the song's tempo and first beat are measured (fine-tuned around the listed tempo) and then
re-locked every couple of bars, so a song that drifts a little still lines up. Then, for each difficulty, the
grid's steps (Easy: beats, Medium: 8th notes, Jeff tier: 16th notes) that land on a hit in the music are
scored by how strong the hit is, and the strongest are kept (Easy about 1 a second, Medium about 2, Jeff tier
about 4, with chords on the big hits). A note before a sound that carries on becomes a hold. Lanes go by how
bright the hit sounds (low left, high right). Only the four floor lanes for now (no sky notes or ribbons).
Needs ffmpeg and numpy. Writes src/game/data/rhythmCharts.json.
  python3 tools/make_rhythm_charts.py"""
import json, subprocess, numpy as np
SR, N, HOP = 22050, 1024, 64
FPS = SR / HOP
# file, title, tempo to search around
SONGS = [
    ('candy', 'Skipping Motif', 120.0), ('gems', 'Crystal Discoveries', 100.0), ('blast', 'Satisfying Resolutions', 107.9),
    ('flow-1', 'Floating Pads', 90.75), ('flow-2', 'Shimmering Motif', 100.05), ('flow-3', 'Late Night Pulse', 113.3),
    ('flow-4', 'Soaring Euphoria', 129.9), ('flow-5', 'Transcendent Arpeggios', 136.6),
]
# Per level: grid steps a beat, min gap (s), notes a second, hold when the next note is this far off (s).
LEVELS = {'easy': (1, 0.42, 1.0, 0.9), 'medium': (2, 0.2, 2.2, 0.6), 'jeff': (4, 0.1, 4.3, 0.45)}

def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32)

def analyse(x):
    """The song's hits as one signal over time (`onset`), with how bright and how loud it is there. Two
    detectors agree on it: loudness jumps (exact in time) and changes in the sound's colour (catch soft
    notes); the second is lined up with the first before they're added."""
    e = np.sqrt(np.convolve(x.astype(np.float64) ** 2, np.ones(256) / 256, 'same'))[::HOP]
    rise = np.maximum(0, np.diff(np.log(e + 1e-6)))
    times = (np.arange(len(rise)) + 0.5) * HOP / SR
    frames = np.lib.stride_tricks.sliding_window_view(x, N)[::HOP] * np.hanning(N)
    mag = np.abs(np.fft.rfft(frames, axis=1)); freqs = np.fft.rfftfreq(N, 1 / SR)
    spec = np.log1p(10 * mag)
    flux = np.maximum(0, np.diff(spec, axis=0)).sum(axis=1)
    flux = np.maximum(0, flux - np.convolve(flux, np.ones(64) / 64, 'same'))
    ft = (np.arange(len(flux)) + 1) * HOP / SR + N / 2 / SR
    r = rise - rise.mean(); best, lag = -1, 0
    for d in np.arange(-0.05, 0.0501, HOP / SR):
        f = np.interp(times, ft + d, flux); c = np.dot(r, f - f.mean())
        if c > best: best, lag = c, d
    f = np.interp(times, ft + lag, flux)
    onset = rise / (rise.std() + 1e-9) + f / (f.std() + 1e-9)
    cent = np.interp(times, ft + lag, ((mag * freqs).sum(axis=1) / (mag.sum(axis=1) + 1e-9))[1:])
    rms = e[:len(times)]
    return onset, times, cent, rms

def phase(flux, times, bpm, sel=slice(None)):
    z = np.sum(flux[sel] * np.exp(2j * np.pi * times[sel] * bpm / 60))
    return abs(z) / (flux[sel].sum() + 1e-9), ((-np.angle(z)) / (2 * np.pi) * 60 / bpm) % (60 / bpm)

def beat_grid(flux, times, near, dur):
    """The song's beats: the tempo that lines the hits up best, then each 2-bar stretch nudged (at most 40 ms,
    smoothed) to where its own hits sit."""
    bpm = max(np.arange(near - 1.5, near + 1.5, 0.002), key=lambda b: phase(flux, times, b)[0])
    steady, first = phase(flux, times, bpm)
    beat = 60 / bpm; beats = np.arange(first, dur, beat)
    corr = []
    for i in range(0, len(beats), 8):
        a, b = beats[i] - beat / 2, beats[min(i + 8, len(beats) - 1)] + beat / 2
        sel = (times >= a) & (times < b)
        _, f = phase(flux, times, bpm, sel)
        d = ((f - first + beat / 2) % beat) - beat / 2
        corr.append(float(np.clip(d, -0.04, 0.04)))
    corr = np.convolve(np.pad(corr, 1, mode='edge'), [0.25, 0.5, 0.25], 'valid')
    shift = np.interp(np.arange(len(beats)), np.arange(0, len(beats), 8)[:len(corr)], corr)
    return bpm, first, steady, beats + shift

def chart(flux, times, cent, rms, beats, dur, level):
    div, gap, density, hold_gap = LEVELS[level]
    lo, hi = 2.0, dur - 4.0
    # The grid's steps for this level (between the beats, evenly).
    steps = np.concatenate([beats[i] + (beats[i + 1] - beats[i]) * np.arange(div) / div for i in range(len(beats) - 1)])
    steps = steps[(steps >= lo) & (steps <= hi)]
    win = int(0.03 * FPS)
    idx = np.searchsorted(times, steps)
    strength = np.array([flux[max(0, i - win):i + win + 1].max() if i < len(flux) else 0 for i in idx])
    # On-beat steps count a little more, so the main beat comes first.
    on_beat = np.isclose(((steps - beats[0]) / (beats[1] - beats[0]) * 1) % 1, 0, atol=0.05) | np.isclose(((steps - beats[0]) / (beats[1] - beats[0])) % 1, 1, atol=0.05)
    score = strength * np.where(on_beat, 1.25, 1.0)
    # A step only counts if the music really hits there (a clear peak, not just the background).
    floor = np.quantile(flux, 0.9)
    target = int((hi - lo) * density); kept = []
    for i in map(int, np.argsort(-score)):
        if len(kept) >= target: break
        if strength[i] <= floor: continue
        if all(abs(steps[i] - steps[k]) >= gap - 1e-3 for k in kept): kept.append(i)
    kept.sort()
    c = np.array([cent[min(len(cent) - 1, idx[i])] for i in kept])
    edges = np.quantile(c, [0.25, 0.5, 0.75]) if len(c) else [0, 0, 0]
    strong = np.quantile(strength[kept], 0.94) if kept else 9e9
    tap, run, prev, last_chord = [], 0, -1, -9
    for i, ci in zip(kept, c):
        t = steps[i]; lane = int(np.searchsorted(edges, ci))
        run = run + 1 if lane == prev else 1
        if run > 3: lane = (lane + 1 + i % 2) % 4; run = 1
        lane = int(lane); prev = lane; ms = int(round(t * 1000))
        if level == 'jeff' and strength[i] >= strong and t - last_chord > 0.6:
            tap += [[ms, lane], [ms, (lane + 2) % 4]]; last_chord = t
        else:
            tap.append([ms, lane])
    # Holds: a note with room after it, before a sound that carries on; it ends on the grid.
    times_ms = sorted(set(n[0] for n in tap)); hold, plain = [], []
    grid_ms = np.round(steps * 1000)
    for n in tap:
        ms, lane = n; nxt = next((x for x in times_ms if x > ms), ms + 2000)
        room = (nxt - ms) / 1000
        j = int(np.searchsorted(times, ms / 1000)); peak = rms[j:j + 8].max() if j < len(rms) else 0
        if room >= hold_gap and peak > 0:
            span = rms[j:j + int(room * FPS)]; quiet = span < peak * 0.45
            held = (np.argmax(quiet) if quiet.any() else len(span)) / FPS
            ends = grid_ms[(grid_ms > ms) & (grid_ms <= ms + min(room * 1000 - 120, held * 1000))]
            if len(ends) and ends[-1] - ms >= 250:
                hold.append([ms, lane, int(ends[-1])]); continue
        plain.append(n)
    return {'tap': plain, 'hold': hold, 'sky': [], 'ribbon': []}

def loud_hits(x):
    """Times of clear jumps in loudness (the top 3%), for the last check."""
    e = np.sqrt(np.convolve(x.astype(np.float64) ** 2, np.ones(256) / 256, 'same'))[::HOP]
    rise = np.maximum(0, np.diff(np.log(e + 1e-6))); t = (np.arange(len(rise)) + 0.5) * HOP / SR
    top = np.quantile(rise, 0.97)
    return np.array([t[i] for i in range(2, len(rise) - 2) if rise[i] > top and rise[i] == rise[i - 2:i + 3].max()])

songs = []
for file, title, near in SONGS:
    x = load(f'public/audio/games/{file}.mp3'); dur = len(x) / SR
    flux, times, cent, rms = analyse(x)  # flux: the song's hits (see analyse)
    bpm, first, steady, beats = beat_grid(flux, times, near, dur)
    # Last check: line the grid up with where the music really hits (plain loudness jumps, which are exact in
    # time), so the notes land on what you hear, not a few ms before or after it.
    hits = loud_hits(x)
    for _ in range(5):
        charts = {name: chart(flux, times, cent, rms, beats, dur, name) for name in LEVELS}
        notes = np.array([n[0] for c in charts.values() for n in c['tap'] + c['hold']]) / 1000
        j = np.clip(np.searchsorted(hits, notes), 1, len(hits) - 1)
        near = np.where(abs(hits[j] - notes) < abs(hits[j - 1] - notes), hits[j], hits[j - 1]); off = near - notes
        off = off[abs(off) < 0.06]
        shift = float(np.median(off)) if len(off) else 0
        if abs(shift) < 0.003: break
        beats = beats + shift; first += shift
    charts = {name: chart(flux, times, cent, rms, beats, dur, name) for name in LEVELS}
    songs.append({'id': file, 'title': title, 'bpm': round(float(bpm), 3), 'first': round(float(first), 3), 'ms': int(dur * 1000), 'charts': charts})
    print(f'{file:7s} {dur:.0f}s bpm {bpm:.3f} first {first:.3f} steady {steady:.2f}', {k: (len(v["tap"]), len(v["hold"])) for k, v in charts.items()})
with open('src/game/data/rhythmCharts.json', 'w') as f:
    json.dump({'songs': songs}, f, separators=(',', ':'))
