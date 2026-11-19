"""A sung song's lyrics lined up with its singing, for KONO Beat's karaoke line (tools/make_rhythm_charts.py).

The words come from tools/lyrics/<song>.txt (a sung line per line, sections in [ ]). They're lined up with the
voice on its own (tools/vocals.py separates it) by forced alignment: torchaudio's MMS_FA model (wav2vec2,
trained on speech in many languages) hears the letters, and the lyrics are fitted to it word by word, with a
wildcard between lines to soak up ad-libs and backing vocals nobody wrote down. Each word's start is then nudged
onto the sung syllable it falls on (vocals.syllables), within 80 ms.

Checked before it's kept, by things the fit didn't use:
- Repeats: a chorus sung twice is sung the same way, so each of its lines should be the same time apart from its
  repeat; the alignment places every line on its own, so a steady gap means it found them. (Beijing Delai's
  chorus lines both repeat 64.56 s later; Casa Fantasma's drop, seven lines, 92.84-92.90 s.)
- Onsets: word starts should land on sung syllable onsets (found separately) far more often than random times.
A song whose repeats line up keeps every line. A song with nothing to check them by (Peanut Butter Delai's
lyrics only cover its start) keeps its lines up to the first long jump (over 20 s with no words: past there the
aligner was only placing leftover words somewhere), and only if its words sit on onsets well above chance.

Needs torch + torchaudio (the model, ~1.2 GB, downloads once to the torch cache)."""
import re, subprocess, unicodedata, numpy as np


def read(path):
    """The lyric lines of a song's file: [(section, text)]."""
    out, section = [], ''
    for raw in open(path, encoding='utf-8'):
        line = raw.strip()
        if not line or line.startswith('#'): continue
        if line.startswith('['): section = line.strip('[]'); continue
        out.append((section, line))
    return out


def _letters(word):
    """A word as the model's letters: lower case, accents off, only a-z and '."""
    w = unicodedata.normalize('NFD', word.lower())
    return re.sub(r"[^a-z']", '', ''.join(c for c in w if unicodedata.category(c) != 'Mn'))


def words_of(text):
    """A line's words as shown (split on spaces), each with the letters it's aligned by ('' for a dash)."""
    return [(w, ' '.join(filter(None, (_letters(p) for p in re.split(r'[-—]+', w))))) for w in text.split()]


def force_align(path, lines):
    """Each lyric line's words, timed from the voice at `path`: {(line, word): (start s, end s, score)}."""
    import torch, torchaudio
    raw = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', path, '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], capture_output=True).stdout
    x = torch.from_numpy(np.frombuffer(raw, np.float32).copy())
    bundle = torchaudio.pipelines.MMS_FA
    model = bundle.get_model(with_star=True).eval(); tokenizer = bundle.get_tokenizer(); aligner = bundle.get_aligner()
    # The model hears 30 s at a time; windows overlap by 5 s and each keeps the middle of its overlap.
    sr, win, hop = 16000, 30.0, 25.0
    chunks, s = [], 0
    with torch.inference_mode():
        while s < len(x):
            seg = x[s:s + int(win * sr)]; e, _ = model(seg[None]); chunks.append((s / sr, e[0], e.shape[1] / (len(seg) / sr))); s += int(hop * sr)
    fps = chunks[0][2]; E = torch.zeros(int(len(x) / sr * fps) + 1, chunks[0][1].shape[1])
    for k, (t0, e, _) in enumerate(chunks):
        a = int(round(t0 * fps)); lo = 0 if k == 0 else int(round((win - hop) / 2 * fps))
        hi = min(e.shape[0], e.shape[0] if k == len(chunks) - 1 else int(round((hop + (win - hop) / 2) * fps)))
        n = min(hi, E.shape[0] - a); E[a + lo:a + n] = e[lo:n]
    E = torch.log_softmax(E, dim=-1)
    tokens, owner = ['*'], [None]
    for li, (_, text) in enumerate(lines):
        for wi, (_, letters) in enumerate(words_of(text)):
            for part in letters.split():
                tokens.append(part); owner.append((li, wi))
        tokens.append('*'); owner.append(None)
    spans = aligner(E, tokenizer(tokens))
    out = {}
    for sp, o in zip(spans, owner):
        if o is None: continue
        start, end, score = sp[0].start / fps, sp[-1].end / fps, float(np.mean([t.score for t in sp]))
        if o in out: start, end, score = out[o][0], end, (out[o][2] + score) / 2
        out[o] = (start, end, score)
    return out


