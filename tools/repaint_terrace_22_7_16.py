from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np
import cv2

ROOT = Path(__file__).resolve().parents[1]
PHASES = ['morning', 'afternoon', 'evening', 'night']
BASE = ROOT / 'public/garden/islands/stage-0'
MAPS = ROOT / 'public/garden/islands/terrace-evolution'
LANTERNS = ROOT / 'public/garden/evolution/lanterns'
SOURCE = LANTERNS / 'source'
NATIVE = LANTERNS / 'native-patches'
LOCKED = SOURCE / '22.7.15-clean-afternoon-maps'
QA = ROOT / 'docs/terrace-22.7.16-qa'
LOCKED.mkdir(parents=True, exist_ok=True)
QA.mkdir(parents=True, exist_ok=True)

WORLD_W, WORLD_H = 1448, 1086
WARP_X, WARP_Y = 900, 250
PATCH_BOX = (861, 301, 1350, 605)

# Preserve the exact 22.7.15 clean-reference integration as the geometry source.
for stage in range(6):
    src = MAPS / 'afternoon' / f'stage-{stage}.png'
    dst = LOCKED / f'stage-{stage}.png'
    if not dst.exists():
        Image.open(src).convert('RGB').save(dst)

base = {phase: np.array(Image.open(BASE / f'stage0-{phase}.png').convert('RGB')) for phase in PHASES}
base_af = base['afternoon'].astype(np.float64)

# Learn the Sanctuary's actual painted phase shifts from unchanged terrain around the terrace.
# This is an offline bake step only. The runtime never tints/recolors the terrace.
def fit_phase_matrix(phase: str) -> np.ndarray:
    if phase == 'afternoon':
        return np.array([[1.,0.,0.],[0.,1.,0.],[0.,0.,1.],[0.,0.,0.]])
    target = base[phase].astype(np.float64)
    x0, y0, x1, y1 = (760, 210, 1360, 650)
    X = base_af[y0:y1, x0:x1].reshape(-1, 3)
    Y = target[y0:y1, x0:x1].reshape(-1, 3)
    valid = (X.min(1) > 15) & (X.max(1) < 245) & (Y.min(1) > 8) & (Y.max(1) < 248)
    # Exclude open sky/ocean so the fit is driven by land, wood, grass, stone and path pixels.
    valid &= ~((X[:, 2] > X[:, 0] + 25) & (X[:, 2] > X[:, 1] + 8))
    valid &= (X.max(1) - X.min(1) > 8)
    A = np.c_[X[valid], np.ones(int(valid.sum()))]
    return np.linalg.lstsq(A, Y[valid], rcond=None)[0]

PHASE_MATRIX = {phase: fit_phase_matrix(phase) for phase in PHASES}

# Exact practical-light centers in the registered 430x360 clean terrace sprites.
# These are intentionally tiny and stage-specific: only bulbs / flames / lantern windows are
# repainted. We never inpaint or erase furniture, roof vines, flowers, cushions, rope or wood.
# (cx, cy, radius) in the clean-warped sprite coordinate system.
LIGHT_SPOTS = {
    0: [
        (138,113,8),(158,127,8),(186,137,8),(207,142,8),(232,138,8),(246,129,8),
    ],
    1: [
        (130,114,8),(152,127,8),(178,139,8),(204,141,8),(229,137,8),(245,128,8),
        (291,157,7),(305,181,8),
    ],
    2: [
        (124,113,8),(146,127,8),(172,138,8),(201,141,8),(226,137,8),(240,129,8),
        (287,155,8),(303,184,9),
    ],
    3: [
        (137,73,8),(157,86,8),(184,98,8),(216,103,8),(240,100,8),(254,91,8),
        (280,156,9),(194,171,8),
    ],
    4: [
        (129,77,8),(149,92,8),(178,105,8),(212,107,8),(239,103,8),(252,94,8),
        (282,163,9),(181,178,8),
    ],
    5: [
        (121,76,8),(141,86,8),(159,96,8),(191,104,8),(216,104,8),(258,98,8),
        (213,70,9),               # central hanging lantern
        (114,116,7),              # left-side candle/lamp
        (57,193,10),(303,211,10), # floor lanterns
        (181,170,8),(281,171,8),  # table / side candle flames
    ],
}


