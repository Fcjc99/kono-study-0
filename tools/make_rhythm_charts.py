#!/usr/bin/env python3
"""Makes KONO Beat's charts from the arcade's songs: tiles on the lead melody's notes, held to the song's
beat grid (see chart_lead; the beat itself, chart_beat, fills where the lead rests), each keeping the lead melody's pitch there for the tap notes. (chart_melody, tiles on every
melody note, is kept for reference: players found its rhythm hard to follow.) First the grid: the song's tempo and beats are tracked (fine-tuned around the listed
tempo) and lined up with where the lead really plays. Then the melody (tools/melody.py) and the levels from it
(see chart_melody): Jeff tier every melody note, Medium the strongest at least 0.2 s apart, Easy the strongest
of those at least 0.42 s apart. A note that rings on is a long tile. Columns follow the tune: higher notes to
the right, lower to the left, a repeated note in the same column.
A song with singing goes by its sung syllables instead (tools/vocals.py: the voice separated from the mix with
Demucs, then each syllable's onset and sung pitch), charted the same way (chart_lead), with the beat filling
where nobody sings. A hit plays the note being sung there, or a soft tick (pitch 0) where the voice holds no
clear note or nobody sings. Needs ffmpeg and numpy (and torch + demucs for the sung songs). Writes src/game/data/rhythmCharts.json.
  python3 tools/make_rhythm_charts.py"""
