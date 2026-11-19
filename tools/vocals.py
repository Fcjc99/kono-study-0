"""The singing in a song, pulled out of the stereo mix for KONO Beat's sung charts (tools/make_rhythm_charts.py),
so their tiles land on the words. numpy only (no separation model).

How:
1. Centre: a song's voice sits in the middle of the stereo picture, the same in both speakers; most of the
   band (pads, guitars, reverb) is spread out. Each moment and pitch keeps only as much as the left and right
   channels agree there (in level and in phase).
2. Harmonic: drums are short and spread over every pitch; a sung note is a steady line at its own pitch. Each
   bin is kept by how much more it holds its level over a moment than it is shared across pitches (median
   filtering, after FitzGerald 2010), which takes the kick and snare out of the middle too.
3. The voice's range: below 140 Hz (the bass) and above 7 kHz (cymbals, breath) are dropped.
What comes back is a mono signal with mostly the voice in it, for tools/melody.py to follow."""
import subprocess
import numpy as np

SR, N, HOP = 22050, 2048, 512


def load_stereo(path):
    raw = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', path, '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout
    x = np.frombuffer(raw, dtype=np.float32).reshape(-1, 2)
    return x[:, 0].copy(), x[:, 1].copy()


def _stft(x):
    pad = np.pad(x, (N // 2, N // 2 + HOP))
    frames = np.lib.stride_tricks.sliding_window_view(pad, N)[::HOP] * np.hanning(N).astype(np.float32)
    return np.fft.rfft(frames, axis=1).astype(np.complex64)


def _istft(S, length):
    win = np.hanning(N).astype(np.float32)
    frames = np.fft.irfft(S, n=N, axis=1).astype(np.float32) * win
    out = np.zeros(len(frames) * HOP + N, np.float32); norm = np.zeros_like(out)
    for i, f in enumerate(frames):
        out[i * HOP:i * HOP + N] += f; norm[i * HOP:i * HOP + N] += win * win
    out = out / np.maximum(norm, 1e-3)
    return out[N // 2:N // 2 + length]


def _median(a, k, axis):
    """A running median of width k along one axis, in slices so it fits in memory."""
    pad = [(0, 0), (0, 0)]; pad[axis] = (k // 2, k // 2)
    p = np.pad(a, pad, mode='edge'); out = np.empty_like(a)
    if axis == 0:
        for c in range(0, a.shape[1], 64):
            out[:, c:c + 64] = np.median(np.lib.stride_tricks.sliding_window_view(p[:, c:c + 64], k, axis=0), axis=-1)
    else:
        for r in range(0, a.shape[0], 512):
            out[r:r + 512] = np.median(np.lib.stride_tricks.sliding_window_view(p[r:r + 512], k, axis=1), axis=-1)
    return out


def vocals_of(path):
    left, right = load_stereo(path)
    L, R = _stft(left), _stft(right)
    power = (np.abs(L) ** 2 + np.abs(R) ** 2) / 2 + 1e-12
    # 1 where both speakers carry the same thing in phase (the centre), towards 0 where they differ.
    centre = np.clip(np.real(L * np.conj(R)) / power, 0, 1) ** 3
    V = (L + R) / 2 * centre
    mag = np.abs(V).astype(np.float32)
    held = _median(mag, 17, axis=0)      # steady over ~0.4 s: a sung line
    spread = _median(mag, 17, axis=1)    # shared across ~180 Hz of pitches: a drum hit
    V = V * (held ** 2 / (held ** 2 + spread ** 2 + 1e-12))
    f = np.fft.rfftfreq(N, 1 / SR)
    V[:, (f < 140) | (f > 7000)] = 0
    return _istft(V, len(left))


def syllables_of(v):
    """Where the singer starts each syllable: sharp rises in the voice's own sound (300 Hz-4 kHz), each one
    clearly above what's around it (the last second or so), at least 0.09 s apart."""
    hop = 128
    frames = np.lib.stride_tricks.sliding_window_view(np.pad(v, N // 2), N)[::hop] * np.hanning(N).astype(np.float32)
    f = np.fft.rfftfreq(N, 1 / SR); band = (f >= 300) & (f <= 4000)
    mag = np.log1p(40 * np.abs(np.fft.rfft(frames, axis=1))[:, band])
    flux = np.r_[0, np.maximum(0, np.diff(mag, axis=0)).sum(axis=1)]
    level = np.convolve(flux, np.ones(9) / 9, 'same')
    w = int(SR / hop)  # about a second
    base = np.convolve(level, np.ones(w) / w, 'same')
    spread = np.sqrt(np.maximum(0, np.convolve(level ** 2, np.ones(w) / w, 'same') - base ** 2))
    t = np.arange(len(level)) * hop / SR
    floor = np.percentile(level, 60); out = []
    for i in range(2, len(level) - 2):
        if level[i] == level[i - 2:i + 3].max() and level[i] > base[i] + 1.0 * spread[i] and level[i] > floor:
            if not out or t[i] - out[-1] >= 0.09: out.append(t[i])
    return np.array(out)


def split_by_syllables(notes, onsets):
    """A held note the singer puts new words on (same pitch, new syllables) becomes one note per syllable, so
    every word gets its tile."""
    out = []
    for start, end, pitch, strength in notes:
        cuts = [s for s in onsets if start + 0.1 <= s <= end - 0.08]
        edges = [start] + cuts + [end]
        for a, b in zip(edges[:-1], edges[1:]):
            out.append((float(a), float(b), pitch, strength if a == start else strength * 0.8))
    return out
