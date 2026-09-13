from __future__ import annotations

import math
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'public/garden/islands/terrace-evolution'
OUTPUT = ROOT / 'public/garden/production-water'
DEBUG = ROOT / 'docs/production-water-debug'
PHASES = ('morning', 'afternoon', 'evening', 'night')
OCEAN_BOX = (0, 420, 1448, 1086)
POND_BOX = (520, 525, 1035, 810)
WATERFALL_BOX = (480, 790, 625, 1005)
FOAM_BOX = (455, 915, 650, 1015)
FRAMES = 12


def water_mask(crop_bgr: np.ndarray) -> np.ndarray:
    """Return a conservative water-only mask.

    The prior mask accepted bright, low-saturation pixels near the shoreline. That
    occasionally included rock highlights. This version biases toward cool hues and
    only keeps bright pixels when they are spatially connected to obvious water.
    """
    hsv = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2HSV)
    h, s, v = cv2.split(hsv)
    obvious = ((h >= 80) & (h <= 124) & (s >= 24) & (v >= 45))
    soft = ((h >= 74) & (h <= 132) & (s >= 12) & (v >= 82))
    seed = obvious.astype(np.uint8) * 255
    seed = cv2.morphologyEx(seed, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8), iterations=2)
    grown = cv2.dilate(seed, np.ones((9, 9), np.uint8), iterations=2) > 0
    return ((obvious | (soft & grown)).astype(np.uint8) * 255)


def clean(mask: np.ndarray, close: tuple[int, int] = (7, 7), open_size: tuple[int, int] = (3, 3)) -> np.ndarray:
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones(close, np.uint8), iterations=2)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones(open_size, np.uint8), iterations=1)
    return mask


def fill_holes(mask: np.ndarray) -> np.ndarray:
    """Fill enclosed gaps inside the mask (e.g. lily pads/rocks the color heuristic
    excludes from "water"). Flood-filling the background from a corner and inverting
    leaves only regions unreachable from outside the mask — those are interior holes."""
    h, w = mask.shape
    flood = cv2.copyMakeBorder(mask, 1, 1, 1, 1, cv2.BORDER_CONSTANT, value=0)
    flood_fill_mask = np.zeros((h + 4, w + 4), np.uint8)
    cv2.floodFill(flood, flood_fill_mask, (0, 0), 255)
    flood = flood[1:-1, 1:-1]
    holes = cv2.bitwise_not(flood)
    return cv2.bitwise_or(mask, holes)


def largest_components(mask: np.ndarray, keep: int) -> np.ndarray:
    count, labels, stats, _ = cv2.connectedComponentsWithStats((mask > 0).astype(np.uint8), 8)
    if count <= 1:
        return mask
    order = sorted(range(1, count), key=lambda idx: int(stats[idx, cv2.CC_STAT_AREA]), reverse=True)[:keep]
    result = np.zeros_like(mask)
    for label in order:
        result[labels == label] = 255
    return result


def border_water_mask(crop_bgr: np.ndarray) -> np.ndarray:
    """Segment ocean connected to the crop borders for any painted phase.

    K-means is used only to identify broad painted-water color families. Components
    must touch an outer border, so island, cliffs, rocks, and the pond remain excluded.
    """
    h, w = crop_bgr.shape[:2]
    lab = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2LAB)
    pixels = lab.reshape(-1, 3).astype(np.float32)
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 24, 0.8)
    _, labels, _ = cv2.kmeans(pixels, 9, None, criteria, 3, cv2.KMEANS_PP_CENTERS)
    labels = labels.reshape(h, w)

    border = np.zeros((h, w), np.uint8)
    border[-24:, :] = 1
    border[:, :18] = 1
    border[:, -18:] = 1
    # Ignore the upper corners where sky can touch the crop border.
    border[:95, :] = 0
    border[:170, 120:w-120] = 0

    selected: list[int] = []
    for label in range(9):
        cluster = labels == label
        total = int(cluster.sum())
        touching = int((cluster & (border > 0)).sum())
        if total > 0 and touching / total > 0.055 and touching > 180:
            selected.append(label)

    mask = np.isin(labels, selected).astype(np.uint8) * 255
    mask = clean(mask, (9, 9), (3, 3))

    # Retain only components connected to the left, right, or bottom edge.
    count, components, stats, _ = cv2.connectedComponentsWithStats((mask > 0).astype(np.uint8), 8)
    result = np.zeros_like(mask)
    for idx in range(1, count):
        x, y, cw, ch, area = stats[idx]
        touches = x <= 3 or x + cw >= w - 3 or y + ch >= h - 3
        if touches and area > 450:
            result[components == idx] = 255
    return result


