from pathlib import Path
from PIL import Image
import numpy as np
import cv2

ROOT = Path(__file__).resolve().parents[1]
PHASES = ['morning', 'afternoon', 'evening', 'night']
BASE = ROOT / 'public/garden/islands/stage-0'
MAPS = ROOT / 'public/garden/islands/terrace-evolution'
LANTERNS = ROOT / 'public/garden/evolution/lanterns'
PHASE_SPRITES = LANTERNS / 'phases'
SOURCE = LANTERNS / 'source/22.7.19-pre-vibrancy-phases'
REFS = LANTERNS / 'source/22.7.20-phase-references'
NATIVE = LANTERNS / 'native-patches'
QA = ROOT / 'docs/terrace-22.7.20-vibrancy-match'
QA.mkdir(parents=True, exist_ok=True)

WORLD_W, WORLD_H = 1448, 1086
PATCH_BOX = (861, 301, 1350, 605)
QA_BOX = (820, 250, 1380, 650)
WARP_X, WARP_Y = 900, 250

# Reference sheets supplied/approved by the user. Afternoon is intentionally
# preserved pixel-for-pixel; the other three phases are pulled partway toward
# the stronger saturation / tonal spread of the approved mockups.
REF_FILES = {
    'morning': REFS / 'morning-reference.png',
    'afternoon': REFS / 'afternoon-reference.png',
    'evening': REFS / 'evening-reference.png',
    'night': REFS / 'night-reference.png',
}

# Conservative blend into the approved reference distribution. These are
# OFFLINE authoring weights only; the runtime does not tint/recolor anything.
BLEND = {
    'morning': (0.52, 0.38),   # saturation, value
    'evening': (0.50, 0.52),
    'night': (0.58, 0.45),
}

# Existing registered fixture coordinates. We alter RGB only inside already
# opaque terrace pixels; alpha/silhouette is never expanded.
LIGHT_SPOTS = {
    0: [(138,113,8),(158,127,8),(186,137,8),(207,142,8),(232,138,8),(246,129,8)],
    1: [(130,114,8),(152,127,8),(178,139,8),(204,141,8),(229,137,8),(245,128,8),(291,157,7),(305,181,8)],
    2: [(124,113,8),(146,127,8),(172,138,8),(201,141,8),(226,137,8),(240,129,8),(287,155,8),(303,184,9)],
    3: [(137,73,8),(157,86,8),(184,98,8),(216,103,8),(240,100,8),(254,91,8),(280,156,9),(194,171,8)],
    4: [(129,77,8),(149,92,8),(178,105,8),(212,107,8),(239,103,8),(252,94,8),(282,163,9),(181,178,8)],
    5: [(121,76,8),(141,86,8),(159,96,8),(191,104,8),(216,104,8),(258,98,8),(213,70,9),(114,116,7),(57,193,10),(303,211,10),(181,170,8),(281,171,8)],
}


def reference_stage5_sv(phase: str) -> tuple[np.ndarray, np.ndarray]:
    """Extract Stage 5 target S/V from the right-most approved reference tile."""
    im = np.array(Image.open(REF_FILES[phase]).convert('RGB'))
    h, w = im.shape[:2]
    # Right-most sixth, with a little left margin so the whole Stage 5 tile is sampled.
    crop = im[int(h * 0.29):int(h * 0.71), int(w * 0.81):w]
    valid = crop.max(axis=2) > 20
    hsv = cv2.cvtColor(crop, cv2.COLOR_RGB2HSV)
    return hsv[:, :, 1][valid], hsv[:, :, 2][valid]


def histogram_lut(source_values: np.ndarray, target_values: np.ndarray) -> np.ndarray:
    src_hist = np.bincount(source_values.astype(np.uint8), minlength=256).astype(np.float64)
    dst_hist = np.bincount(target_values.astype(np.uint8), minlength=256).astype(np.float64)
    src_cdf = np.cumsum(src_hist)
    dst_cdf = np.cumsum(dst_hist)
    src_cdf /= src_cdf[-1]
    dst_cdf /= dst_cdf[-1]
    lut = np.interp(src_cdf, dst_cdf, np.arange(256, dtype=np.float64))
    return np.clip(np.rint(lut), 0, 255).astype(np.uint8)


def build_phase_luts() -> dict[str, tuple[np.ndarray, np.ndarray]]:
    luts: dict[str, tuple[np.ndarray, np.ndarray]] = {}
    for phase in ('morning', 'evening', 'night'):
        src = np.array(Image.open(SOURCE / phase / 'terrace-stage-5.png').convert('RGBA'))
        mask = src[:, :, 3] > 0
        hsv = cv2.cvtColor(src[:, :, :3], cv2.COLOR_RGB2HSV)
        target_s, target_v = reference_stage5_sv(phase)
        luts[phase] = (
            histogram_lut(hsv[:, :, 1][mask], target_s),
            histogram_lut(hsv[:, :, 2][mask], target_v),
        )
    return luts


