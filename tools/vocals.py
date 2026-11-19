"""The sung syllables of a song, for KONO Beat's charts of its sung songs (tools/make_rhythm_charts.py).

1. The voice on its own: Demucs (htdemucs, two stems) separates it from the mix. This is an offline chart
   tool only, so torch and demucs are needed just here, and only when a sung song is charted:
     pip install torch torchaudio demucs
   The stem is cached (KONO_STEMS, default ~/.cache/kono-stems) so a rerun doesn't separate again.
2. Each syllable: a peak of the voice's loudness that stands clear of the dips around it (a syllable nucleus,
   so consonants, breaths and reverb tails don't count), starting at the steepest rise into it.
3. Each syllable's pitch: the sung note there (tools/melody.py on the voice stem), and how long it's held.
Gives (start, end, MIDI pitch, strength) like melody.notes_of, so chart_lead can chart them."""
import os, subprocess, sys, numpy as np
sys.path.insert(0, os.path.dirname(__file__))
import melody

SR, HOP = 22050, 64
FPS = SR / HOP


def stem(path, load):
    """The voice of the song at `path`, mono at SR (separated once, then cached)."""
    cache = os.environ.get('KONO_STEMS', os.path.expanduser('~/.cache/kono-stems'))
    name = os.path.splitext(os.path.basename(path))[0]
    out = os.path.join(cache, 'htdemucs', name, 'vocals.wav')
    if not os.path.exists(out):
        subprocess.run([sys.executable, '-m', 'demucs', '--two-stems=vocals', '-n', 'htdemucs', '-o', cache, path], check=True)
    return load(out)


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


def syllables(v):
    """(start, end, MIDI pitch, strength) for each sung syllable in the voice stem `v`. A syllable is a nucleus
    of the voice's loudness (see _nuclei) where it's really singing (within 25 dB of its loud parts); it starts
    at the steepest rise into it, lasts while the voice stays within 10 dB of its peak, and its pitch is the
    sung note there (melody.notes_of on the voice alone)."""
    e, times = _envelope(v)
    loud = np.percentile(e, 95)
    nuc = [(i, d, p) for i, d, p in _nuclei(e) if e[i] > loud - 25]
    notes = melody.notes_of(v)
    out = []
    for a, (i, dip, prom) in enumerate(nuc):
        rise = np.diff(e[dip:i + 1])
        k0 = dip + int(np.argmax(rise)) + 1 if len(rise) else i
        t = float(times[k0])
        nxt_dip = nuc[a + 1][1] if a + 1 < len(nuc) else len(e) - 1
        k = i
        while k < nxt_dip and e[k] > e[i] - 10: k += 1
        end = float(times[k])
        tp = float(times[i]); pitch = None
        for s0, e0, m0, _ in notes:
            if s0 - 0.03 <= tp < e0: pitch = m0; break
        if pitch is None and notes:
            j = int(np.argmin([abs(n0[0] - tp) for n0 in notes]))
            if abs(notes[j][0] - tp) < 0.15: pitch = notes[j][2]
        if pitch is None: pitch = out[-1][2] if out else 64
        out.append((t, end, int(pitch), float(min(prom, 20) / 10 * 10 ** ((e[i] - loud) / 40))))
    return out


def in_key(pitches, weights=None):
    """The share of `pitches` in the best-fitting major scale (any of the 12; minor shares its relative major's notes)."""
    pc = np.array(pitches) % 12; w = np.ones(len(pc)) if weights is None else np.asarray(weights)
    major = np.array([0, 2, 4, 5, 7, 9, 11])
    best = max(range(12), key=lambda k: w[np.isin(pc, (major + k) % 12)].sum())
    return float(w[np.isin(pc, (major + best) % 12)].sum() / w.sum()), best