def build_masks(phase: str) -> dict[str, np.ndarray]:
    img = cv2.imread(str(SOURCE / phase / 'stage-0.png'))
    if img is None:
        raise FileNotFoundError(SOURCE / phase / 'stage-0.png')

    x0, y0, x1, y1 = OCEAN_BOX
    crop = img[y0:y1, x0:x1]
    ocean = border_water_mask(crop)
    px0, py0, px1, py1 = POND_BOX
    cv2.rectangle(ocean, (px0 - x0 - 10, py0 - y0 - 10), (px1 - x0 + 10, py1 - y0 + 10), 0, -1)
    wx0, wy0, wx1, wy1 = WATERFALL_BOX
    cv2.rectangle(ocean, (wx0 - x0 - 14, wy0 - y0 - 14), (wx1 - x0 + 14, wy1 - y0 + 14), 0, -1)
    ocean = clean(ocean, (9, 9), (3, 3))
    # Rocks poking out of the ocean are not "water" colored, so they leave enclosed
    # holes in an otherwise solid sea — fill those so the animated overlay doesn't
    # show flat un-animated patches around them.
    ocean = fill_holes(ocean)
    ocean = cv2.erode(ocean, np.ones((3, 3), np.uint8), iterations=1)

    x0, y0, x1, y1 = POND_BOX
    crop = img[y0:y1, x0:x1]
    pond = water_mask(crop)
    poly = np.zeros_like(pond)
    pts = np.array([[65, 70], [115, 45], [360, 48], [455, 85], [450, 190], [360, 230], [95, 225], [50, 165]], np.int32)
    cv2.fillPoly(poly, [pts], 255)
    pond = clean(cv2.bitwise_and(pond, poly), (7, 7), (3, 3))
    pond = largest_components(pond, 1)
    # Lily pads and rocks inside the pond are not "water" colored, so the heuristic
    # above bites deep notches out of the mask right where they sit. A much larger
    # close bridges those notches so the animated overlay covers the whole pond
    # basin instead of leaving jagged holes that reveal the flat map underneath.
    pond = cv2.morphologyEx(pond, cv2.MORPH_CLOSE, np.ones((33, 33), np.uint8), iterations=2)
    pond = fill_holes(pond)
    pond = cv2.erode(pond, np.ones((5, 5), np.uint8), iterations=1)

    x0, y0, x1, y1 = WATERFALL_BOX
    crop = img[y0:y1, x0:x1]
    waterfall = np.zeros(crop.shape[:2], np.uint8)
    pts = np.array([[48, 102], [87, 102], [87, 164], [81, 177], [50, 177], [45, 165]], np.int32)
    cv2.fillPoly(waterfall, [pts], 255)
    waterfall = clean(waterfall, (3, 3), (3, 3))

    x0, y0, x1, y1 = FOAM_BOX
    crop = img[y0:y1, x0:x1]
    hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
    h, sat, val = cv2.split(hsv)
    foam = (((val >= 135) & (sat <= 155)) | ((h >= 78) & (h <= 132) & (sat >= 14) & (val >= 78))).astype(np.uint8) * 255
    reg = np.zeros_like(foam)
    cv2.ellipse(reg, (90, 42), (64, 30), 0, 0, 360, 255, -1)
    foam = clean(cv2.bitwise_and(foam, reg), (5, 5), (3, 3))
    foam = largest_components(foam, 3)
    foam = fill_holes(foam)

    return {'ocean': ocean, 'pond': pond, 'waterfall': waterfall, 'foam': foam}

def feather(mask: np.ndarray, px: int = 5, max_alpha: int = 248) -> np.ndarray:
    dist = cv2.distanceTransform((mask > 0).astype(np.uint8), cv2.DIST_L2, 5)
    alpha = np.clip(dist / max(px, 1), 0, 1) * max_alpha
    return alpha.astype(np.uint8)


def water_filled_source(rgb: np.ndarray, mask: np.ndarray) -> np.ndarray:
    """Fill non-water pixels so remapping near an edge can never pull land inward."""
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    inverse = np.where(mask > 0, 0, 255).astype(np.uint8)
    filled = cv2.inpaint(bgr, inverse, 7, cv2.INPAINT_TELEA)
    return cv2.cvtColor(filled, cv2.COLOR_BGR2RGB)


