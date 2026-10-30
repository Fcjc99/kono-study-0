#!/usr/bin/env python3
"""Makes KONO Beat's charts from the arcade's songs, with every note on the song's own beat grid.
First the grid: the song's tempo and first beat are measured (fine-tuned around the listed tempo) and then
re-locked every couple of bars, so a song that drifts a little still lines up. Then the levels, each from the
one above (see chart_all): Jeff tier on 16th notes where the music clearly hits (up to about 4 a second, with
chords on the big hits), Medium the strongest of those on 8th notes (about 2), Easy the strongest of Medium's
on the beat (about 1). A note before a sound that carries on becomes a hold. Lanes go by how
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

def track_beats(onset, times, near):
    """The song's beats one by one (dynamic-programming beat tracking, after Ellis 2007): the tempo near the
    listed one that the hits repeat at best, then the chain of beats that lands on the most hits while keeping
    that tempo, so it follows a song that drifts and sits on the strong hits even when they aren't where a
    plain grid would put them."""
    fps = 1 / (times[1] - times[0]); o = onset / (onset.std() + 1e-9)
    best, period = -1, fps * 60 / near
    for bpm in np.arange(near * 0.97, near * 1.03, 0.01):
        p = fps * 60 / bpm; lag = int(round(p)); frac = p - lag
        a = o[:-lag - 1]; c = (1 - frac) * np.dot(a, o[lag:-1]) + frac * np.dot(a, o[lag + 1:])
        if c > best: best, period = c, p
    n = len(o); score = o.copy(); back = np.full(n, -1)
    lo_w, hi_w = int(round(period / 2)), int(round(period * 2))
    for t in range(lo_w, n):
        taus = np.arange(max(0, t - hi_w), t - lo_w + 1)
        if not len(taus): continue
        cand = score[taus] - 400 * np.log((t - taus) / period) ** 2
        k = int(np.argmax(cand))
        if cand[k] > 0: score[t] += cand[k]; back[t] = taus[k]
    t = int(np.argmax(score[-int(period):])) + n - int(period); beats = []
    while t >= 0: beats.append(times[t]); t = back[t]
    beats = np.array(beats[::-1])
    # Before the first tracked beat and after the last, carry the tempo on.
    ibi = period / fps
    pre = np.arange(beats[0] - ibi, -ibi, -ibi)[::-1]; post = np.arange(beats[-1] + ibi, times[-1] + ibi, ibi)
    return np.concatenate([pre[pre >= 0], beats, post]), 60 / ibi

def swing_of(beats, hits):
    """Where the off-beat 8th falls in this song's beats: 0.5 played straight, up to 0.67 for a triplet shuffle."""
    i = np.searchsorted(beats, hits) - 1; ok = (i >= 0) & (i < len(beats) - 1)
    ph = (hits[ok] - beats[i[ok]]) / (beats[i[ok] + 1] - beats[i[ok]])
    h, e = np.histogram(ph, bins=40, range=(0.4, 0.8)); h = np.convolve(h, [1, 2, 1], 'same')
    return float(np.clip((e[np.argmax(h)] + e[np.argmax(h) + 1]) / 2, 0.5, 0.67)) if h.max() > 0 else 0.5

