from __future__ import annotations

from pathlib import Path
from typing import Iterable

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageEnhance

ROOT = Path(__file__).resolve().parents[1]
GARDEN = ROOT / 'public/garden'
ISLAND = GARDEN / 'islands/stage-0'
HOME = GARDEN / 'evolution/home'
HOME_FULL = HOME / 'full-silhouette'
HOME_DECOR = HOME / 'decor'
HOME_SOURCE = HOME / 'source'
LANTERNS = GARDEN / 'evolution/lanterns'
FISHING = GARDEN / 'evolution/bridge-fishing'
FISHING_SOURCE = FISHING / 'source'
PHASES = ('morning', 'afternoon', 'evening', 'night')


def fit_rgb_transform(src: np.ndarray, dst: np.ndarray, mask: np.ndarray) -> np.ndarray:
    yy, xx = np.where(mask)
    if len(xx) < 32:
        return np.array([[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0]], dtype=np.float32)
    if len(xx) > 40000:
        idx = np.linspace(0, len(xx) - 1, 40000).astype(int)
        yy, xx = yy[idx], xx[idx]
    X = np.concatenate([src[yy, xx, :3].astype(np.float32), np.ones((len(xx), 1), np.float32)], axis=1)
    Y = dst[yy, xx, :3].astype(np.float32)
    return np.linalg.lstsq(X, Y, rcond=None)[0].T