def remap_surface(safe_rgb: np.ndarray, mask: np.ndarray, frame: int, pond: bool = False) -> tuple[np.ndarray, np.ndarray]:
    h, w = mask.shape
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    t = 2 * math.pi * frame / FRAMES
    dist = cv2.distanceTransform((mask > 0).astype(np.uint8), cv2.DIST_L2, 5)
    interior = np.clip(dist / (8.0 if pond else 13.0), 0, 1).astype(np.float32)

    if pond:
        cx, cy = w * 0.5, h * 0.52
        radius = np.sqrt(((xx - cx) / 1.5) ** 2 + ((yy - cy) / 1.0) ** 2)
        dx = (1.8 * np.sin(yy / 17 + t) + 0.75 * np.sin(radius / 13 - t * 0.9)) * interior
        dy = (0.95 * np.sin(xx / 21 - t * 0.75) + 0.45 * np.cos(radius / 17 + t)) * interior
        row = np.sin(radius / 8.8 - t * 1.15)
        dash = np.sin(xx / 22 + t * 0.3)
        spec = np.clip((row - 0.93) / 0.07, 0, 1) * np.clip((dash + 0.40) / 0.86, 0, 1)
        spec = cv2.GaussianBlur(spec.astype(np.float32), (0, 0), 0.48)
        amount = 8
        alpha = feather(mask, 6, 232)
    else:
        # Calm, mostly horizontal travel. Motion is strongest in open water and fades
        # to zero at shorelines, eliminating edge shimmer and rock displacement.
        dx = (3.6 * np.sin(yy / 33 + t) + 1.15 * np.sin(xx / 105 - t * 0.55)) * interior
        dy = (0.9 * np.sin(xx / 78 + t * 0.65) + 0.35 * np.cos(yy / 55 - t * 0.4)) * interior
        row = np.sin(yy / 11.2 - t * 1.05 + 0.08 * np.sin(xx / 61))
        dash = np.sin(xx / 27 + t * 0.38 + 0.12 * np.sin(yy / 39))
        spec = np.clip((row - 0.955) / 0.045, 0, 1) * np.clip((dash + 0.52) / 0.88, 0, 1)
        spec = cv2.GaussianBlur(spec.astype(np.float32), (0, 0), 0.40)
        amount = 9
        alpha = feather(mask, 8, 236)

    map_x = xx - dx
    map_y = yy - dy
    warped = cv2.remap(safe_rgb, map_x, map_y, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT_101)
    output = np.clip(warped.astype(np.float32) + spec[..., None] * amount * interior[..., None], 0, 255).astype(np.uint8)
    return output, alpha