def chart_all(flux, times, cent, rms, beats, dur, swing=0.5):
    """All three levels, each built from the one above it, so they agree: Jeff tier takes the 16th-note steps
    where the music clearly hits; Medium keeps the strongest of those on 8th notes; Easy the strongest of
    Medium's on the beat. A note has the same lane on every level. Each 2-bar stretch gets its share of notes
    by how much is going on in it (silent stretches get none), so a quieter part still has notes instead of
    the loudest part taking them all; and a stretch with music but nothing picked gets its strongest beat."""
    lo, hi = 2.0, dur - 4.0
    steps, pos = [], []
    # The 16th-note steps of each beat; the off-beat 8th sits where this song swings it.
    at = (0, swing / 2, swing, swing + (1 - swing) / 2)
    for i in range(len(beats) - 1):
        for k in range(4):
            steps.append(beats[i] + (beats[i + 1] - beats[i]) * at[k]); pos.append(k)
    steps, pos = np.array(steps), np.array(pos)
    keep = (steps >= lo) & (steps <= hi); steps, pos = steps[keep], pos[keep]
    win = int(0.03 * FPS); idx = np.searchsorted(times, steps)
    strength = np.array([flux[max(0, i - win):i + win + 1].max() if i < len(flux) else 0 for i in idx])
    hit = np.quantile(flux, 0.9)  # a clear hit, not just the background
    score = strength * np.where(pos == 0, 1.25, np.where(pos == 2, 1.1, 1.0))
    # 2-bar stretches: how busy each is, and whether it's silent.
    bar2 = 8 * (beats[1] - beats[0]); wid = ((steps - steps[0]) // bar2).astype(int)
    med_s = np.median(strength[strength > 0]); med_r = np.median(rms)
    busy, silent = {}, {}
    for w in np.unique(wid):
        m = wid == w; j0, j1 = idx[m][0], idx[m][-1] + 1
        busy[w] = float(np.clip(strength[m].mean() / med_s, 0.5, 1.15))
        silent[w] = rms[j0:j1].mean() < 0.08 * med_r
    chosen = {}
    def pick(level, pool):
        div, gap, density, _ = LEVELS[level]; out = []
        for w in np.unique(wid):
            if silent[w]: continue
            cand = [i for i in pool if wid[i] == w]
            quota = int(round(density * bar2 * busy[w]))
            for i in sorted(cand, key=lambda i: -score[i]):
                if sum(1 for k in out if wid[k] == w) >= quota: break
                if all(abs(steps[i] - steps[k]) >= gap - 1e-3 for k in out): out.append(i)
        return sorted(out)
    chosen['jeff'] = pick('jeff', [i for i in range(len(steps)) if strength[i] > hit])
    chosen['medium'] = pick('medium', [i for i in chosen['jeff'] if pos[i] % 2 == 0])
    chosen['easy'] = pick('easy', [i for i in chosen['medium'] if pos[i] == 0])
    # A stretch with music but no notes on a level gets its strongest step there (on all the harder levels too).
    for level, ok in (('easy', lambda i: pos[i] == 0), ('medium', lambda i: pos[i] % 2 == 0)):
        for w in np.unique(wid):
            if silent[w] or any(wid[k] == w for k in chosen[level]): continue
            cand = [i for i in range(len(steps)) if wid[i] == w and ok(i) and strength[i] > hit * 0.5]
            if not cand: continue
            i = max(cand, key=lambda i: score[i])
            for lv in ('easy', 'medium', 'jeff')[('easy', 'medium').index(level):]:
                gap = LEVELS[lv][1]
                if i not in chosen[lv] and all(abs(steps[i] - steps[k]) >= gap - 1e-3 for k in chosen[lv]): chosen[lv] = sorted(chosen[lv] + [i])
    # Lanes, once, on Jeff tier's notes (every level uses the same): by how bright, no more than 3 in a row.
    every = sorted(set(chosen['jeff']) | set(chosen['medium']) | set(chosen['easy']))
    c = np.array([cent[min(len(cent) - 1, idx[i])] for i in every]); edges = np.quantile(c, [0.25, 0.5, 0.75])
    lane_of, run, prev = {}, 0, -1
    for i, ci in zip(every, c):
        lane = int(np.searchsorted(edges, ci)); run = run + 1 if lane == prev else 1
        if run > 3: lane = int((lane + 1 + i % 2) % 4); run = 1
        lane_of[i] = lane; prev = lane
    strong = np.quantile(strength[chosen['jeff']], 0.94)
    grid_ms = np.round(steps * 1000); charts = {}
    for level in LEVELS:
        hold_gap = LEVELS[level][3]; tap, last_chord = [], -9
        for i in chosen[level]:
            ms = int(round(steps[i] * 1000)); tap.append([ms, lane_of[i]])
            if level == 'jeff' and strength[i] >= strong and steps[i] - last_chord > 0.6:
                tap.append([ms, (lane_of[i] + 2) % 4]); last_chord = steps[i]
        # Holds: a note with room after it, before a sound that carries on; it ends on the grid.
        times_ms = sorted(set(n[0] for n in tap)); hold, plain = [], []
        for n in tap:
            ms, lane = n; nxt = next((x for x in times_ms if x > ms), ms + 2000); room = (nxt - ms) / 1000
            j = int(np.searchsorted(times, ms / 1000)); peak = rms[j:j + 8].max() if j < len(rms) else 0
            if room >= hold_gap and peak > 0 and sum(1 for m in tap if m[0] == ms) == 1:
                span = rms[j:j + int(room * FPS)]; quiet = span < peak * 0.45
                held = (np.argmax(quiet) if quiet.any() else len(span)) / FPS
                ends = grid_ms[(grid_ms > ms) & (grid_ms <= ms + min(room * 1000 - 120, held * 1000))]
                if len(ends) and ends[-1] - ms >= 250:
                    hold.append([ms, lane, int(ends[-1])]); continue
            plain.append(n)
        charts[level] = {'tap': plain, 'hold': hold, 'sky': [], 'ribbon': []}
    return charts

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
    hits = loud_hits(x)
    beats, bpm = track_beats(flux, times, near)
    swing = swing_of(beats, hits)
    # Last check: line the beats up with where the music really hits (plain loudness jumps, which are exact in
    # time), so the notes land on what you hear, not a few ms before or after it.
    for _ in range(4):
        charts = chart_all(flux, times, cent, rms, beats, dur, swing)
        notes = np.array([n[0] for c in charts.values() for n in c['tap'] + c['hold']]) / 1000
        j = np.clip(np.searchsorted(hits, notes), 1, len(hits) - 1)
        near_hit = np.where(abs(hits[j] - notes) < abs(hits[j - 1] - notes), hits[j], hits[j - 1]); off = near_hit - notes
        off = off[abs(off) < 0.05]
        shift = float(np.median(off)) if len(off) else 0
        if abs(shift) < 0.003: break
        beats = beats + shift
    charts = chart_all(flux, times, cent, rms, beats, dur, swing)
    first = float(beats[0] % (60 / bpm))
    print(f'{file:7s} {dur:.0f}s bpm {bpm:.2f} swing {swing:.2f} beats {len(beats)}', {k: (len(v["tap"]), len(v["hold"])) for k, v in charts.items()})
    songs.append({'id': file, 'title': title, 'bpm': round(float(bpm), 3), 'first': round(first, 3), 'swing': round(swing, 3), 'ms': int(dur * 1000), 'charts': charts})
with open('src/game/data/rhythmCharts.json', 'w') as f:
    json.dump({'songs': songs}, f, separators=(',', ':'))