def apply_rgb_transform(image: np.ndarray, matrix: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    h, w = image.shape[:2]
    X = np.concatenate([image[:, :, :3].reshape(-1, 3).astype(np.float32), np.ones((h * w, 1), np.float32)], axis=1)
    rgb = np.clip(X @ matrix.T, 0, 255).astype(np.uint8).reshape(h, w, 3)
    out = np.zeros((h, w, 4), dtype=np.uint8)
    out[:, :, :3] = rgb
    out[:, :, 3] = alpha
    out[alpha == 0, :3] = 0
    return out


def repair_home_phase_geometry() -> None:
    """Afternoon is the visual/geometry master. Other phases become lighting grades only."""
    HOME_FULL.mkdir(parents=True, exist_ok=True)
    for stage in range(1, 6):
        master = np.array(Image.open(HOME / f'afternoon-stage-{stage}.png').convert('RGBA'))
        alpha = master[:, :, 3].copy()
        originals = {
            phase: np.array(Image.open(HOME / f'{phase}-stage-{stage}.png').convert('RGBA'))
            for phase in PHASES if phase != 'afternoon'
        }
        # Keep afternoon byte geometry as the master in both runtime and QA silhouette folders.
        Image.fromarray(master, 'RGBA').save(HOME / f'afternoon-stage-{stage}.png', optimize=True)
        Image.fromarray(master, 'RGBA').save(HOME_FULL / f'afternoon-stage-{stage}.png', optimize=True)
        for phase, target in originals.items():
            mask = (alpha > 0) & (target[:, :, 3] > 0)
            matrix = fit_rgb_transform(master, target, mask)
            repaired = apply_rgb_transform(master, matrix, alpha)
            # Preserve established warm practical/window pixels from the target grade where registered.
            lum = 0.2126 * master[:, :, 0] + 0.7152 * master[:, :, 1] + 0.0722 * master[:, :, 2]
            warm = (alpha > 0) & (master[:, :, 0] > master[:, :, 2] * 1.25) & (master[:, :, 1] > master[:, :, 2] * 1.05) & (lum > 135) & (target[:, :, 3] > 0)
            if phase in ('evening', 'night'):
                repaired[warm, :3] = np.clip(repaired[warm, :3] * 0.35 + target[warm, :3] * 0.65, 0, 255).astype(np.uint8)
            Image.fromarray(repaired, 'RGBA').save(HOME / f'{phase}-stage-{stage}.png', optimize=True)
            Image.fromarray(repaired, 'RGBA').save(HOME_FULL / f'{phase}-stage-{stage}.png', optimize=True)


def rebuild_option_b_garden() -> None:
    """Use the existing approved Option B art directly, only resizing/registering it."""
    approved = Image.open(HOME_SOURCE / 'approved-vegetable-garden-option-b.png').convert('RGBA')
    target_w = 112
    target_h = round(approved.height * target_w / approved.width)
    approved = approved.resize((target_w, target_h), Image.Resampling.NEAREST)
    master = Image.new('RGBA', (500, 450), (0, 0, 0, 0))
    # A little larger than 21.5 and tucked into the same house-facing lawn orientation.
    master.alpha_composite(approved, (64, 266))
    master.save(HOME_DECOR / 'vegetable-garden-stage5-afternoon.png', optimize=True)

    afternoon_home = np.array(Image.open(HOME / 'afternoon-stage-5.png').convert('RGBA'))
    master_arr = np.array(master)
    for phase in ('morning', 'evening', 'night'):
        target_home = np.array(Image.open(HOME / f'{phase}-stage-5.png').convert('RGBA'))
        mask = (afternoon_home[:, :, 3] > 0) & (target_home[:, :, 3] > 0)
        matrix = fit_rgb_transform(afternoon_home, target_home, mask)
        graded = apply_rgb_transform(master_arr, matrix, master_arr[:, :, 3])
        Image.fromarray(graded, 'RGBA').save(HOME_DECOR / f'vegetable-garden-stage5-{phase}.png', optimize=True)


def terrace_emissive(size: tuple[int, int], stage: int, strength: float) -> Image.Image:
    anchors = [
        (0.716, 0.360), (0.737, 0.363), (0.758, 0.366), (0.779, 0.369),
        (0.801, 0.372), (0.718, 0.475), (0.838, 0.470),
    ]
    active = [0, 0, 5, 5, 6, 7][stage]
    w, h = size
    out = np.zeros((h, w, 4), dtype=np.uint8)
    for nx, ny in anchors[:active]:
        x = int(round(nx * w)); y = int(round(ny * h))
        for dy, dx, a in ((0,0,230),(0,1,165),(0,-1,165),(1,0,165),(-1,0,165),(1,1,78),(1,-1,78),(-1,1,78),(-1,-1,78)):
            xx, yy = x + dx, y + dy
            if 0 <= xx < w and 0 <= yy < h:
                out[yy, xx, :3] = (255, 220, 132)
                out[yy, xx, 3] = max(out[yy, xx, 3], int(a * strength))
    return Image.fromarray(out, 'RGBA')


def rebuild_terrace_phases() -> None:
    phase_dir = LANTERNS / 'phases'
    emissive_dir = LANTERNS / 'emissive'
    for phase in PHASES:
        (phase_dir / phase).mkdir(parents=True, exist_ok=True)
    emissive_dir.mkdir(parents=True, exist_ok=True)

    base_maps = {phase: np.array(Image.open(ISLAND / f'stage0-{phase}.png').convert('RGB')).astype(np.float32) for phase in PHASES}
    afternoon_map = base_maps['afternoon']
    factors = {'morning': 0.80, 'afternoon': 0.0, 'evening': 0.88, 'night': 0.84}

    for stage in range(6):
        source_path = phase_dir / 'afternoon' / f'terrace-stage-{stage}.png'
        if not source_path.exists():
            source_path = LANTERNS / f'terrace-stage-{stage}.png'
        master = Image.open(source_path).convert('RGBA')
        arr = np.array(master).astype(np.float32)
        alpha = arr[:, :, 3].astype(np.uint8)
        if stage == 0:
            transparent = Image.new('RGBA', master.size, (0,0,0,0))
            for phase in PHASES:
                transparent.save(phase_dir / phase / f'terrace-stage-{stage}.png', optimize=True)
            transparent.save(emissive_dir / f'evening-stage-{stage}.png', optimize=True)
            transparent.save(emissive_dir / f'night-stage-{stage}.png', optimize=True)
            continue

        for phase in PHASES:
            rgb = arr[:, :, :3].copy()
            if phase != 'afternoon':
                delta = base_maps[phase] - afternoon_map
                rgb += delta * factors[phase]
            # Keep the cozy tea/lantern practicals readable through dusk and night.
            lum = 0.2126*arr[:, :, 0] + 0.7152*arr[:, :, 1] + 0.0722*arr[:, :, 2]
            warm = (alpha > 0) & (arr[:, :, 0] > arr[:, :, 2]*1.25) & (arr[:, :, 1] > arr[:, :, 2]*1.06) & (lum > 125)
            if phase == 'evening':
                rgb[warm, 0] += 11; rgb[warm, 1] += 7; rgb[warm, 2] += 2
            elif phase == 'night':
                rgb[warm, 0] += 23; rgb[warm, 1] += 16; rgb[warm, 2] += 5
            rgb = np.clip(rgb, 0, 255).astype(np.uint8)
            out = np.zeros_like(np.array(master))
            out[:, :, :3] = rgb
            out[:, :, 3] = alpha
            out[alpha == 0, :3] = 0
            Image.fromarray(out, 'RGBA').save(phase_dir / phase / f'terrace-stage-{stage}.png', optimize=True)

        terrace_emissive(master.size, stage, 0.86).save(emissive_dir / f'evening-stage-{stage}.png', optimize=True)
        terrace_emissive(master.size, stage, 1.0).save(emissive_dir / f'night-stage-{stage}.png', optimize=True)


def align_approved_bridge() -> tuple[np.ndarray, np.ndarray]:
    base = np.array(Image.open(FISHING_SOURCE / 'stage0-night-bridge-crop.png').convert('RGB'))
    approved = np.array(Image.open(FISHING_SOURCE / 'approved-bridge-fishing-reference.png').convert('RGB'))
    orb = cv2.ORB_create(nfeatures=3000)
    kp1, des1 = orb.detectAndCompute(cv2.cvtColor(approved, cv2.COLOR_RGB2GRAY), None)
    kp2, des2 = orb.detectAndCompute(cv2.cvtColor(base, cv2.COLOR_RGB2GRAY), None)
    matcher = cv2.BFMatcher(cv2.NORM_HAMMING)
    good = []
    for pair in matcher.knnMatch(des1, des2, k=2):
        if len(pair) != 2:
            continue
        m, n = pair
        if m.distance < 0.72 * n.distance:
            good.append(m)
    if len(good) < 5:
        raise RuntimeError('Could not register approved bridge fishing reference')
    src = np.float32([kp1[m.queryIdx].pt for m in good]).reshape(-1,1,2)
    dst = np.float32([kp2[m.trainIdx].pt for m in good]).reshape(-1,1,2)
    matrix, inliers = cv2.estimateAffinePartial2D(src, dst, method=cv2.RANSAC, ransacReprojThreshold=3)
    if matrix is None:
        raise RuntimeError('Bridge fishing affine registration failed')
    warped = cv2.warpAffine(approved, matrix, (base.shape[1], base.shape[0]), flags=cv2.INTER_NEAREST, borderMode=cv2.BORDER_CONSTANT, borderValue=(0,0,0))
    return base, warped


def bridge_prop_masks(base: np.ndarray, warped: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    diff = np.abs(warped.astype(np.int16) - base.astype(np.int16)).mean(axis=2)
    common = warped.sum(axis=2) > 0
    h, w = diff.shape
    manual = Image.new('L', (w, h), 0)
    d = ImageDraw.Draw(manual)
    # Approved reference objects only: two crates + bridge lantern, rod, reel, and bucket.
    d.polygon([(0,108),(31,100),(47,111),(47,145),(13,154),(0,145)], fill=255)
    d.polygon([(28,82),(68,73),(83,84),(81,110),(43,120),(28,107)], fill=255)
    d.polygon([(61,44),(96,43),(99,120),(78,126),(62,116)], fill=255)
    d.polygon([(214,122),(280,12),(287,13),(221,126)], fill=255)
    d.ellipse((207,112,228,132), fill=255)
    d.ellipse((282,126,333,169), fill=255)
    d.rectangle((292,145,323,175), fill=255)
    manual_mask = np.array(manual) > 0
    idle = manual_mask & (diff > 9) & common
    idle = cv2.morphologyEx(idle.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((2,2), np.uint8)).astype(bool) & manual_mask

    cast = idle.copy()
    cast_region = np.zeros_like(cast)
    cast_region[105:225, 205:230] = True
    cast |= cast_region & (diff > 5) & common
    return idle, cast


def rebuild_fishing_phases() -> None:
    phase_dir = FISHING / 'phases'
    for phase in PHASES:
        (phase_dir / phase).mkdir(parents=True, exist_ok=True)

    base_night, warped = align_approved_bridge()
    idle_mask, cast_mask = bridge_prop_masks(base_night, warped)
    source_maps = {phase: np.array(Image.open(ISLAND / f'stage0-{phase}.png').convert('RGB')) for phase in PHASES}
    x0, y0 = 500, 700
    h, w = base_night.shape[:2]
    factors = {'morning': 0.72, 'afternoon': 0.72, 'evening': 0.88, 'night': 1.0}

    for phase in PHASES:
        phase_crop = source_maps[phase][y0:y0+h, x0:x0+w].astype(np.int16)
        delta = phase_crop - base_night.astype(np.int16)
        graded = np.clip(warped.astype(np.int16) + delta * factors[phase], 0, 255).astype(np.uint8)
        for state, mask in (('idle', idle_mask), ('cast', cast_mask)):
            full = np.zeros((1086, 1448, 4), dtype=np.uint8)
            local = np.zeros((h, w, 4), dtype=np.uint8)
            local[:, :, :3] = graded
            local[:, :, 3] = mask.astype(np.uint8) * 255
            local[~mask, :3] = 0
            full[y0:y0+h, x0:x0+w] = local
            Image.fromarray(full, 'RGBA').save(phase_dir / phase / f'bridge-fishing-{state}.png', optimize=True)

    # Backwards-compatible generic assets now use the approved afternoon setup.
    for state in ('idle', 'cast'):
        src = phase_dir / 'afternoon' / f'bridge-fishing-{state}.png'
        Image.open(src).save(FISHING / f'bridge-fishing-{state}.png', optimize=True)


def main() -> None:
    repair_home_phase_geometry()
    rebuild_option_b_garden()
    rebuild_terrace_phases()
    rebuild_fishing_phases()
    print('Build 22.1 visual repair assets rebuilt from existing approved project art.')


if __name__ == '__main__':
    main()
