from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np
import cv2

ROOT = Path(__file__).resolve().parents[1]
PHASES = ['morning', 'afternoon', 'evening', 'night']
BASE = ROOT / 'public/garden/islands/stage-0'
MAPS = ROOT / 'public/garden/islands/terrace-evolution'
LANTERNS = ROOT / 'public/garden/evolution/lanterns'
PHASE_SPRITES = LANTERNS / 'phases'
NATIVE = LANTERNS / 'native-patches'
QA = ROOT / 'docs/terrace-22.7.19-no-overlay'
QA.mkdir(parents=True, exist_ok=True)

WORLD_W, WORLD_H = 1448, 1086
WARP_X, WARP_Y = 900, 250
PATCH_BOX = (861, 301, 1350, 605)

# Exact fixture locations inherited from the approved registered terrace geometry.
# These are raster-edit coordinates, not runtime objects or overlays.
LIGHT_SPOTS = {
    0: [(138,113,8),(158,127,8),(186,137,8),(207,142,8),(232,138,8),(246,129,8)],
    1: [(130,114,8),(152,127,8),(178,139,8),(204,141,8),(229,137,8),(245,128,8),(291,157,7),(305,181,8)],
    2: [(124,113,8),(146,127,8),(172,138,8),(201,141,8),(226,137,8),(240,129,8),(287,155,8),(303,184,9)],
    3: [(137,73,8),(157,86,8),(184,98,8),(216,103,8),(240,100,8),(254,91,8),(280,156,9),(194,171,8)],
    4: [(129,77,8),(149,92,8),(178,105,8),(212,107,8),(239,103,8),(252,94,8),(282,163,9),(181,178,8)],
    5: [(121,76,8),(141,86,8),(159,96,8),(191,104,8),(216,104,8),(258,98,8),(213,70,9),(114,116,7),(57,193,10),(303,211,10),(181,170,8),(281,171,8)],
}

base = {phase: np.array(Image.open(BASE / f'stage0-{phase}.png').convert('RGB')) for phase in PHASES}
base_af = base['afternoon'].astype(np.float64)

# Build a phase transform from the Sanctuary's own registered phase maps.
# This is an OFFLINE bake. Runtime does not recolor/tint anything.
def fit_phase_matrix(phase: str) -> np.ndarray:
    if phase == 'afternoon':
        return np.array([[1.,0.,0.],[0.,1.,0.],[0.,0.,1.],[0.,0.,0.]])
    target = base[phase].astype(np.float64)
    x0, y0, x1, y1 = (820, 250, 1380, 650)
    X = base_af[y0:y1, x0:x1].reshape(-1, 3)
    Y = target[y0:y1, x0:x1].reshape(-1, 3)
    valid = (X.min(1) > 8) & (X.max(1) < 248) & (Y.min(1) > 5) & (Y.max(1) < 250)
    # Do not let sky/ocean dominate the terrace material transform.
    valid &= ~((X[:, 2] > X[:, 0] + 35) & (X[:, 2] > X[:, 1] + 15))
    A = np.c_[X[valid], np.ones(int(valid.sum()))]
    return np.linalg.lstsq(A, Y[valid], rcond=None)[0]

PHASE_MATRIX = {phase: fit_phase_matrix(phase) for phase in PHASES}


def practical_masks(stage: int) -> tuple[np.ndarray, np.ndarray]:
    core = np.zeros((WORLD_H, WORLD_W), np.uint8)
    halo = np.zeros_like(core)
    yy, xx = np.ogrid[:WORLD_H, :WORLD_W]
    for cx, cy, r in LIGHT_SPOTS[stage]:
        wx, wy = WARP_X + cx, WARP_Y + cy
        core[((xx-wx)**2 + (yy-wy)**2) <= max(3, r-3)**2] = 255
        halo[((xx-wx)**2 + (yy-wy)**2) <= r**2] = 255
    return core, halo