def practical_masks(stage: int) -> tuple[np.ndarray, np.ndarray]:
    """Return tiny baked practical core/halo masks; geometry remains untouched."""
    core = np.zeros((360, 430), np.uint8)
    halo = np.zeros_like(core)
    yy, xx = np.ogrid[:360, :430]
    for cx, cy, r in LIGHT_SPOTS[stage]:
        # Core is the actual bright emitter. Halo is deliberately only ~2 px wider.
        core[((xx-cx)**2 + (yy-cy)**2) <= max(3, r-3)**2] = 255
        halo[((xx-cx)**2 + (yy-cy)**2) <= r**2] = 255
    world_core = np.zeros((WORLD_H, WORLD_W), np.uint8)
    world_halo = np.zeros((WORLD_H, WORLD_W), np.uint8)
    h, w = core.shape
    world_core[WARP_Y:WARP_Y+h, WARP_X:WARP_X+w] = core
    world_halo[WARP_Y:WARP_Y+h, WARP_X:WARP_X+w] = halo
    return world_core, world_halo


def suppress_practicals(src: np.ndarray, core: np.ndarray, halo: np.ndarray) -> np.ndarray:
    """Paint practicals OFF without deleting/smearing a single silhouette pixel.

    The source terrace has baked light bulbs. For off phases we reduce only the luminance of
    the tiny registered emitters and their immediate warm halo. RGB structure is retained, so
    rope, lantern frames, furniture edges and the Stage-5 canopy stay pixel-clean.
    """
    out = src.copy()
    hsv = cv2.cvtColor(src, cv2.COLOR_RGB2HSV).astype(np.float32)
    H, S, V = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]
    warm = (H <= 42) | (H >= 170)
    # White bulbs can be low saturation; warm lantern/candle pixels are usually saturated.
    lit_like = (V > 145) & (warm | (S < 135))

    halo_sel = (halo > 0) & lit_like
    core_sel = (core > 0) & (V > 135) & (warm | (S < 150))

    # Immediate halo: remove the luminous pop but retain local material texture.
    V[halo_sel] = np.minimum(V[halo_sel] * 0.72, 172)
    S[halo_sel] = np.minimum(255, S[halo_sel] * 1.04 + 3)
    # Emitter core: unlit amber/wood/glass instead of white/yellow emission.
    V[core_sel] = np.minimum(V[core_sel] * 0.54, 128)
    S[core_sel] = np.minimum(255, S[core_sel] * 1.12 + 8)

    off = cv2.cvtColor(np.clip(hsv,0,255).astype(np.uint8), cv2.COLOR_HSV2RGB)
    out[halo_sel | core_sel] = off[halo_sel | core_sel]
    return out


def restore_evening_practicals(painted: np.ndarray, original_af: np.ndarray, core: np.ndarray, halo: np.ndarray) -> np.ndarray:
    """Keep the approved terrace practicals clearly ON in the sunset repaint.

    This edits the final raster directly; it is not a runtime glow layer. The warm lift is
    confined to the exact fixture masks above so Stage 4/5 never acquire sticker halos.
    """
    out = painted.copy()
    src_hsv = cv2.cvtColor(original_af, cv2.COLOR_RGB2HSV)
    active = (halo > 0) & (src_hsv[:, :, 2] > 145)
    if not active.any():
        return out
    warm = out.astype(np.float32)
    target = np.empty_like(warm)
    target[:, :, 0] = 255
    target[:, :, 1] = 190
    target[:, :, 2] = 105
    # Small warm fixture-area lift, preserving all original detail/edges.
    mix_halo = active & (core == 0)
    if mix_halo.any():
        warm[mix_halo] = warm[mix_halo] * 0.88 + target[mix_halo] * 0.12
    core_active = (core > 0) & (src_hsv[:, :, 2] > 150)
    if core_active.any():
        warm[core_active] = warm[core_active] * 0.50 + np.array([255,214,132],np.float32) * 0.50
    return np.clip(warm,0,255).astype(np.uint8)

