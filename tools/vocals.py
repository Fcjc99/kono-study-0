"""The sung syllables of a song, for KONO Beat's charts of its sung songs (tools/make_rhythm_charts.py).

1. The voice on its own: Demucs (htdemucs, two stems) separates it from the mix. This is an offline chart
   tool only, so torch and demucs are needed just here, and only when a sung song is charted:
     pip install torch torchaudio demucs
   The stem is cached (KONO_STEMS, default ~/.cache/kono-stems) so a rerun doesn't separate again.
2. Each syllable: a peak of the voice's loudness that stands clear of the dips around it (a syllable nucleus,
   so consonants, breaths and reverb tails don't count), starting at the steepest rise into it.
3. Each syllable's note: the pitch the voice clearly holds there (YIN on the voice stem), or none where it's
   rapped or spoken, so a hit never plays a note the singer isn't singing.
Gives (start, end, MIDI pitch, strength, sung) for chart_lead (the first four, like melody.notes_of)."""
import os, subprocess, sys, numpy as np
sys.path.insert(0, os.path.dirname(__file__))
import melody

SR, HOP = 22050, 64
FPS = SR / HOP


CACHE = os.environ.get('KONO_STEMS', os.path.expanduser('~/.cache/kono-stems'))


def stem_path(path):
    """Where the voice of the song at `path` is kept (separated the first time it's asked for)."""
    name = os.path.splitext(os.path.basename(path))[0]
    out = os.path.join(CACHE, 'htdemucs', name, 'vocals.wav')
    if not os.path.exists(out):
        subprocess.run([sys.executable, '-m', 'demucs', '--two-stems=vocals', '-n', 'htdemucs', '-o', CACHE, path], check=True)
    return out


def stem(path, load):
    """The voice of the song at `path`, mono at SR (separated once, then cached)."""
    return load(stem_path(path))


def _envelope(v):
    """The voice's loudness (dB) in the band where vowels sit (250-3500 Hz), smoothed over 40 ms, per HOP frame."""
    N = 1024
    frames = np.lib.stride_tricks.sliding_window_view(v, N)[::HOP] * np.hanning(N)
    mag = np.abs(np.fft.rfft(frames, axis=1)); f = np.fft.rfftfreq(N, 1 / SR)
    e = 10 * np.log10((mag[:, (f > 250) & (f < 3500)] ** 2).sum(axis=1) + 1e-9)
    w = np.hanning(int(0.04 * FPS)); e = np.convolve(e, w / w.sum(), 'same')
    return e, (np.arange(len(e)) * HOP + N / 2) / SR


def _nuclei(e, prom=5.0, reach=0.6):
    """Syllable nuclei (after de Jong & Wempe 2009): peaks of the voice's loudness that stand at least `prom` dB
    above the dips on both sides (looking up to `reach` s each way). Each with its left dip and prominence."""
    n, r = len(e), int(reach * FPS); out = []
    for i in range(1, n - 1):
        if not (e[i] >= e[i - 1] and e[i] > e[i + 1]): continue
        L = i
        while L > 0 and e[L - 1] <= e[i] and i - L < r: L -= 1
        R = i
        while R < n - 1 and e[R + 1] <= e[i] and R - i < r: R += 1
        dip_l = L + int(np.argmin(e[L:i + 1]))
        p = e[i] - max(e[dip_l], e[i:R + 1].min())
        if p >= prom: out.append((i, dip_l, p))
    return out


def yin(x, n=2048, hop=128, fmin=65, fmax=1000, thr=0.15):
    """The voice's pitch per frame (YIN, de Cheveigne & Kawahara 2002) as MIDI, NaN where it holds no clear
    pitch (unvoiced, breathy or quiet). Frame i is centred at (i * hop + n / 2) / SR."""
    fr = np.lib.stride_tricks.sliding_window_view(x.astype(np.float64), n)[::hop]
    W, tmax, tmin = n // 2, int(SR / fmin), int(SR / fmax)
    # d(tau) = sum over the first W samples of (x_j - x_(j+tau))^2, from running energies and a cross-correlation.
    pad = np.hstack([np.zeros((len(fr), 1)), np.cumsum(fr ** 2, axis=1)])
    e0 = pad[:, W:W + 1]; et = pad[:, W:W + tmax + 1] - pad[:, :tmax + 1]
    r = np.fft.irfft(np.conj(np.fft.rfft(fr[:, :W], 2 * n)) * np.fft.rfft(fr, 2 * n))[:, :tmax + 1]
    d = e0 + et - 2 * r; d[:, 0] = 0
    dn = np.ones_like(d); dn[:, 1:] = d[:, 1:] / (np.cumsum(d[:, 1:], axis=1) / np.arange(1, tmax + 1) + 1e-12)
    loud = 10 * np.log10(e0[:, 0] / W + 1e-12); quiet = loud < np.percentile(loud, 95) - 25
    out = np.full(len(fr), np.nan)
    for i in range(len(fr)):
        if quiet[i]: continue
        row = dn[i]; below = np.where(row[tmin:] < thr)[0]
        if not len(below): continue
        t = below[0] + tmin
        while t < tmax and row[t + 1] < row[t]: t += 1
        if row[t] > 0.2 or t >= tmax: continue
        a, b, c = row[t - 1], row[t], row[t + 1]; den = a - 2 * b + c
        out[i] = 69 + 12 * np.log2(SR / (t + (0.5 * (a - c) / den if den else 0)) / 440)
    return out


