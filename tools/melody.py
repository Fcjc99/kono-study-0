"""The lead melody of a song, as notes (start, end, MIDI pitch, strength), for KONO Beat's charts
(tools/make_rhythm_charts.py). numpy only.

How (a small version of what melody extractors like Melodia do):
1. A spectrogram whose steady parts (pads, held chords, the hum of the mix) are taken out: each frequency's
   level over the last ~1.5 s is subtracted, so what's left is what's moving (a lead, its new notes).
2. For each frame, how strongly each pitch from E3 to E6 is there: its harmonics added up (each a bit less),
   minus what sits between them, so a bright chord or a drum hit doesn't look like one strong note.
3. The melody line through those: the path that's strongest overall but is costly to jump around (Viterbi),
   so it follows one voice instead of hopping between the lead, an arpeggio and the bass.
4. Notes: where that line holds a semitone, a new note where it moves to another one or the lead plays the
   same note again (a fresh attack), and silence where it's weak.
5. Each note's start moved to its attack: the steepest rise of that pitch's own harmonics nearby."""
import numpy as np

SR, N, HOP = 22050, 2048, 256
FPS = SR / HOP
LO, HI, SUB = 52, 88, 3          # MIDI E3..E6, in thirds of a semitone
H, DECAY = 8, 0.82                # harmonics added, each this much weaker


def _spectrum(x):
    frames = np.lib.stride_tricks.sliding_window_view(np.pad(x, N // 2), N)[::HOP] * np.hanning(N).astype(np.float32)
    mag = np.abs(np.fft.rfft(frames, axis=1)).astype(np.float32)
    return np.log1p(30 * mag / (mag.max() + 1e-9))


def _salience_matrix():
    """For each candidate pitch, the weights that add its harmonics up from the spectrum (between bins
    shared out linearly), less a little for the bins halfway between its harmonics."""
    bins = N // 2 + 1
    mids = np.arange(LO * SUB, HI * SUB + 1) / SUB
    W = np.zeros((len(mids), bins), np.float32)
    for c, m in enumerate(mids):
        f0 = 440 * 2 ** ((m - 69) / 12)
        for h in range(1, H + 1):
            for f, w in ((f0 * h, DECAY ** (h - 1)), (f0 * (h + 0.5), -0.35 * DECAY ** (h - 1))):
                b = f / (SR / N)
                if b >= bins - 1: continue
                i = int(b); k = b - i
                W[c, i] += w * (1 - k); W[c, i + 1] += w * k
    return mids, W


def _moving(spec):
    """The spectrogram less each frequency's recent level (about 1.5 s, running), never below zero."""
    k = int(1.5 * FPS)
    c = np.cumsum(np.vstack([np.zeros((1, spec.shape[1]), np.float32), spec]), axis=0)
    idx = np.arange(spec.shape[0])
    lo = np.maximum(0, idx - k)
    mean = (c[idx + 1] - c[lo]) / (idx + 1 - lo)[:, None]
    return np.maximum(0, spec - 0.85 * mean)


def _track(sal, mids, top=6, jump=0.45):
    """The melody line: per frame one of its strongest pitches, chosen so the whole path is strong and rarely
    jumps (each semitone of jump costs `jump`; an octave costs as much as a fair note)."""
    n = sal.shape[0]
    cand = np.argsort(-sal, axis=1)[:, :top]
    val = np.take_along_axis(sal, cand, axis=1)
    val = val / (np.percentile(val[:, 0], 95) + 1e-9)
    score = val[0].copy(); back = np.zeros((n, top), np.int32)
    for t in range(1, n):
        d = np.abs(mids[cand[t]][:, None] - mids[cand[t - 1]][None, :])
        tot = score[None, :] - jump * d
        back[t] = np.argmax(tot, axis=1)
        score = tot[np.arange(top), back[t]] + val[t]
    path = np.zeros(n, np.int32); j = int(np.argmax(score))
    for t in range(n - 1, -1, -1):
        path[t] = cand[t, j]; j = back[t, j]
    strength = sal[np.arange(n), path]
    return mids[path], strength


def notes_of(x):
    spec = _spectrum(x)
    mov = _moving(spec)
    mids, W = _salience_matrix()
    sal = np.maximum(0, mov @ W.T)
    pitch, strength = _track(sal, mids)
    # Voiced where the line is clearly there (relative to the song's own strong parts).
    ref = np.percentile(strength, 90)
    voiced = strength > 0.28 * ref
    semi = np.round(pitch).astype(int)
    # A short run of another semitone inside a note is wobble, not a note: smooth it over (5 frames).
    for t in range(2, len(semi) - 2):
        w = semi[t - 2:t + 3]
        vals, counts = np.unique(w, return_counts=True)
        if counts.max() >= 3: semi[t] = vals[np.argmax(counts)]
    # The energy of each frame's own pitch (its first 4 harmonics), to find re-attacks of the same note.
    bins = spec.shape[1]
    own = np.zeros(len(semi), np.float32)
    for t, m in enumerate(semi):
        f0 = 440 * 2 ** ((m - 69) / 12)
        for h in range(1, 5):
            b = int(round(f0 * h / (SR / N)))
            if b < bins: own[t] += mov[t, max(0, b - 1):b + 2].max()
    notes = []
    t, n = 0, len(semi)
    while t < n:
        if not voiced[t]: t += 1; continue
        s = t; m = semi[t]
        t += 1
        while t < n and voiced[t] and semi[t] == m:
            # The same note struck again: its own energy jumps after a dip.
            if t - s >= 6 and own[t] > 1.6 * own[t - 3] and own[t] > 0.5 * own[s:t].max(): break
            t += 1
        dur = (t - s) / FPS
        if dur >= 0.07:
            notes.append([s, t, int(m), float(strength[s:t].mean())])
    # Each start moved to its attack: the steepest rise of its own harmonics within 50 ms before or after.
    out = []
    r = int(0.05 * FPS)
    for s, e, m, st in notes:
        a, b = max(1, s - r), min(n - 1, s + r)
        f0 = 440 * 2 ** ((m - 69) / 12)
        band = np.zeros(b - a + 1, np.float32)
        for h in range(1, 5):
            k = int(round(f0 * h / (SR / N)))
            if k < bins: band += spec[a - 1:b, max(0, k - 1):k + 2].max(axis=1)
        rise = np.diff(band)
        at = a + int(np.argmax(rise)) if len(rise) else s
        out.append((at / FPS, e / FPS, m, st))
    return out