def phase_paint_pixels(src: np.ndarray, phase: str, mask: np.ndarray) -> np.ndarray:
    vals = src[mask].astype(np.uint8)
    if phase != 'afternoon':
        flat = np.c_[vals.astype(np.float64), np.ones(len(vals))]
        vals = np.clip(flat @ PHASE_MATRIX[phase], 0, 255).astype(np.uint8)
    hsv = cv2.cvtColor(vals.reshape(-1, 1, 3), cv2.COLOR_RGB2HSV).reshape(-1, 3).astype(np.float32)
    if phase == 'morning':
        hsv[:, 1] *= 0.90
        hsv[:, 2] *= 1.045
    elif phase == 'afternoon':
        hsv[:, 1] *= 0.90
        hsv[:, 2] *= 1.055
    elif phase == 'evening':
        hsv[:, 1] *= 0.90
        hsv[:, 2] *= 1.045
    else:
        hsv[:, 1] *= 0.72
        hsv[:, 2] *= 0.94
    hsv = np.clip(hsv, 0, 255).astype(np.uint8)
    return cv2.cvtColor(hsv.reshape(-1, 1, 3), cv2.COLOR_HSV2RGB).reshape(-1, 3)


# Build all 24 runtime maps.
for stage in range(6):
    src_af = np.array(Image.open(LOCKED / f'stage-{stage}.png').convert('RGB'))
    core, halo = practical_masks(stage)
    src_off = suppress_practicals(src_af, core, halo)
    # Geometry mask is locked to the clean 22.7.15 integration and never scaled/re-anchored.
    diff = np.max(np.abs(src_af.astype(np.int16) - base['afternoon'].astype(np.int16)), axis=2)
    modified = cv2.morphologyEx((diff > 3).astype(np.uint8), cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8), iterations=1) > 0

    for phase in PHASES:
        source = src_af if phase == 'evening' else src_off
        result = base[phase].copy()
        result[modified] = phase_paint_pixels(source, phase, modified)
        if phase == 'evening':
            result = restore_evening_practicals(result, src_af, core, halo)
        out_path = MAPS / phase / f'stage-{stage}.png'
        Image.fromarray(result, 'RGB').save(out_path)

        # Native opaque map crop used for QA/reference. Runtime still uses only the full map above.
        x0, y0, x1, y1 = PATCH_BOX
        patch = result[y0:y1, x0:x1]
        native_dir = NATIVE / phase
        native_dir.mkdir(parents=True, exist_ok=True)
        Image.fromarray(patch, 'RGB').save(native_dir / f'stage-{stage}.png')

# QA sheet: exact runtime textures cropped around the terrace, 6 stages x 4 phases.
qa_box = (850, 220, 1340, 610)
cell_w, cell_h = qa_box[2]-qa_box[0], qa_box[3]-qa_box[1]
label_h = 24
sheet = Image.new('RGB', (cell_w*6, (cell_h+label_h)*4), (20,20,20))
draw = ImageDraw.Draw(sheet)
for r, phase in enumerate(PHASES):
    y = r*(cell_h+label_h)
    draw.text((8, y+5), phase.upper(), fill='white')
    for stage in range(6):
        im = Image.open(MAPS / phase / f'stage-{stage}.png').convert('RGB').crop(qa_box)
        sheet.paste(im, (stage*cell_w, y+label_h))
        draw.text((stage*cell_w+cell_w-58, y+5), f'S{stage}', fill='white')
sheet.save(QA / 'KONO-22.7.16-TERRACE-24-STATE-RUNTIME-QA.jpg', quality=94)

# Stage 5 full-map four-phase runtime QA.
full = Image.new('RGB', (724*2, 543*2), (15,15,15))
for i, phase in enumerate(PHASES):
    im = Image.open(MAPS / phase / 'stage-5.png').convert('RGB').resize((724,543), Image.Resampling.LANCZOS)
    full.paste(im, ((i%2)*724, (i//2)*543))
full.save(QA / 'KONO-22.7.16-STAGE5-FOUR-PHASE-RUNTIME-QA.jpg', quality=95)

print('Build 22.7.16 terrace repaint complete: 24 baked full-map textures + QA sheets')
