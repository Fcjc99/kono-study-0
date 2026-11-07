#!/usr/bin/env python3
"""Makes KONO Beat's charts from the arcade's songs: tiles on the song's beat, where it really hits (see
chart_beat), each keeping the lead melody's pitch there for the tap notes. (chart_melody, tiles on every
melody note, is kept for reference: players found its rhythm hard to follow.) First the grid: the song's tempo and beats are tracked (fine-tuned around the listed
tempo) and lined up with where the lead really plays. Then the melody (tools/melody.py) and the levels from it
(see chart_melody): Jeff tier every melody note, Medium the strongest at least 0.2 s apart, Easy the strongest
of those at least 0.42 s apart. A note that rings on is a long tile. Columns follow the tune: higher notes to
the right, lower to the left, a repeated note in the same column.
Needs ffmpeg and numpy. Writes src/game/data/rhythmCharts.json.
  python3 tools/make_rhythm_charts.py"""
import json, subprocess, sys, os, numpy as np
sys.path.insert(0, os.path.dirname(__file__))
import melody
SR, N, HOP = 22050, 1024, 64
FPS = SR / HOP
# file, title, tempo to search around
SONGS = [
    ('candy', 'Skipping Motif', 120.0), ('gems', 'Crystal Discoveries', 100.0), ('blast', 'Satisfying Resolutions', 107.9),
    ('flow-1', 'Floating Pads', 90.75), ('flow-2', 'Shimmering Motif', 100.05), ('flow-3', 'Late Night Pulse', 113.3),
    ('flow-4', 'Soaring Euphoria', 129.9), ('flow-5', 'Transcendent Arpeggios', 136.6),
]

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

def lanes_of(pitches):
    """Columns for a run of notes, the way a piano reads: higher notes to the right, lower to the left, a
    repeated note in the same column. Each note's column comes from where its pitch sits among its
    neighbours (about two bars either side), then is nudged so it moves the same way the tune does."""
    p = np.array(pitches, float); out = []
    for i in range(len(p)):
        w = p[max(0, i - 8):i + 9]; lo, hi = np.percentile(w, 10), np.percentile(w, 90)
        lane = int(np.clip(round((p[i] - lo) / max(1, hi - lo) * 3), 0, 3))
        if out:
            prev, d = out[-1], p[i] - p[i - 1]
            if d == 0: lane = prev
            elif d > 0 and lane <= prev: lane = prev + 1 if prev < 3 else 2
            elif d < 0 and lane >= prev: lane = prev - 1 if prev > 0 else 1
        out.append(lane)
    return out

def chart_melody(notes, beats, dur, swing=0.5):
    """All three levels from the song's lead melody (tools/melody.py), so every tile is a note you hear the
    lead play. Each note's start is put on the song's 16th-note grid when it's within 35 ms of it (they nearly
    always are), so it lands exactly with the music. Jeff tier gets every melody note (at least 0.1 s apart),
    Medium the strongest of those at least 0.2 s apart, Easy the strongest of Medium's at least 0.42 s apart,
    favouring notes on the beat. A note that rings on becomes a long tile that ends when it does."""
    lo, hi = 2.0, dur - 4.0
    at = (0, swing / 2, swing, swing + (1 - swing) / 2)
    steps, pos = [], []
    for i in range(len(beats) - 1):
        for k in range(4): steps.append(beats[i] + (beats[i + 1] - beats[i]) * at[k]); pos.append(k)
    steps, pos = np.array(steps), np.array(pos)
    cand = {}
    for start, end, pitch, strength in notes:
        if start < lo or start > hi: continue
        j = int(np.argmin(abs(steps - start)))
        t = steps[j] if abs(steps[j] - start) <= 0.035 else start
        k = pos[j] if abs(steps[j] - start) <= 0.035 else -1
        key = round(t, 3)
        if key not in cand or strength > cand[key][3]:
            cand[key] = (t, end, pitch, strength, k)
    every = sorted(cand.values())
    def pick(pool, gap, bonus):
        prio = sorted(range(len(pool)), key=lambda i: -(pool[i][3] * min(1.0, (pool[i][1] - pool[i][0]) / 0.25 + 0.4) * bonus(pool[i][4])))
        taken = []
        for i in prio:
            if all(abs(pool[i][0] - pool[k][0]) >= gap - 1e-3 for k in taken): taken.append(i)
        return [pool[i] for i in sorted(taken)]
    level_notes = {'jeff': pick(every, 0.1, lambda k: 1.0)}
    level_notes['medium'] = pick(level_notes['jeff'], 0.2, lambda k: 1.3 if k in (0, 2) else 1.0)
    level_notes['easy'] = pick(level_notes['medium'], 0.42, lambda k: 1.5 if k == 0 else 1.15 if k == 2 else 1.0)
    charts = {}
    for level, ns in level_notes.items():
        hold_min = 0.5 if level == 'easy' else 0.4
        lanes = lanes_of([n[2] for n in ns]); tap, hold = [], []
        for i, (t, end, pitch, strength, k) in enumerate(ns):
            ms = int(round(t * 1000)); nxt = ns[i + 1][0] if i + 1 < len(ns) else t + 3
            # A long tile ends on the grid step nearest where the note stops (and leaves room before the next).
            stop = min(end, nxt - 0.12)
            ends = steps[(steps > t + 0.25) & (steps <= stop + 0.03)]
            if end - t >= hold_min and len(ends):
                hold.append([ms, lanes[i], int(round(ends[-1] * 1000)), int(pitch)])
            else:
                tap.append([ms, lanes[i], int(pitch)])
        charts[level] = {'tap': tap, 'hold': hold, 'sky': [], 'ribbon': []}
    return charts