def waterfall_palette(rgb: np.ndarray, mask: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Create a rock-free water source from the center of the painted stream."""
    # The sample remains inside water in every approved phase.
    sample = rgb[108:166, 51:83].copy()
    if sample.size == 0:
        sample = rgb.copy()
    sample = cv2.GaussianBlur(sample, (0, 0), 0.65)
    h, w = mask.shape
    tiled = cv2.resize(sample, (max(1, w), max(1, h)), interpolation=cv2.INTER_CUBIC)
    # Harmonize the synthetic body with the phase's actual central waterfall color.
    inner = rgb[112:164, 53:81]
    mean = inner.reshape(-1, 3).mean(axis=0) if inner.size else np.array([165, 215, 240])
    target = np.ones_like(tiled, dtype=np.float32) * mean.astype(np.float32)
    return tiled.astype(np.float32), target


def waterfall_frame(rgb: np.ndarray, mask: np.ndarray, frame: int) -> tuple[np.ndarray, np.ndarray]:
    h, w = mask.shape
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    coverage = mask.astype(np.float32) / 255.0
    offset = (frame / FRAMES) * 42.0
    body, phase_color = waterfall_palette(rgb, mask)

    # Vertical flow bands travel downward. No source coordinate ever reaches rock.
    body_wave = 0.5 + 0.5 * np.sin((yy + offset) / 9.6 + 0.18 * np.sin(xx / 8.5))
    fine = 0.5 + 0.5 * np.sin((yy + offset * 1.35) / 4.9 + xx / 12.5)
    body_scale = (0.91 + body_wave[..., None] * 0.09)
    body = body * body_scale
    body = body * 0.74 + phase_color * 0.26

    ribbon = np.zeros((h, w), np.float32)
    for center, width_value, phase_shift in ((54.0, 3.8, 0.0), (64.0, 3.1, 1.6), (75.0, 4.0, 3.0)):
        sway = 1.0 * np.sin((yy + offset) / 24.0 + phase_shift)
        column = np.exp(-((xx - (center + sway)) ** 2) / (2 * width_value ** 2))
        pulse = 0.38 + 0.62 * (0.5 + 0.5 * np.sin((yy + offset) / 7.1 + phase_shift))
        ribbon += column * pulse

    bright = np.clip(ribbon * 0.82 + fine * 0.18, 0, 1) * coverage
    bright = cv2.GaussianBlur(bright.astype(np.float32), (0, 0), 0.48)
    highlight = np.full_like(body, [218, 241, 255], dtype=np.float32)
    mix = np.clip(bright[..., None] * 0.46, 0, 0.46)
    output = np.clip(body * (1 - mix) + highlight * mix, 0, 255).astype(np.uint8)
    alpha = feather(mask, 4, 248)
    return output, alpha


def foam_frame(safe_rgb: np.ndarray, mask: np.ndarray, frame: int) -> tuple[np.ndarray, np.ndarray]:
    h, w = mask.shape
    t = 2 * math.pi * frame / FRAMES
    scale = 1.0 + 0.025 * np.sin(t)
    translate_x = 1.35 * np.sin(t)
    translate_y = 0.5 * np.cos(t)
    transform = cv2.getRotationMatrix2D((w / 2, h / 2), 0, scale)
    transform[0, 2] += translate_x
    transform[1, 2] += translate_y
    shifted_mask = cv2.warpAffine(mask, transform, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
    shifted_rgb = cv2.warpAffine(safe_rgb, transform, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT_101)
    output = np.clip(shifted_rgb.astype(np.float32) * 1.06 + 10, 0, 255).astype(np.uint8)
    alpha = np.clip(feather(shifted_mask, 4, 228).astype(np.float32) * (0.91 + 0.09 * np.sin(t) ** 2), 0, 255).astype(np.uint8)
    return output, alpha


def write(path: Path, rgb: np.ndarray, alpha: np.ndarray) -> None:
    bgra = np.dstack([rgb[:, :, 2], rgb[:, :, 1], rgb[:, :, 0], alpha])
    cv2.imwrite(str(path), bgra, [cv2.IMWRITE_PNG_COMPRESSION, 4])


def write_debug_masks(masks: dict[str, np.ndarray]) -> None:
    DEBUG.mkdir(parents=True, exist_ok=True)
    for key, mask in masks.items():
        cv2.imwrite(str(DEBUG / f'{key}-mask.png'), mask)


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for path in OUTPUT.glob('*.png'):
        path.unlink()
    for phase in PHASES:
        masks = build_masks(phase)
        DEBUG.mkdir(parents=True, exist_ok=True)
        for key, mask in masks.items():
            cv2.imwrite(str(DEBUG / f'{phase}-{key}-mask.png'), mask)
        bgr = cv2.imread(str(SOURCE / phase / 'stage-0.png'))
        if bgr is None:
            raise FileNotFoundError(SOURCE / phase / 'stage-0.png')
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)

        x0, y0, x1, y1 = OCEAN_BOX
        base = rgb[y0:y1, x0:x1]
        safe_base = water_filled_source(base, masks['ocean'])
        for frame in range(FRAMES):
            output, alpha = remap_surface(safe_base, masks['ocean'], frame, False)
            write(OUTPUT / f'{phase}-ocean-{frame}.png', output, alpha)

        x0, y0, x1, y1 = POND_BOX
        base = rgb[y0:y1, x0:x1]
        safe_base = water_filled_source(base, masks['pond'])
        for frame in range(FRAMES):
            output, alpha = remap_surface(safe_base, masks['pond'], frame, True)
            write(OUTPUT / f'{phase}-pond-{frame}.png', output, alpha)

        x0, y0, x1, y1 = WATERFALL_BOX
        base = rgb[y0:y1, x0:x1]
        for frame in range(FRAMES):
            output, alpha = waterfall_frame(base, masks['waterfall'], frame)
            write(OUTPUT / f'{phase}-waterfall-{frame}.png', output, alpha)

        x0, y0, x1, y1 = FOAM_BOX
        base = rgb[y0:y1, x0:x1]
        safe_base = water_filled_source(base, masks['foam'])
        for frame in range(FRAMES):
            output, alpha = foam_frame(safe_base, masks['foam'], frame)
            write(OUTPUT / f'{phase}-foam-{frame}.png', output, alpha)

        print('generated', phase)


if __name__ == '__main__':
    main()
