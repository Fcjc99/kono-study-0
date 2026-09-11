#!/usr/bin/env python3
"""Extract readable phase-matched cloud sprites and clean sky plates.

This is intentionally conservative: it removes only the large upper-sky clouds so
moving sprites never duplicate the most visible baked cloud forms. Lower horizon
clouds remain painted into the scene for depth and stability.
"""

from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'public' / 'garden' / 'islands' / 'stage-0'
OUTPUT = ROOT / 'public' / 'garden' / 'production-clouds'
PHASES = ('morning', 'afternoon', 'evening', 'night')
SKY_LIMIT = 430
TARGET_COUNT = 5


def sky_region(shape: tuple[int, int]) -> np.ndarray:
    height, width = shape
    region = np.zeros((height, width), np.uint8)
    region[:155, :] = 255
    region[:400, :430] = 255
    region[:400, 980:] = 255
    region[:205, 430:980] = 255
    return region


def cloud_mask(image_bgr: np.ndarray, phase: str) -> np.ndarray:
    sky = image_bgr[:SKY_LIMIT]
    hsv = cv2.cvtColor(sky, cv2.COLOR_BGR2HSV)
    h, s, v = cv2.split(hsv)
    if phase == 'night':
        mask = ((v >= 105) & (s <= 125))
    elif phase == 'evening':
        mask = ((v >= 155) & (s <= 150))
    else:
        mask = ((v >= 190) & (s <= 105)) | ((v >= 220) & (s <= 145))
    mask = mask.astype(np.uint8) * 255
    mask = cv2.bitwise_and(mask, sky_region(mask.shape))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8), iterations=2)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8), iterations=1)
    # Ignore tiny stars/sparkles and near-white sky edges.
    count, labels, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
    cleaned = np.zeros_like(mask)
    for idx in range(1, count):
        x, y, w, hgt, area = stats[idx]
        if area < 260 or w < 24 or hgt < 10:
            continue
        if y < 6 and hgt < 18:
            continue
        cleaned[labels == idx] = 255
    return cleaned


def feather(mask: np.ndarray, radius: float = 5.5) -> np.ndarray:
    return cv2.GaussianBlur(mask, (0, 0), radius)


def clean_sky(rgb: np.ndarray, mask: np.ndarray) -> np.ndarray:
    clean = rgb.copy().astype(np.float32)
    sky = clean[:SKY_LIMIT]
    sky_mask = mask > 0
    region = sky_region(mask.shape) > 0
    # Build a smooth row-wise sky color from non-cloud pixels.
    fill = np.zeros_like(sky)
    for y in range(SKY_LIMIT):
        valid = region[y] & ~sky_mask[y]
        if valid.sum() < 20:
            sample = np.median(sky[max(0, y - 3):min(SKY_LIMIT, y + 4)], axis=(0, 1))
        else:
            sample = np.median(sky[y, valid], axis=0)
        fill[y, :, :] = sample
    fill = cv2.GaussianBlur(fill, (0, 0), 16)
    soft = feather(mask).astype(np.float32) / 255.0
    sky[:] = sky * (1 - soft[..., None]) + fill * soft[..., None]
    clean[:SKY_LIMIT] = sky
    return np.clip(clean, 0, 255).astype(np.uint8)


def write_rgba(path: Path, rgb: np.ndarray, alpha: np.ndarray) -> None:
    bgra = np.dstack([rgb[:, :, 2], rgb[:, :, 1], rgb[:, :, 0], alpha])
    if not cv2.imwrite(str(path), bgra, [cv2.IMWRITE_PNG_COMPRESSION, 3]):
        raise RuntimeError(path)


def generate_phase(phase: str) -> None:
    source_path = SOURCE / f'stage0-{phase}.png'
    bgr = cv2.imread(str(source_path), cv2.IMREAD_COLOR)
    if bgr is None:
        raise FileNotFoundError(source_path)
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    mask = cloud_mask(bgr, phase)
    cleaned = clean_sky(rgb, mask)
    cv2.imwrite(str(SOURCE / f'stage0-{phase}-world.png'), cv2.cvtColor(cleaned, cv2.COLOR_RGB2BGR), [cv2.IMWRITE_PNG_COMPRESSION, 3])

    count, labels, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
    components: list[tuple[int, int, int, int, int]] = []
    for idx in range(1, count):
        x, y, w, h, area = stats[idx]
        if area >= 260:
            components.append((area, x, y, w, h))
    components.sort(reverse=True)
    components = components[:TARGET_COUNT]

    # Always produce a stable five-slot library so the engine can swap phase textures.
    while len(components) < TARGET_COUNT:
        components.append(components[len(components) % max(1, len(components))] if components else (1, 0, 0, 1, 1))

    for slot, (_, x, y, w, h) in enumerate(components, start=1):
        pad = 14
        x0, y0 = max(0, x - pad), max(0, y - pad)
        x1, y1 = min(rgb.shape[1], x + w + pad), min(SKY_LIMIT, y + h + pad)
        crop_rgb = rgb[y0:y1, x0:x1]
        crop_mask = mask[y0:y1, x0:x1]
        alpha = feather(crop_mask, 2.6)
        write_rgba(OUTPUT / f'{phase}-cloud-{slot}.png', crop_rgb, alpha)


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for old in OUTPUT.glob('*.png'):
        old.unlink()
    for phase in PHASES:
        generate_phase(phase)
        print(f'Generated {phase}')


if __name__ == '__main__':
    main()