def fixture_masks(stage: int) -> tuple[np.ndarray, np.ndarray]:
    core = np.zeros((WORLD_H, WORLD_W), np.uint8)
    halo = np.zeros_like(core)
    yy, xx = np.ogrid[:WORLD_H, :WORLD_W]
    for cx, cy, r in LIGHT_SPOTS[stage]:
        wx, wy = WARP_X + cx, WARP_Y + cy
        core[((xx - wx) ** 2 + (yy - wy) ** 2) <= max(3, r - 3) ** 2] = 255
        halo[((xx - wx) ** 2 + (yy - wy) ** 2) <= r ** 2] = 255
    return core, halo


def warm_evening_practicals(arr: np.ndarray, stage: int) -> np.ndarray:
    """Baked localized practical-light richness, never an added alpha/glow layer."""
    out = arr.copy().astype(np.float32)
    alpha = arr[:, :, 3]
    core, halo = fixture_masks(stage)
    halo_sel = (halo > 0) & (alpha > 0)
    core_sel = (core > 0) & (alpha > 0)
    warm_halo = np.array([238, 151, 62], np.float32)
    warm_core = np.array([255, 220, 120], np.float32)
    out[halo_sel, :3] = out[halo_sel, :3] * 0.90 + warm_halo * 0.10
    out[core_sel, :3] = out[core_sel, :3] * 0.68 + warm_core * 0.32
    return np.clip(out, 0, 255).astype(np.uint8)


def suppress_night_practicals(arr: np.ndarray, stage: int) -> np.ndarray:
    """Keep night fixtures visibly present but unlit, without deleting pixels."""
    out = arr.copy()
    alpha = out[:, :, 3]
    core, halo = fixture_masks(stage)
    halo_sel = (halo > 0) & (alpha > 0)
    core_sel = (core > 0) & (alpha > 0)
    hsv = cv2.cvtColor(out[:, :, :3], cv2.COLOR_RGB2HSV).astype(np.float32)
    # Night stays colorful but no warm practical hotspot is allowed to read as ON.
    hsv[:, :, 2][halo_sel] = np.minimum(hsv[:, :, 2][halo_sel], 94)
    hsv[:, :, 2][core_sel] = np.minimum(hsv[:, :, 2][core_sel], 78)
    out[:, :, :3] = cv2.cvtColor(np.clip(hsv, 0, 255).astype(np.uint8), cv2.COLOR_HSV2RGB)
    return out


def repaint_sprite(src: np.ndarray, phase: str, stage: int, luts: dict[str, tuple[np.ndarray, np.ndarray]]) -> np.ndarray:
    if phase == 'afternoon' or stage == 0:
        return src.copy()
    out = src.copy()
    mask = out[:, :, 3] > 0
    if not mask.any():
        return out
    hsv = cv2.cvtColor(out[:, :, :3], cv2.COLOR_RGB2HSV).astype(np.float32)
    sat_lut, val_lut = luts[phase]
    sat_weight, val_weight = BLEND[phase]
    S = hsv[:, :, 1]
    V = hsv[:, :, 2]
    src_s = S[mask].astype(np.uint8)
    src_v = V[mask].astype(np.uint8)
    S[mask] = (1.0 - sat_weight) * S[mask] + sat_weight * sat_lut[src_s]
    V[mask] = (1.0 - val_weight) * V[mask] + val_weight * val_lut[src_v]
    hsv[:, :, 1] = np.clip(S, 0, 255)
    hsv[:, :, 2] = np.clip(V, 0, 255)
    rgb = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2RGB)
    out[:, :, :3][mask] = rgb[mask]

    if phase == 'evening':
        out = warm_evening_practicals(out, stage)
    elif phase == 'night':
        out = suppress_night_practicals(out, stage)
    return out


luts = build_phase_luts()
base = {phase: np.array(Image.open(BASE / f'stage0-{phase}.png').convert('RGB')) for phase in PHASES}

# Repaint 24 phase/stage source PNGs and bake 24 full-map runtime PNGs.
for phase in PHASES:
    phase_dir = PHASE_SPRITES / phase
    phase_dir.mkdir(parents=True, exist_ok=True)
    out_map_dir = MAPS / phase
    out_map_dir.mkdir(parents=True, exist_ok=True)
    native_dir = NATIVE / phase
    native_dir.mkdir(parents=True, exist_ok=True)

    for stage in range(6):
        src = np.array(Image.open(SOURCE / phase / f'terrace-stage-{stage}.png').convert('RGBA'))
        out = repaint_sprite(src, phase, stage, luts)

        # Hard silhouette lock: only RGB may change; alpha must be byte-identical.
        if not np.array_equal(out[:, :, 3], src[:, :, 3]):
            raise RuntimeError(f'alpha/silhouette changed: {phase} stage {stage}')

        Image.fromarray(out, 'RGBA').save(phase_dir / f'terrace-stage-{stage}.png')

        native = Image.fromarray(base[phase], 'RGB').convert('RGBA')
        if stage > 0:
            native = Image.alpha_composite(native, Image.fromarray(out, 'RGBA'))
        full_rgb = np.array(native.convert('RGB'))
        Image.fromarray(full_rgb, 'RGB').save(out_map_dir / f'stage-{stage}.png')

        x0, y0, x1, y1 = PATCH_BOX
        Image.fromarray(full_rgb[y0:y1, x0:x1], 'RGB').save(native_dir / f'stage-{stage}.png')