def _fold(m, lo=52, hi=88):
    """A pitch moved by octaves into the game's range (rather than clamped onto a wrong note)."""
    while m < lo: m += 12
    while m > hi: m -= 12
    return m


def syllables(v):
    """(start, end, MIDI pitch, strength, sung) for each sung syllable in the voice stem `v`. A syllable is a
    nucleus of the voice's loudness (see _nuclei) where it's really singing (within 25 dB of its loud parts); it
    starts at the steepest rise into it and lasts while the voice stays within 10 dB of its peak. `sung` is the
    note the voice clearly holds there (YIN over its first 150 ms, steady to within a semitone), or 0 where it
    holds none (a rapped or spoken syllable): then a hit shouldn't play a note. `pitch` (for the columns) is
    that note, else the nearest note melody.notes_of finds."""
    e, times = _envelope(v)
    loud = np.percentile(e, 95)
    nuc = [(i, d, p) for i, d, p in _nuclei(e) if e[i] > loud - 25]
    notes = melody.notes_of(v)
    f0 = yin(v); ft = (np.arange(len(f0)) * 128 + 1024) / SR
    out = []
    for a, (i, dip, prom) in enumerate(nuc):
        rise = np.diff(e[dip:i + 1])
        k0 = dip + int(np.argmax(rise)) + 1 if len(rise) else i
        t = float(times[k0])
        nxt_dip = nuc[a + 1][1] if a + 1 < len(nuc) else len(e) - 1
        k = i
        while k < nxt_dip and e[k] > e[i] - 10: k += 1
        end = float(times[k])
        w = f0[(ft >= t + 0.02) & (ft < min(end, t + 0.17))]
        good = w[~np.isnan(w)]
        sung = 0
        if len(w) >= 4 and len(good) >= 0.6 * len(w):
            m = float(np.median(good))
            if np.percentile(good, 80) - np.percentile(good, 20) <= 1.0 and abs(m - round(m)) <= 0.35: sung = _fold(int(round(m)))
        pitch = sung or None
        tp = float(times[i])
        if pitch is None:
            for s0, e0, m0, _ in notes:
                if s0 - 0.03 <= tp < e0: pitch = m0; break
        if pitch is None and notes:
            j = int(np.argmin([abs(n0[0] - tp) for n0 in notes]))
            if abs(notes[j][0] - tp) < 0.15: pitch = notes[j][2]
        if pitch is None: pitch = out[-1][2] if out else 64
        out.append((t, end, int(pitch), float(min(prom, 20) / 10 * 10 ** ((e[i] - loud) / 40)), int(sung)))
    return out


def in_key(pitches, weights=None):
    """The share of `pitches` in the best-fitting major scale (any of the 12; minor shares its relative major's notes)."""
    pc = np.array(pitches) % 12; w = np.ones(len(pc)) if weights is None else np.asarray(weights)
    major = np.array([0, 2, 4, 5, 7, 9, 11])
    best = max(range(12), key=lambda k: w[np.isin(pc, (major + k) % 12)].sum())
    return float(w[np.isin(pc, (major + best) % 12)].sum() / w.sum()), best


def rise(x):
    """How sharply the sound gets louder, per HOP frame, in standard deviations of its own (frame i at (i + 0.5) * HOP)."""
    e = np.sqrt(np.convolve(x.astype(np.float64) ** 2, np.ones(256) / 256, 'same'))[::HOP]
    r = np.maximum(0, np.diff(np.log(e + 1e-6))); r = np.convolve(r, np.ones(3) / 3, 'same')
    return (r - r.mean()) / (r.std() + 1e-9)


def heard(t, mix, voice, w=0.025):
    """Whether something clearly hits at `t` (s): the whole song (mix) or the voice alone jumps in loudness within
    25 ms. A syllable with neither is sung softly between the hits, and a tile there feels off the beat."""
    k = int(round(t * FPS - 0.5)); r = int(w * FPS)
    return mix[max(0, k - r):k + r + 1].max() >= 1.0 or voice[max(0, k - r):k + r + 1].max() >= 2.0