import json, subprocess, sys, os, numpy as np
sys.path.insert(0, os.path.dirname(__file__))
import melody
SR, N, HOP = 22050, 1024, 64
FPS = SR / HOP
# file, title, tempo to search around, and whether it's sung (then its tiles go on the sung syllables: see above)
SONGS = [
    ('candy', 'Skipping Motif', 120.0, False), ('gems', 'Crystal Discoveries', 100.0, False), ('blast', 'Satisfying Resolutions', 107.9, False),
    ('flow-1', 'Floating Pads', 90.75, False), ('flow-2', 'Shimmering Motif', 100.05, False), ('flow-3', 'Late Night Pulse', 113.3, False),
    ('flow-4', 'Soaring Euphoria', 129.9, False), ('flow-5', 'Transcendent Arpeggios', 136.6, False),
    ('beijing-delai', 'Beijing Delai', 130.2, True), ('casa-fantasma', 'Casa Fantasma', 124.06, True),
    ('peanut-butter-delai', 'Peanut Butter Delai', 140.24, True),
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

def chart_lead(beats, dur, swing, notes, beat_charts, rest=2, doubles=False):
    """All three levels on the lead: a tile wherever the lead melody plays a note, held to the song's grid so
    it stays in tempo. Players found tiles on the drum beat felt off from the tune they were following, and
    tiles on every melody note (chart_melody) too hard; this sits between. Easy: lead notes on a beat or the
    8th between, at least 0.42 s apart. Medium: lead notes on the 16th grid, at least 0.2 s apart. Jeff tier:
    every lead note (on the grid where it's close), at least 0.1 s apart. Stronger and longer notes, and ones
    on the beat, win when two are too close. Where the lead rests for more than about two beats, that level's
    beat chart (chart_beat) fills in, so there's always something to play. Columns follow the tune's pitch
    (lanes_of); a note that rings on is a long tile."""
    lo, hi = 2.0, dur - 4.0
    at = (0, swing / 2, swing, swing + (1 - swing) / 2)
    steps, pos = [], []
    for i in range(len(beats) - 1):
        for k in range(4): steps.append(beats[i] + (beats[i + 1] - beats[i]) * at[k]); pos.append(k)
    steps, pos = np.array(steps), np.array(pos)
    ibi = float(np.median(np.diff(beats)))
    snapped = {}
    for start, end, pitch, strength in notes:
        if start < lo or start > hi: continue
        j = int(np.argmin(abs(steps - start))); on = abs(steps[j] - start) <= 0.035
        t, k = (steps[j], int(pos[j])) if on else (start, -1)
        key = round(t, 3)
        if key not in snapped or strength > snapped[key][3]: snapped[key] = (t, end, pitch, strength, k)
    every = sorted(snapped.values())
    def pick(pool, gap, bonus):
        prio = sorted(range(len(pool)), key=lambda i: -(pool[i][3] * min(1.0, (pool[i][1] - pool[i][0]) / 0.25 + 0.4) * bonus(pool[i][4])))
        taken = []
        for i in prio:
            if all(abs(pool[i][0] - pool[k][0]) >= gap - 1e-3 for k in taken): taken.append(i)
        return [pool[i] for i in sorted(taken)]
    rules = {
        'easy': ([n for n in every if n[4] in (0, 2)], 0.42, lambda k: 1.6 if k == 0 else 1.0),
        'medium': ([n for n in every if n[4] >= 0], 0.2, lambda k: 1.4 if k == 0 else 1.2 if k == 2 else 1.0),
        'jeff': (every, 0.1, lambda k: 1.2 if k in (0, 2) else 1.0),
    }
    charts = {}
    for level, (pool, gap, bonus) in rules.items():
        ns = pick(pool, gap, bonus)
        lead_t = np.array([n[0] for n in ns]) if ns else np.zeros(0)
        # Fill the lead's rests from the beat chart: a beat tile with no lead tile within `rest` beats either side.
        fill = []
        for row in beat_charts[level]['tap'] + beat_charts[level]['hold']:
            t = row[0] / 1000
            if not len(lead_t) or np.min(abs(lead_t - t)) > rest * ibi - 0.02: fill.append((t, t, row[-1], 0.0, -2))
        ns = sorted(ns + fill)
        # Keep the level's spacing after the fill, too.
        kept = []
        for n in ns:
            if not kept or n[0] - kept[-1][0] >= gap - 1e-3: kept.append(n)
        ns = kept
        hold_min = 0.6 if level == 'easy' else 0.45
        lanes = lanes_of([n[2] for n in ns]); tap, hold = [], []
        for i, (t, end, pitch, strength, k) in enumerate(ns):
            ms = int(round(t * 1000)); nxt = ns[i + 1][0] if i + 1 < len(ns) else t + 3
            stop = min(end, nxt - 0.12)
            ends = steps[(steps > t + 0.3) & (steps <= stop + 0.03)]
            p = int(np.clip(pitch, 52, 88))
            if k != -2 and end - t >= hold_min and len(ends): hold.append([ms, lanes[i], int(round(ends[-1] * 1000)), p])
            else: tap.append([ms, lanes[i], p])
        if doubles and level == 'jeff':
            # Jeff tier on a sung song: the stronger syllables on a beat land as doubles (a second tile two columns
            # over, same time), at most one every 0.75 s and never across a held tile. The voice alone gives
            # Jeff barely more than Medium; doubles make it harder without a tile the singer doesn't sing.
            strong = sorted((n[3] for n in ns if n[4] in (0, 2)), reverse=True)
            cut = strong[int(len(strong) * 0.45)] if strong else 1e9
            last = -9.0; extra = []
            for i, (t, end, pitch, strength, k) in enumerate(ns):
                if k not in (0, 2) or strength < cut or t - last < 0.75: continue
                ms = int(round(t * 1000)); other = (lanes[i] + 2) % 4
                if any(h[1] == other and h[0] - 150 <= ms <= h[2] + 150 for h in hold): continue
                if any(r[1] == other and abs(r[0] - ms) < 150 for r in tap + extra): continue
                extra.append([ms, other, int(np.clip(pitch, 52, 88))]); last = t
            tap = sorted(tap + extra)
        charts[level] = {'tap': tap, 'hold': hold, 'sky': [], 'ribbon': []}
    return charts

def words_lead(charts, lyrics, st, sung_notes, beats=None, fills=None):
    """A sung song's tiles where its words are: while a lyric line is sung, a level's tiles are that line's word starts
    (the karaoke lights each word as it's sung, so a tile lands as its word lights), never a syllable between them.
    Jeff tier takes every word; Medium words at least 0.2 s apart, Easy 0.42 s (a line's first word always). A word
    held long (to the next word, or the line's end) is a long tile. Between lines the chart stays as it was (the
    beat fills in). Columns follow the sung pitch around each word (lanes_of).
    Jeff tier is made hard without a tile you can't hear: on top of every word it takes the further syllables the
    voice clearly sings inside a long word (st, at least 150 ms from the words around them), the song's own hits on
    the beat between words (fills, at least 150 ms from any sung tile), and doubles (a second tile two columns over,
    same time) on a line's first word and words sung on the beat, at most one every 0.75 s."""
    spans = [(l[0] - 60, l[1] + 60) for l in lyrics]
    inside = lambda ms: any(a <= ms <= b for a, b in spans)
    def pitch_at(ms):
        k = int(np.argmin(abs(st - ms / 1000))) if len(st) else -1
        return float(sung_notes[k][2]) if k >= 0 and abs(st[k] - ms / 1000) <= 0.12 else None
    rules = {'easy': (420, 600), 'medium': (200, 450), 'jeff': (100, 450)}
    for level, (gap, hold_min) in rules.items():
        c = charts[level]
        # (start, end or None, pitch or None, lane or None) for the tiles kept between lines ...
        rows = [(r[0], None, None, r[1]) for r in c['tap'] if not inside(r[0])] + [(r[0], r[2], None, r[1]) for r in c['hold'] if not inside(r[0]) and not inside(r[2])]
        words = []
        for l in lyrics:
            ws = l[3]
            for i, t in enumerate(ws):
                nxt = ws[i + 1] if i + 1 < len(ws) else l[1]
                if words and t - words[-1][0] < gap and i > 0: continue
                words.append((t, nxt, i == 0))
        # ... and one per word (a line's first word wins over the word before it when they're too close).
        kept = []
        for t, nxt, first in words:
            if kept and t - kept[-1][0] < gap:
                if first: kept[-1] = (t, nxt, first)
                continue
            kept.append((t, nxt, first))
        # A beat tile just outside a line, right next to one of its words, gives way to the word.
        wt = np.array([k[0] for k in kept]) if kept else np.zeros(0)
        rows = [r for r in rows if not len(wt) or np.min(abs(wt - r[0])) >= 250]
        extra = []
        if level == 'jeff' and len(st):
            ons = np.round(np.asarray(st) * 1000)
            for t, nxt, _ in kept:
                extra += [(float(o), None, pitch_at(o), None) for o in ons if t + 150 <= o <= nxt - 150]
            if fills is not None and beats is not None:
                bm = np.asarray(beats) * 1000
                sung_t = np.array(sorted([k[0] for k in kept] + [e[0] for e in extra]))
                for r in fills['jeff']['tap'] + fills['jeff']['hold']:
                    t = r[0]
                    if not inside(t) or np.min(abs(bm - t)) > 30: continue
                    if len(sung_t) and np.min(abs(sung_t - t)) < 150: continue
                    extra.append((t, None, None, None))
        for t, nxt, _ in kept:
            busy = any(t < e[0] < nxt for e in extra)
            end = nxt - 120 if nxt - t >= hold_min + 120 and not busy else None
            rows.append((t, end, pitch_at(t), None))
        rows += extra
        rows.sort(key=lambda r: r[0])
        # Columns: by the sung pitch where there is one (carried over where there isn't); the beat's tiles keep theirs.
        # A rapped word (no sung note) steps around the last sung one (up, down, further up...), so a run of them
        # moves across the columns instead of piling into one.
        last = 64.0; pitches = []; step = 0; walk = (0, 2, -1, 3, 1, -2)
        for r in rows:
            if r[2] is not None: last = r[2]; step = 0; pitches.append(last)
            else: pitches.append(last + walk[step % len(walk)]); step += 1
        lanes = [ln if r[3] is None else r[3] for r, ln in zip(rows, lanes_of(pitches))]
        if level == 'jeff':
            # A note repeated three times or more trills between its column and the next one (a chant on one note
            # would otherwise be one column for bars on end).
            for i in range(2, len(lanes)):
                if lanes[i] == lanes[i - 1] == lanes[i - 2]: lanes[i] = lanes[i] + 1 if lanes[i] < 3 else lanes[i] - 1
        tap, hold = [], []
        for (t, end, _, _), lane in zip(rows, lanes):
            if end is not None and end - t >= 300: hold.append([int(t), lane, int(end), 0])
            else: tap.append([int(t), lane, 0])
        if level == 'jeff' and beats is not None:
            # Doubles: a line's first word, and words sung on the beat.
            bm = np.asarray(beats) * 1000; firsts = {k[0] for k in kept if k[2]}; last = -1e9; dbl = []
            for r in sorted(tap):
                t = r[0]
                if t - last < 750 or not (t in firsts or np.min(abs(bm - t)) <= 30): continue
                if not any(abs(k[0] - t) <= 1 for k in kept): continue
                other = (r[1] + 2) % 4
                if any(h[1] == other and h[0] - 150 <= t <= h[2] + 150 for h in hold): continue
                if any(x[1] == other and abs(x[0] - t) < 150 for x in tap + dbl): continue
                dbl.append([t, other, 0]); last = t
            tap = tap + dbl
        # Never two tiles in one column closer than 90 ms, nor a tile inside a long tile of its column.
        tap = sorted(tap)
        tap = [r for i, r in enumerate(tap) if not any(h[1] == r[1] and h[0] - 90 <= r[0] <= h[2] + 90 for h in hold) and not any(x[1] == r[1] and r[0] - x[0] < 90 for x in tap[:i])]
        charts[level] = {**c, 'tap': sorted(tap), 'hold': sorted(hold)}
    return charts

def loud_hits(x):
    """Times of clear jumps in loudness (the top 3%), for the last check."""
    e = np.sqrt(np.convolve(x.astype(np.float64) ** 2, np.ones(256) / 256, 'same'))[::HOP]
    rise = np.maximum(0, np.diff(np.log(e + 1e-6))); t = (np.arange(len(rise)) + 0.5) * HOP / SR
    top = np.quantile(rise, 0.97)
    return np.array([t[i] for i in range(2, len(rise) - 2) if rise[i] > top and rise[i] == rise[i - 2:i + 3].max()])

def sung_lyric_lines(file, path, onsets):
    """A sung song's lyrics, timed (tools/sung_lyrics.py), or [] if it has none or they don't check out. The
    alignment is kept beside the voice stems (it takes a minute or two), redone when the lyrics change."""
    import hashlib, vocals, sung_lyrics
    src = f'tools/lyrics/{file}.txt'
    if not os.path.exists(src): return []
    lines = sung_lyrics.read(src)
    key = hashlib.sha1(open(src, 'rb').read()).hexdigest()[:12]
    cached = os.path.join(vocals.CACHE, 'lyrics', f'{file}-{key}.json')
    if os.path.exists(cached): words = {tuple(map(int, k.split(','))): v for k, v in json.load(open(cached)).items()}
    else:
        words = sung_lyrics.force_align(vocals.stem_path(path), lines)
        os.makedirs(os.path.dirname(cached), exist_ok=True)
        json.dump({f'{a},{b}': v for (a, b), v in words.items()}, open(cached, 'w'))
    lyr = sung_lyrics.timed(lines, words, onsets)
    chk = sung_lyrics.check(lines, lyr, onsets)
    kept = sung_lyrics.keep(lyr, chk)
    print(f'{file:7s} lyrics: {len(kept)} of {len(lines)} lines shown; {chk["repeat_lines"]} repeated lines {chk["repeat_gap"]} s apart (all repeat gaps {chk["repeat_gaps"]}); word starts on a sung onset {chk["on_onset"]:.0%} (random {chk["random_on_onset"]:.0%})')
    return kept


def main():
    songs = []
    for file, title, near, sung in SONGS:
        path = f'public/audio/games/{file}.mp3'
        x = load(path); dur = len(x) / SR
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
        on_beat = chart_beat(onset, times, cent, beats, dur, swing, notes)
        if sung:
            # The sung syllables, from the voice on its own (tools/vocals.py: needs torch and demucs).
            import vocals
            voice = vocals.stem(path, load)
            sung_notes = vocals.syllables(voice)
            # A syllable's onset as measured (the rise into its vowel) sits a little after the grid step it's sung
            # on (about 20 ms in these songs): take that out, so it snaps to its step.
            grid = np.sort(np.concatenate([beats[:-1] + (beats[1:] - beats[:-1]) * k / 4 for k in range(4)]))
            st = np.array([n[0] for n in sung_notes]); j = np.clip(np.searchsorted(grid, st), 1, len(grid) - 1)
            off = st - np.where(abs(grid[j] - st) < abs(grid[j - 1] - st), grid[j], grid[j - 1])
            lag = float(np.median(off[abs(off) < 0.05]))
            st = st - lag
            onsets = list(st)
            # Only syllables you clearly hear land (the song or the voice hits right there, on the grid step they
            # snap to); one sung softly between the hits makes a tile that feels off the beat.
            mix_r, voice_r = vocals.rise(x), vocals.rise(voice)
            jj = np.clip(np.searchsorted(grid, st), 1, len(grid) - 1)
            snap = np.where(abs(grid[jj] - st) < abs(grid[jj - 1] - st), grid[jj], grid[jj - 1])
            at = np.where(abs(snap - st) <= 0.035, snap, st)
            keep = [vocals.heard(a, mix_r, voice_r) or vocals.heard(a + lag, mix_r, voice_r) for a in at]
            sung_notes = [n for n, k in zip(sung_notes, keep) if k]; st = st[np.array(keep)]
            # Where nobody sings for more than two beats the beat fills in, but only on hits the song clearly makes.
            fills = {lv: {kind: [r for r in c[kind] if vocals.heard(r[0] / 1000, mix_r, mix_r * 0)] if kind in ('tap', 'hold') else c[kind]
                          for kind in c} for lv, c in on_beat.items()}
            charts = chart_lead(beats, dur, swing, [(a - lag, b - lag, m, w) for a, b, m, w, _ in sung_notes], fills, rest=1, doubles=True)
            # The lyrics, lined up with the singing for the karaoke line (tools/sung_lyrics.py), kept only as far
            # as they check out. `onsets`: every sung syllable, on the song's grid like the tiles.
            lyrics = sung_lyric_lines(file, path, onsets)
            # While a line is sung, the tiles are its words (see words_lead): a tile lands as its word lights.
            if lyrics: charts = words_lead(charts, lyrics, st, sung_notes, beats, fills)
            # What a hit plays: the note the voice is singing on that tile, or (0) the soft tick where it holds no
            # clear note (a rapped word) or nobody sings (a tile from the beat).
            for c in charts.values():
                for row in c['tap'] + c['hold']:
                    k = int(np.argmin(abs(st - row[0] / 1000)))
                    row[-1] = sung_notes[k][4] if abs(st[k] - row[0] / 1000) <= 0.036 else 0
            pitched = [r[-1] for c in charts.values() for r in c['tap'] + c['hold'] if r[-1]]
            share, _ = vocals.in_key(pitched)
            print(f'{file:7s} sung syllables {len(keep)}, {len(sung_notes)} clearly heard (voice {lag * 1000:+.0f} ms off the grid), {sum(n[4] > 0 for n in sung_notes)} with a clear sung note; notes in key {share:.0%}')
        else:
            charts = chart_lead(beats, dur, swing, notes, on_beat)
        first = float(beats[0] % (60 / bpm))
        print(f'{file:7s} {dur:.0f}s bpm {bpm:.2f} swing {swing:.2f} melody notes {len(notes)}', {k: (len(v["tap"]), len(v["hold"])) for k, v in charts.items()})
        songs.append({'id': file, 'title': title, 'bpm': round(float(bpm), 3), 'first': round(first, 3), 'swing': round(swing, 3), 'ms': int(dur * 1000), **({'lyrics': lyrics} if sung and lyrics else {}), 'charts': charts})
    with open('src/game/data/rhythmCharts.json', 'w') as f:
        json.dump({'songs': songs}, f, separators=(',', ':'))


if __name__ == '__main__':
    main()