def timed(lines, words, onsets):
    """The lines as the game shows them: [[start ms, end ms, text, [each word's start ms]]]. A word with no
    letters (a dash) starts with the one before it; each start moves onto a sung onset within 80 ms."""
    onsets = np.asarray(onsets); out = []
    for li, (_, text) in enumerate(lines):
        ws, starts, last = words_of(text), [], None
        for wi in range(len(ws)):
            t = words[(li, wi)][0] if (li, wi) in words else last
            if t is None: continue
            if len(onsets):
                k = int(np.argmin(abs(onsets - t)))
                if abs(onsets[k] - t) <= 0.08: t = float(onsets[k])
            starts.append(t); last = t
        if len(starts) != len(ws): continue
        end = max(words[(li, wi)][1] for wi in range(len(ws)) if (li, wi) in words)
        out.append([int(round(starts[0] * 1000)), int(round(max(end, starts[-1] + 0.2) * 1000)), text, [int(round(t * 1000)) for t in starts]])
    return out


def check(lines, lyr, onsets, seed=0):
    """How the timing holds up, from what the fit didn't use (see the module's notes): the repeats (every repeated
    line's gap to its repeat, and how many of them agree to within 0.25 s) and the onsets (the share of word starts
    on a sung onset, and of random times)."""
    by = {}
    for l in lyr:
        k = re.sub(r'\W+', ' ', l[2].lower()).strip()
        # A chant of one word ("DALE DALE DALE DALE") repeats all over a song, not as part of one section.
        if len(k.split()) >= 3 and len(set(k.split())) > 1: by.setdefault(k, []).append(l[0] / 1000)
    gaps = sorted(b - a for v in by.values() if len(v) > 1 for a, b in zip(v, v[1:]))
    # The largest set of gaps that agree to within 0.25 s: lines of one section, repeated, found the same distance
    # apart each time (gaps that don't join it are lines that also come back elsewhere).
    best = []
    for g in gaps:
        near = [x for x in gaps if abs(x - g) <= 0.25]
        if len(near) > len(best): best = near
    onsets = np.asarray(onsets); starts = np.array([t / 1000 for l in lyr for t in l[3]])
    on = lambda t: len(onsets) and np.min(abs(onsets - t)) <= 0.08
    rnd = np.random.default_rng(seed).uniform(starts.min(), starts.max(), 3000) if len(starts) else []
    return {'repeat_lines': len(best), 'repeat_gap': round(float(np.median(best)), 2) if best else None, 'repeat_gaps': [round(x, 2) for x in gaps],
            'on_onset': float(np.mean([on(t) for t in starts])) if len(starts) else 0, 'random_on_onset': float(np.mean([on(t) for t in rnd])) if len(rnd) else 0}


def keep(lyr, chk):
    """The lines to show: all of them when repeated lines are found the same distance apart (two or more) and the
    words sit on onsets well above chance; else (nothing to check by) the lines up to the
    first jump of over 20 s, if the words sit on onsets well above chance; else none."""
    if chk['repeat_lines'] >= 2 and chk['on_onset'] >= chk['random_on_onset'] + 0.1: return lyr
    if chk['on_onset'] < chk['random_on_onset'] + 0.1: return []
    for i in range(1, len(lyr)):
        if lyr[i][0] - lyr[i - 1][1] > 20000: return lyr[:i]
    return lyr