# Actual-runtime QA: Stage 5, all four phases.
full_sheet = Image.new('RGB', (724 * 2, 543 * 2), (16, 16, 16))
for i, phase in enumerate(PHASES):
    im = Image.open(MAPS / phase / 'stage-5.png').convert('RGB').resize((724, 543), Image.Resampling.LANCZOS)
    full_sheet.paste(im, ((i % 2) * 724, (i // 2) * 543))
full_sheet.save(QA / 'KONO-22.7.20-STAGE5-FOUR-PHASE-ACTUAL-RUNTIME.png')

# 6 x 4 terrace crop QA from the exact runtime maps.
cell_w, cell_h = QA_BOX[2] - QA_BOX[0], QA_BOX[3] - QA_BOX[1]
sheet = Image.new('RGB', (cell_w * 6, cell_h * 4), (18, 18, 18))
for r, phase in enumerate(PHASES):
    for stage in range(6):
        im = Image.open(MAPS / phase / f'stage-{stage}.png').convert('RGB').crop(QA_BOX)
        sheet.paste(im, (stage * cell_w, r * cell_h))
sheet.save(QA / 'KONO-22.7.20-TERRACE-24-STATE-ACTUAL-RUNTIME.png')

# Before/after Stage 5 crop comparison for the three corrected phases.
comparison = Image.new('RGB', (cell_w * 2, cell_h * 3), (18, 18, 18))
for r, phase in enumerate(('morning', 'evening', 'night')):
    before_base = Image.open(BASE / f'stage0-{phase}.png').convert('RGBA')
    before_spr = Image.open(SOURCE / phase / 'terrace-stage-5.png').convert('RGBA')
    before = Image.alpha_composite(before_base, before_spr).convert('RGB').crop(QA_BOX)
    after = Image.open(MAPS / phase / 'stage-5.png').convert('RGB').crop(QA_BOX)
    comparison.paste(before, (0, r * cell_h))
    comparison.paste(after, (cell_w, r * cell_h))
comparison.save(QA / 'KONO-22.7.20-BEFORE-AFTER-VIBRANCY-QA.png')

# Numeric audit proving no terrain patch/overlay and quantifying the repaint.
lines = [
    'KONO 22.7.20 TERRACE VIBRANCY / NATIVE MATCH AUDIT',
    'Runtime lighting overlays remain disabled. Only terrace RGB pixels inside the pre-existing alpha silhouette are repainted offline.',
    '',
]
for phase in PHASES:
    for stage in range(6):
        b = base[phase]
        m = np.array(Image.open(MAPS / phase / f'stage-{stage}.png').convert('RGB'))
        spr = np.array(Image.open(PHASE_SPRITES / phase / f'terrace-stage-{stage}.png').convert('RGBA'))
        allowed = spr[:, :, 3] > 0
        changed = np.any(m != b, axis=2)
        leaked = int((changed & ~allowed).sum())
        lines.append(f'{phase} stage {stage}: outside_changed_pixels={leaked}')
        if leaked:
            raise RuntimeError(f'terrain leak: {phase} stage {stage}: {leaked}')

lines.append('')
for phase in ('morning', 'afternoon', 'evening', 'night'):
    before = np.array(Image.open(SOURCE / phase / 'terrace-stage-5.png').convert('RGBA'))
    after = np.array(Image.open(PHASE_SPRITES / phase / 'terrace-stage-5.png').convert('RGBA'))
    mask = before[:, :, 3] > 0
    def sv(arr):
        hsv = cv2.cvtColor(arr[:, :, :3], cv2.COLOR_RGB2HSV)
        return float(hsv[:, :, 1][mask].mean()), float(hsv[:, :, 2][mask].mean())
    bs, bv = sv(before)
    a_s, a_v = sv(after)
    lines.append(f'{phase} stage5: saturation {bs:.2f}->{a_s:.2f}; value {bv:.2f}->{a_v:.2f}; alpha_identical={np.array_equal(before[:,:,3], after[:,:,3])}')

(QA / 'VIBRANCY-NATIVE-MATCH-AUDIT.txt').write_text('\n'.join(lines) + '\n', encoding='utf-8')
print('Build 22.7.20 terrace vibrancy/native match bake complete.')
