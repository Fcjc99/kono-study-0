#!/usr/bin/env python3
"""Measures a song's tempo, first beat and key, for KONO Flow's FLOW_GRID (src/arcadeAudio.ts), so its
notes can play on the song's beat. Needs ffmpeg and numpy.  python3 tools/measure_beat.py public/audio/games/flow-*.mp3
'steady' near 0.2 or more means a clear beat; under about 0.05 the song has little beat to lock to (the notes
then keep the tempo but may sit a little off it). Check the result by ear."""
import subprocess, sys, numpy as np
SR = 22050
def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32)
def onsets(x, n=1024, hop=64):
    frames = np.lib.stride_tricks.sliding_window_view(x, n)[::hop] * np.hanning(n)
    spec = np.log1p(10 * np.abs(np.fft.rfft(frames, axis=1)))
    flux = np.maximum(0, np.diff(spec, axis=0)).sum(axis=1)
    flux -= np.convolve(flux, np.ones(32) / 32, 'same')
    return np.maximum(flux, 0), SR / hop, spec
for path in sys.argv[1:]:
    x = load(path); flux, fps, spec = onsets(x); t = np.arange(len(flux)) / fps
    best = max((abs(np.sum(flux * np.exp(2j * np.pi * t * b / 60))), b) for b in np.arange(70, 170, 0.02))
    bpm = best[1]; z = np.sum(flux * np.exp(2j * np.pi * t * bpm / 60))
    first = ((-np.angle(z)) / (2 * np.pi) * 60 / bpm) % (60 / bpm)
    chroma = np.zeros(12); f = np.fft.rfftfreq(1024, 1 / SR); ok = (f > 65) & (f < 2000)
    pcs = (np.round(12 * np.log2(f[ok] / 440)) + 69) % 12; mag = np.exp(spec[:, ok]) - 1
    for k in range(12): chroma[k] = mag[:, pcs == k].sum()
    major = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]); minor = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
    names = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
    key = max((np.corrcoef(chroma, np.roll(p, k))[0, 1], names[k] + ' ' + m) for k in range(12) for p, m in ((major, 'major'), (minor, 'minor')))
    print(f"{path}: {len(x)/SR:.0f}s  bpm={bpm:.2f}  first_beat={first:.3f}s  steady={best[0]/flux.sum():.2f}  key={key[1]}")
