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
A song whose repeats line up keeps every line. A song with nothing to check them by (Peanut Butter Delai: its
chorus repeats are too fast to transcribe, so they have no words) keeps only the lines the fit is sure of (a line
it merely placed somewhere scores near 0), and only if its words sit on onsets well above chance.

Needs torch + torchaudio (the model, ~1.2 GB, downloads once to the torch cache)."""
import re, subprocess, unicodedata, numpy as np

# How far a word start moves onto the sung syllable it falls on (the syllable is where it lands, as heard).
SNAP = 0.12


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
    try:
        bundle = torchaudio.pipelines.MMS_FA
        model = bundle.get_model(with_star=True).eval(); tokenizer = bundle.get_tokenizer(); aligner = bundle.get_aligner(); english = False
    except Exception:
        # MMS_FA's weights can't always be fetched: torchaudio's English wav2vec2 (LibriSpeech, letters) hears the
        # same letters. It has no wildcard token, so one is added: on each frame, as likely as the likeliest letter
        # (less a margin), so it soaks up unwritten words without beating a letter that's really sung.
        bundle = torchaudio.pipelines.WAV2VEC2_ASR_LARGE_LV60K_960H
        model = bundle.get_model().eval(); labels = bundle.get_labels(); english = True
        index = {c: i for i, c in enumerate(labels)}
        tokenizer = lambda toks: [[len(labels)] if t == '*' else [index[c] for c in t.upper() if c in index] for t in toks]
        def aligner(E, ids):
            flat, owner = [], []
            for k, part in enumerate(ids):
                for i in part: flat.append(i); owner.append(k)
            path, scores = torchaudio.functional.forced_align(E[None], torch.tensor([flat], dtype=torch.int32), blank=0)
            spans = torchaudio.functional.merge_tokens(path[0], scores[0].exp())
            out = [[] for _ in ids]
            for sp, k in zip(spans, owner): out[k].append(sp)
            return out
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
    if english: E = torch.cat([E, (E[:, 1:].max(dim=-1).values - 1.0)[:, None]], dim=-1)
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


def unstrand(starts, ends, gap=2.0):
    """A line is sung in one go, so a gap of over `gap` s between two of its words means the fit stranded some of
    them on another part of the song (Casa Fantasma's "Mate in the" in the DALE chant 8 s before "cup, fire in my
    chest"). The smaller side is packed back against the larger at the line's own pace (its median word step, kept
    to 0.15-0.4 s); a tie keeps the later side, as a line's end is what the fit finds last."""
    if len(starts) < 2: return starts, ends
    d = [b - a for a, b in zip(starts, starts[1:])]
    k = int(np.argmax(d))
    if d[k] <= gap: return starts, ends
    rest = [x for i, x in enumerate(d) if i != k]
    step = float(np.clip(np.median(rest) if rest else 0.25, 0.15, 0.4))
    s, e = list(starts), list(ends)
    if k + 1 <= len(s) - (k + 1):  # the words before the gap are the fewer: they move up to just before the rest
        for i in range(k, -1, -1): s[i] = s[i + 1] - step; e[i] = s[i] + step
    else:  # the words after it are fewer: they follow on from the rest
        for i in range(k + 1, len(s)): s[i] = s[i - 1] + step; e[i] = s[i] + step
    return s, e


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
                # (not onto one the word before already took, or the two would light up as one)
                if abs(onsets[k] - t) <= SNAP and (last is None or onsets[k] > last + 0.03): t = float(onsets[k])
            if last is not None: t = max(t, last)
            starts.append(t); last = t
        if len(starts) != len(ws): continue
        ends = [words[(li, wi)][1] if (li, wi) in words else starts[wi] + 0.2 for wi in range(len(ws))]
        starts, ends = unstrand(starts, ends)
        end = max(ends)
        score = float(np.mean([words[(li, wi)][2] for wi in range(len(ws)) if (li, wi) in words]))
        # The fifth item, how sure the fit is of the line, is for keep() and is dropped before the game sees it.
        out.append([int(round(starts[0] * 1000)), int(round(max(end, starts[-1] + 0.2) * 1000)), text, [int(round(t * 1000)) for t in starts], score])
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


def keep(lyr, chk, sure=0.1):
    """The lines to show, as the game takes them (start, end, text, word starts). All of them when repeated lines are
    found the same distance apart (two or more) and the words sit on onsets well above chance. Else (nothing to
    check by) only the lines the fit is sure of (a line it only placed somewhere scores near 0: "Uh-oh" stretched
    over 3.6 s scored 0.01, a line really sung 0.15-0.5), plus an unsure line squeezed between two sure ones, if the
    words sit on onsets well above chance; else none."""
    plain = lambda ls: [l[:4] for l in ls]
    if chk['on_onset'] < chk['random_on_onset'] + 0.1: return []
    if chk['repeat_lines'] >= 2: return plain(lyr)
    ok = [len(l) < 5 or l[4] >= sure for l in lyr]
    # A line the fit is unsure of still shows when the lines either side of it are sure and leave it no more than
    # 2.5 s: it can only be sung there ("Da truth don't hide," between two sure lines 2.1 s apart). One that could
    # be anywhere in a long gap (an intro line in 13 s of mostly music) stays out.
    pinned = [ok[i] or (0 < i < len(lyr) - 1 and ok[i - 1] and ok[i + 1] and lyr[i + 1][0] - lyr[i - 1][1] <= 2500) for i in range(len(lyr))]
    return plain([l for l, k in zip(lyr, pinned) if k])