def chart_beat(onset, times, cent, beats, dur, swing, notes):
    """All three levels on the song's beat (what a listener taps along to), not its melody: a tile wherever
    the song really hits on its grid. Easy: the beats that land on a clear hit. Medium: those, plus the
    off-beat 8ths that hit hard. Jeff tier: those, plus the strong 16ths. A tile where the lead holds a
    note for long is a long tile. Columns go by the sound: low hits (kick) toward the left, bright ones
    (snare, hats) toward the right, never the same column twice in a row so the hands keep moving. Each
    tile keeps the melody's pitch at that moment, for the tap notes."""
    lo, hi = 2.0, dur - 4.0
    at = (0, swing / 2, swing, swing + (1 - swing) / 2)
    steps, pos = [], []
    for i in range(len(beats) - 1):
        for k in range(4): steps.append(beats[i] + (beats[i + 1] - beats[i]) * at[k]); pos.append(k)
    steps, pos = np.array(steps), np.array(pos)
    keep = (steps >= lo) & (steps <= hi); steps, pos = steps[keep], pos[keep]
    ref = np.percentile(onset, 97) + 1e-9
    def hit(t):
        w = (times > t - 0.035) & (times < t + 0.035)
        return float(onset[w].max() / ref) if w.any() else 0.0
    strength = np.array([hit(t) for t in steps])
    bright = np.interp(steps, times, cent)
    rules = {'easy': ((0,), 0.30, 0.40), 'medium': ((0, 2), 0.30, 0.20), 'jeff': ((0, 1, 2, 3), 0.30, 0.10)}
    # A beat counts on its own; an off-beat or 16th only when it hits harder (otherwise it's just the
    # beat's echo or a hi-hat tick nobody taps to).
    need = {0: 0.30, 2: 0.65, 1: 0.85, 3: 0.85}
    starts = np.array([n[0] for n in notes]) if notes else np.zeros(0)
    def pitch_at(t, last):
        if len(starts):
            j = int(np.argmin(abs(starts - t)))
            if abs(starts[j] - t) < 0.08: return int(notes[j][2])
            for s0, e0, m0, _ in notes:
                if s0 <= t < e0: return int(m0)
        return last
    charts = {}
    for level, (ks, _, gap) in rules.items():
        chosen = []
        for t, k, st in zip(steps, pos, strength):
            if k in ks and st >= need[k] and (not chosen or t - chosen[-1] >= gap - 1e-3): chosen.append(t)
        chosen = np.array(chosen)
        b = np.interp(chosen, steps, bright)
        # Brightness ranked against the nearby tiles (about two bars), so a quiet intro still spreads out.
        lanes, last_pitch, tap, hold = [], 64, [], []
        for i, t in enumerate(chosen):
            w = b[max(0, i - 8):i + 9]; lo_b, hi_b = np.percentile(w, 15), np.percentile(w, 85)
            lane = int(np.clip(round((b[i] - lo_b) / max(1e-9, hi_b - lo_b) * 3), 0, 3))
            if lanes and lane == lanes[-1]: lane = lane + 1 if (i % 2 == 0 and lane < 3) or lane == 0 else lane - 1
            lanes.append(lane)
            last_pitch = int(np.clip(pitch_at(t, last_pitch), 52, 88))
            ms = int(round(t * 1000)); nxt = chosen[i + 1] if i + 1 < len(chosen) else t + 3
            # A long tile where the lead starts a note here and holds it past the next beat.
            long_note = next((n for n in notes if abs(n[0] - t) < 0.08 and n[1] - n[0] >= (0.8 if level == 'easy' else 0.6)), None) if notes else None
            ends = steps[(steps > t + 0.3) & (steps <= min(long_note[1], nxt - 0.12) + 0.03)] if long_note else []
            if long_note and len(ends): hold.append([ms, lane, int(round(ends[-1] * 1000)), last_pitch])
            else: tap.append([ms, lane, last_pitch])
        charts[level] = {'tap': tap, 'hold': hold, 'sky': [], 'ribbon': []}
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
    onset, times, cent, rms = analyse(x); flux = onset
    beats, bpm = track_beats(flux, times, near)
    swing = swing_of(beats, loud_hits(x))
    notes = melody.notes_of(x)
    # Line the grid up with where the lead really plays (its attacks are exact): shift the beats by how far,
    # in the middle, the melody's notes sit from their nearest grid step.
    for _ in range(3):
        grid = np.sort(np.concatenate([beats[:-1] + (beats[1:] - beats[:-1]) * k / 4 for k in range(4)]))
        st = np.array([n[0] for n in notes]); j = np.clip(np.searchsorted(grid, st), 1, len(grid) - 1)
        near_step = np.where(abs(grid[j] - st) < abs(grid[j - 1] - st), grid[j], grid[j - 1]); off = st - near_step
        off = off[abs(off) < 0.035]; shift = float(np.median(off)) if len(off) else 0
        if abs(shift) < 0.002: break
        beats = beats + shift
    charts = chart_beat(onset, times, cent, beats, dur, swing, notes)
    first = float(beats[0] % (60 / bpm))
    print(f'{file:7s} {dur:.0f}s bpm {bpm:.2f} swing {swing:.2f} melody notes {len(notes)}', {k: (len(v["tap"]), len(v["hold"])) for k, v in charts.items()})
    songs.append({'id': file, 'title': title, 'bpm': round(float(bpm), 3), 'first': round(first, 3), 'swing': round(swing, 3), 'ms': int(dur * 1000), 'charts': charts})
with open('src/game/data/rhythmCharts.json', 'w') as f:
    json.dump({'songs': songs}, f, separators=(',', ':'))