def suppress_practicals_rgba(arr: np.ndarray, core: np.ndarray, halo: np.ndarray) -> np.ndarray:
    out = arr.copy()
    rgb = out[:, :, :3]
    alpha = out[:, :, 3] if out.shape[2] == 4 else np.full(rgb.shape[:2], 255, np.uint8)
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV).astype(np.float32)
    H, S, V = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]
    warm = (H <= 42) | (H >= 170)
    lit_like = (V > 140) & (warm | (S < 140)) & (alpha > 0)
    halo_sel = (halo > 0) & lit_like
    core_sel = (core > 0) & (V > 132) & (warm | (S < 155)) & (alpha > 0)
    V[halo_sel] = np.minimum(V[halo_sel] * 0.90, 188)
    S[halo_sel] = np.minimum(255, S[halo_sel] * 1.01 + 1)
    V[core_sel] = np.minimum(V[core_sel] * 0.80, 168)
    S[core_sel] = np.minimum(255, S[core_sel] * 1.04 + 3)
    rgb2 = cv2.cvtColor(np.clip(hsv, 0, 255).astype(np.uint8), cv2.COLOR_HSV2RGB)
    selected = halo_sel | core_sel
    out[:, :, :3][selected] = rgb2[selected]
    return out


def warm_evening_practicals_rgba(arr: np.ndarray, core: np.ndarray, halo: np.ndarray) -> np.ndarray:
    out = arr.copy().astype(np.float32)
    alpha = arr[:, :, 3] if arr.shape[2] == 4 else np.full(arr.shape[:2], 255, np.uint8)
    active_halo = (halo > 0) & (alpha > 0)
    active_core = (core > 0) & (alpha > 0)
    target_halo = np.array([236, 151, 72], np.float32)
    target_core = np.array([255, 218, 132], np.float32)
    out[active_halo, :3] = out[active_halo, :3] * 0.92 + target_halo * 0.08
    out[active_core, :3] = out[active_core, :3] * 0.60 + target_core * 0.40
    return np.clip(out, 0, 255).astype(np.uint8)


def transform_afternoon_sprite(af_rgba: np.ndarray, phase: str) -> np.ndarray:
    out = af_rgba.copy()
    alpha = out[:, :, 3]
    mask = alpha > 0
    if phase != 'afternoon' and mask.any():
        rgb = out[:, :, :3].astype(np.float64)
        flat = np.c_[rgb[mask], np.ones(int(mask.sum()))]
        rgb[mask] = np.clip(flat @ PHASE_MATRIX[phase], 0, 255)
        out[:, :, :3] = rgb.astype(np.uint8)

    # Tiny chroma retention keeps the hand-painted terrace materials from looking gray,
    # while the Sanctuary-derived transform controls overall phase match.
    if phase in ('morning', 'evening', 'night') and mask.any():
        rgb = out[:, :, :3]
        hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV).astype(np.float32)
        sat_gain = {'morning': 1.05, 'evening': 1.06, 'night': 1.07}[phase]
        hsv[:, :, 1][mask] = np.clip(hsv[:, :, 1][mask] * sat_gain, 0, 255)
        out[:, :, :3] = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2RGB)
    return out


# Snapshot the approved clean afternoon transparent sprites before rewriting phase variants.
approved_af = {}
for stage in range(6):
    p = PHASE_SPRITES / 'afternoon' / f'terrace-stage-{stage}.png'
    approved_af[stage] = np.array(Image.open(p).convert('RGBA'))

