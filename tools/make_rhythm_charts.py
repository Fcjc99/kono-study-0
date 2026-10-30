"""Makes KONO Beat's charts from the arcade's songs. Notes come from where the music hits (onsets): the
strongest ones that fit each difficulty (Easy about 1 a second, Medium about 2, Jeff tier about 4 with chords),
snapped to the song's 16th notes where they're close, in a lane by how bright they sound (low left, high right).
Then the extras: a note before a held sound becomes a hold; the brightest hits rise into the sky (tap up high);
and now and then a ribbon follows the melody for two bars (trace it with a finger; the floor notes move to the
other hand's side while it plays). Needs ffmpeg and numpy. Writes src/game/data/rhythmCharts.json.
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

def analyse(x):
    frames = np.lib.stride_tricks.sliding_window_view(x, N)[::HOP] * np.hanning(N)
    mag = np.abs(np.fft.rfft(frames, axis=1)); freqs = np.fft.rfftfreq(N, 1 / SR)
    spec = np.log1p(10 * mag)
    flux = np.maximum(0, np.diff(spec, axis=0)).sum(axis=1)
    # Loudness changes over the song: compare each frame with what's around it (about 3 s).
    w = int(3 * FPS); local = np.convolve(flux, np.ones(w) / w, 'same') + 1e-6
    strength = flux / local
    cent = (mag * freqs).sum(axis=1) / (mag.sum(axis=1) + 1e-9)
    rms = np.sqrt((frames ** 2).mean(axis=1))
    peaks = []
    for i in range(3, len(strength) - 3):
        s = strength[i]
        if s > 1.35 and s == strength[i - 3:i + 4].max():
            peaks.append(((i + 1) / FPS, float(s), float(cent[i + 1])))
    return peaks, cent, rms

# Per level: hold when the next note is this far off (s); share of hits that rise into the sky; a ribbon about
# every so many seconds; how far a ribbon swings (0-1 of the track); whether floor notes stay during it.
EXTRAS = {'easy': (0.9, 0.0, 22, 0.25, False), 'medium': (0.6, 0.07, 11, 0.45, True), 'jeff': (0.42, 0.12, 6.5, 0.7, True)}

def chart(peaks, cent, rms, dur, bpm, first, level):
    gap, density = LEVELS[level]; hold_gap, sky_share, ribbon_every, swing, keep_floor = EXTRAS[level]
    chords = level == 'jeff'
    lo, hi = 2.0, dur - 4.0
    cands = sorted([p for p in peaks if lo <= p[0] <= hi], key=lambda p: -p[1])
    target = int((hi - lo) * density); kept = []
    for p in cands:
        if len(kept) >= target: break
        if all(abs(p[0] - k[0]) >= gap for k in kept): kept.append(p)
    kept.sort()
    # Snap to the song's 16th notes when within 40 ms (the beat feels steadier); otherwise keep the hit.
    step = 60 / bpm / 4; out = []
    snap = lambda t: first + round((t - first) / step) * step
    for t, s, c in kept:
        g = snap(t)
        out.append((g if abs(g - t) < 0.04 else t, s, c))
    # Ribbons: two bars that follow the melody (how bright it is), every so often, in the song's own bars.
    bar = 4 * 60 / bpm; ribbons = []
    cs_all = cent[int(lo * FPS):int(hi * FPS)]; c_lo, c_hi = np.quantile(cs_all, [0.1, 0.9])
    t = first + bar * np.ceil((lo + ribbon_every * 0.6 - first) / bar)
    while t + 2 * bar < hi:
        t0, t1 = t, t + 2 * bar
        div = 2 if level == 'easy' else 4 if level == 'medium' else 8
        times = [t0 + i * bar / div for i in range(2 * div + 1)]
        def x_at(tt):
            a, b = int((tt - 0.12) * FPS), int((tt + 0.12) * FPS)
            return float(np.clip((np.median(cent[a:b]) - c_lo) / (c_hi - c_lo + 1e-9), 0, 1))
        xs = np.array([x_at(tt) for tt in times])
        xs = np.convolve(np.pad(xs, 1, mode='edge'), [0.25, 0.5, 0.25], 'valid')
        mid = float(np.mean(xs)); hand = 0 if mid < 0.5 else 1
        # Each hand keeps to its side, and the swing grows with the level.
        centre = 0.3 if hand == 0 else 0.7
        xs = np.clip(centre + (xs - mid) * swing / max(1e-3, xs.max() - xs.min()), 0.06 if hand == 0 else 0.4, 0.6 if hand == 0 else 0.94)
        for i in range(len(times) - 1):
            ribbons.append([int(round(times[i] * 1000)), int(round(times[i + 1] * 1000)), int(round(xs[i] * 100)), int(round(xs[i + 1] * 100)), hand])
        t += bar * max(4, round(ribbon_every / bar))
    spans = [(r[0] / 1000, r[1] / 1000, r[4]) for r in ribbons]
    def ribbon_at(tt):
        for a, b, h in spans:
            if a - 0.25 <= tt <= b + 0.15: return h
        return None
    # Lanes by brightness: the song's own quarters of its brightness range.
    cs = np.array([c for _, _, c in out]); edges = np.quantile(cs, [0.25, 0.5, 0.75]) if len(cs) else [0, 0, 0]
    sky_line = np.quantile(cs, 1 - sky_share) if len(cs) and sky_share else 9e9
    strong = np.quantile([s for _, s, _ in out], 0.94) if out else 9e9
    tap, sky, run, prev, last_chord = [], [], 0, -1, -9
    for t, s, c in out:
        h = ribbon_at(t)
        if h is not None and not keep_floor: continue
        lane = int(np.searchsorted(edges, c))
        if h is not None: lane = 2 + lane % 2 if h == 0 else lane % 2
        # No more than three in a row in one lane: step to the next one.
        run = run + 1 if lane == prev else 1
        if run > 3: lane = (lane + 1 + int(t * 7) % 2) % 4 if h is None else (lane ^ 1); run = 1
        prev = lane
        ms = int(round(t * 1000))
        if h is None and c >= sky_line:
            sky.append([ms, 18 + lane * 21]); continue
        if chords and h is None and s >= strong and t - last_chord > 0.6:
            tap.append([ms, lane]); tap.append([ms, (lane + 2) % 4]); last_chord = t
        else:
            tap.append([ms, lane])
    # Holds: a note with room after it, before a sound that carries on.
    hold, plain = [], []
    times = sorted(set(n[0] for n in tap) | set(n[0] for n in sky) | set(r[0] for r in ribbons))
    for n in tap:
        ms, lane = n; nxt = next((x for x in times if x > ms), None)
        room = ((nxt if nxt is not None else ms + 2000) - ms) / 1000
        i = int(ms / 1000 * FPS); peak = rms[i:i + 4].max() if i < len(rms) else 0
        if room >= hold_gap and ribbon_at(ms / 1000) is None and peak > 0:
            span = rms[i:i + int(room * FPS)]
            held = np.argmax(span < peak * 0.45) if (span < peak * 0.45).any() else len(span)
            length = min(room - step, held / FPS)
            if length >= 2 * step:
                end = snap(ms / 1000 + length)
                hold.append([ms, lane, int(round(end * 1000))]); continue
        plain.append(n)
    return {'tap': plain, 'hold': hold, 'sky': sky, 'ribbon': ribbons}

songs = []
for file, title, bpm, first in SONGS:
    x = load(f'public/audio/games/{file}.mp3'); dur = len(x) / SR
    peaks, cent, rms = analyse(x)
    charts = {name: chart(peaks, cent, rms, dur, bpm, first, name) for name in LEVELS}
    songs.append({'id': file, 'title': title, 'bpm': bpm, 'ms': int(dur * 1000), 'charts': charts})
    print(file, f'{dur:.0f}s', {k: {kk: len(vv) for kk, vv in v.items()} for k, v in charts.items()})
with open('src/game/data/rhythmCharts.json', 'w') as f:
    json.dump({'songs': songs}, f, separators=(',', ':'))