# Build 24 standalone phase PNGs and 24 full-map runtime PNGs.
for stage in range(6):
    core, halo = practical_masks(stage)
    af_sprite = approved_af[stage]
    for phase in PHASES:
        # Stage 0 is already native in each base Sanctuary phase map. No duplicate sprite.
        if stage == 0:
            phase_sprite = np.zeros((WORLD_H, WORLD_W, 4), np.uint8)
        else:
            phase_sprite = transform_afternoon_sprite(af_sprite, phase)

        phase_dir = PHASE_SPRITES / phase
        phase_dir.mkdir(parents=True, exist_ok=True)
        Image.fromarray(phase_sprite, 'RGBA').save(phase_dir / f'terrace-stage-{stage}.png')

        # Start from the exact native phase map. This is the key no-patch rule:
        # surrounding grass/path/rock pixels are never replaced by an imported terrace crop.
        native = Image.fromarray(base[phase], 'RGB').convert('RGBA')
        if stage > 0:
            native = Image.alpha_composite(native, Image.fromarray(phase_sprite, 'RGBA'))
        full = np.array(native.convert('RGBA'))
        full_rgb = full[:, :, :3]

        out_dir = MAPS / phase
        out_dir.mkdir(parents=True, exist_ok=True)
        Image.fromarray(full_rgb, 'RGB').save(out_dir / f'stage-{stage}.png')

        x0, y0, x1, y1 = PATCH_BOX
        native_dir = NATIVE / phase
        native_dir.mkdir(parents=True, exist_ok=True)
        Image.fromarray(full_rgb[y0:y1, x0:x1], 'RGB').save(native_dir / f'stage-{stage}.png')

# QA: exact runtime full maps, Stage 5 in four phases.
full_sheet = Image.new('RGB', (724 * 2, 543 * 2), (16, 16, 16))
for i, phase in enumerate(PHASES):
    im = Image.open(MAPS / phase / 'stage-5.png').convert('RGB').resize((724, 543), Image.Resampling.LANCZOS)
    full_sheet.paste(im, ((i % 2) * 724, (i // 2) * 543))
full_sheet.save(QA / 'KONO-22.7.19-STAGE5-FOUR-PHASE-ACTUAL-RUNTIME.png')

# QA: terrace crop for all 24 states.
qa_box = (820, 250, 1380, 650)
cell_w, cell_h = 560, 400
sheet = Image.new('RGB', (cell_w * 6, cell_h * 4), (18, 18, 18))
for r, phase in enumerate(PHASES):
    for stage in range(6):
        im = Image.open(MAPS / phase / f'stage-{stage}.png').convert('RGB').crop(qa_box)
        sheet.paste(im, (stage * cell_w, r * cell_h))
sheet.save(QA / 'KONO-22.7.19-TERRACE-24-STATE-ACTUAL-RUNTIME.png')

# Machine-readable proof: outside each transparent terrace silhouette + tiny fixture masks,
# runtime pixels must be byte-identical to the corresponding native phase map.
report = []
for phase in PHASES:
    for stage in range(6):
        m = np.array(Image.open(MAPS / phase / f'stage-{stage}.png').convert('RGB'))
        b = base[phase]
        spr = np.array(Image.open(PHASE_SPRITES / phase / f'terrace-stage-{stage}.png').convert('RGBA'))
        core, halo = practical_masks(stage)
        allowed = (spr[:, :, 3] > 0)
        outside_changed = np.any(m != b, axis=2) & ~allowed
        report.append((phase, stage, int(outside_changed.sum())))

with open(QA / 'NO-PATCH-TERRAIN-AUDIT.txt', 'w', encoding='utf-8') as f:
    f.write('KONO 22.7.19 NO-PATCH / NO-OVERLAY TERRAIN AUDIT\n')
    f.write('Outside the transparent terrace silhouette, each runtime map must equal the native phase base exactly.\n\n')
    for phase, stage, count in report:
        f.write(f'{phase} stage {stage}: outside_changed_pixels={count}\n')

if any(count != 0 for _, _, count in report):
    raise SystemExit('Terrain audit failed: terrace changed pixels outside its clean silhouette.')

print('Build 22.7.19 terrace no-overlay/no-patch bake complete: 24 unique runtime PNGs; terrain audit PASS.')
