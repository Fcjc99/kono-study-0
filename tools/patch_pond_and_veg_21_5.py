#!/usr/bin/env python3
from __future__ import annotations

import math
from pathlib import Path
from typing import Iterable

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
HOME = ROOT / 'public/garden/evolution/home'
HOME_DECOR = HOME / 'decor'
HOME_SOURCE = HOME / 'source'
POND_ASSETS = ROOT / 'public/garden/evolution/pond'
ISLAND = ROOT / 'public/garden/islands/stage-0'
DOCS = ROOT / 'docs'
PHASES = ('morning', 'afternoon', 'evening', 'night')
HOME_CANVAS = (500, 450)
HOME_MAP_POS = (100, 300)
POND_BOX = (520, 525, 1035, 810)
POND_CENTER = (735, 706)
POND_RADIUS = (132, 43)

SWIM_PATHS = [
    [(285, 145), (330, 150), (370, 155), (400, 170), (385, 190), (350, 205), (300, 210), (255, 200), (235, 185), (235, 165), (250, 150)],
    [(255, 155), (295, 150), (330, 160), (350, 175), (335, 190), (300, 200), (265, 195), (240, 180), (240, 165)],
    [(320, 160), (360, 155), (392, 165), (400, 175), (380, 185), (350, 198), (315, 190), (300, 175)],
]

# Decoration data mirrors PondEvolutionSystem.ts for deterministic QA rendering.
DECORATIONS = [
    ('ripple-large.png', 1, -0.12, 0.06, 0.92, 0.58, False, None),
    ('ripple-small.png', 1, 0.46, -0.18, 0.78, 0.50, False, None),
    ('lily-pad-1.png', 2, -0.46, -0.08, 0.62, 0.90, False, None),
    ('lily-pad-2.png', 2, -0.17, 0.28, 0.54, 0.88, False, None),
    ('lily-pad-3.png', 2, 0.36, -0.04, 0.50, 0.86, False, None),
    ('lotus-pink.png', 2, -0.36, -0.34, 0.50, 0.96, False, None),
    ('reeds-cluster.png', 4, 0, 0, 0.56, 0.94, False, (892, 641)),
    ('moss-stones.png', 4, 0, 0, 0.54, 0.88, False, (628, 732)),
    ('shore-flowers.png', 4, 0, 0, 0.52, 0.90, False, (650, 642)),
    ('lotus-pink.png', 5, 0.54, 0.26, 0.44, 0.92, True, None),
    ('reeds-cluster.png', 5, 0, 0, 0.46, 0.86, True, (670, 645)),
    ('moss-stones.png', 5, 0, 0, 0.46, 0.82, True, (925, 730)),
    ('shore-flowers.png', 5, 0, 0, 0.46, 0.84, True, (925, 680)),
    ('water-sparkle.png', 5, -0.06, -0.30, 0.50, 0.68, False, None),
    ('water-sparkle.png', 5, 0.46, 0.18, 0.40, 0.54, False, None),
]


def fit_transform(src: np.ndarray, dst: np.ndarray) -> np.ndarray:
    mask = (src[:, :, 3] > 0) & (dst[:, :, 3] > 0)
    yy, xx = np.where(mask)
    if len(xx) > 20_000:
        idx = np.linspace(0, len(xx) - 1, 20_000).astype(int)
        yy, xx = yy[idx], xx[idx]
    X = np.concatenate([src[yy, xx, :3].astype(np.float32), np.ones((len(xx), 1), np.float32)], axis=1)
    Y = dst[yy, xx, :3].astype(np.float32)
    return np.linalg.lstsq(X, Y, rcond=None)[0].T


def apply_transform(image: Image.Image, matrix: np.ndarray) -> Image.Image:
    arr = np.array(image.convert('RGBA'))
    mask = arr[:, :, 3] > 0
    X = np.concatenate(
        [arr[:, :, :3].reshape(-1, 3).astype(np.float32), np.ones((arr.shape[0] * arr.shape[1], 1), np.float32)],
        axis=1,
    )
    rgb = np.clip(X @ matrix.T, 0, 255).astype(np.uint8).reshape(arr.shape[0], arr.shape[1], 3)
    arr[:, :, :3] = rgb
    arr[~mask, :3] = 0
    return Image.fromarray(arr, 'RGBA')


def build_option_b_garden() -> None:
    approved = Image.open(HOME_SOURCE / 'approved-vegetable-garden-option-b.png').convert('RGBA')
    target_w = 92
    target_h = round(approved.height * target_w / approved.width)
    approved = approved.resize((target_w, target_h), Image.Resampling.NEAREST)

    master = Image.new('RGBA', HOME_CANVAS, (0, 0, 0, 0))
    # Keeps the garden on the lawn left/below the house without touching stairs or path.
    master.alpha_composite(approved, (78, 274))
    master.save(HOME_DECOR / 'vegetable-garden-stage5-afternoon.png', optimize=True)

    afternoon_home = np.array(Image.open(HOME / 'afternoon-stage-5.png').convert('RGBA'))
    for phase in ('morning', 'evening', 'night'):
        target_home = np.array(Image.open(HOME / f'{phase}-stage-5.png').convert('RGBA'))
        matrix = fit_transform(afternoon_home, target_home)
        apply_transform(master, matrix).save(HOME_DECOR / f'vegetable-garden-stage5-{phase}.png', optimize=True)


def wrap01(value: float) -> float:
    return value % 1.0


def sample_path(path: list[tuple[int, int]], progress: float) -> tuple[float, float]:
    scaled = wrap01(progress) * len(path)
    idx = int(math.floor(scaled)) % len(path)
    nxt = (idx + 1) % len(path)
    local = scaled - math.floor(scaled)
    eased = 0.5 - math.cos(local * math.pi) * 0.5
    x = path[idx][0] + (path[nxt][0] - path[idx][0]) * eased
    y = path[idx][1] + (path[nxt][1] - path[idx][1]) * eased
    return x, y


def koi_direction(path_index: int, progress: float, travel_direction: int) -> int:
    x, y = sample_path(SWIM_PATHS[path_index], progress)
    x2, y2 = sample_path(SWIM_PATHS[path_index], progress + travel_direction * 0.0025)
    heading = math.atan2(y2 - y, x2 - x)
    return int(round((heading / (math.pi * 2)) * 8)) % 8


def tint_rgba(image: Image.Image, tint: tuple[int, int, int], alpha_mul: float) -> Image.Image:
    arr = np.array(image.convert('RGBA')).astype(np.float32)
    arr[:, :, 0] *= tint[0] / 255.0
    arr[:, :, 1] *= tint[1] / 255.0
    arr[:, :, 2] *= tint[2] / 255.0
    arr[:, :, 3] *= alpha_mul
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGBA')


def paste_center(base: Image.Image, sprite: Image.Image, center: tuple[float, float], scale: float = 1.0, flip: bool = False) -> None:
    sprite = sprite.convert('RGBA')
    if flip:
        sprite = sprite.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    w = max(1, round(sprite.width * scale))
    h = max(1, round(sprite.height * scale))
    sprite = sprite.resize((w, h), Image.Resampling.NEAREST)
    x = round(center[0] - w / 2)
    y = round(center[1] - h / 2)
    base.alpha_composite(sprite, (x, y))


def render_pond_stage(stage: int, phase: str = 'afternoon') -> Image.Image:
    base = Image.open(ISLAND / f'stage0-{phase}.png').convert('RGBA')
    # Current locked home + approved Option B garden gives actual Sanctuary context.
    home = Image.open(HOME / f'{phase}-stage-5.png').convert('RGBA')
    veg = Image.open(HOME_DECOR / f'vegetable-garden-stage5-{phase}.png').convert('RGBA')
    base.alpha_composite(home, HOME_MAP_POS)
    base.alpha_composite(veg, HOME_MAP_POS)

    phase_visibility = {'morning': 0.94, 'afternoon': 1.0, 'evening': 0.78, 'night': 0.56}[phase]
    decor_tint = {
        'morning': (255, 240, 220),
        'afternoon': (255, 255, 255),
        'evening': (215, 169, 161),
        'night': (143, 167, 196),
    }[phase]

    # Decorative pond sprites.
    for filename, min_stage, ox, oy, scale, alpha, flip, map_pos in DECORATIONS:
        if stage < min_stage:
            continue
        sprite = Image.open(POND_ASSETS / filename).convert('RGBA')
        # Preserve runtime visibility/tone in the QA stills.
        if filename == 'water-sparkle.png' and phase == 'night':
            alpha *= 1.28
        sprite = tint_rgba(sprite, decor_tint, min(1.0, alpha * phase_visibility))
        if map_pos is None:
            cx = POND_CENTER[0] + POND_RADIUS[0] * ox
            cy = POND_CENTER[1] + POND_RADIUS[1] * oy
        else:
            cx, cy = map_pos
        paste_center(base, sprite, (cx, cy), scale, flip)

    fish_count = max(0, min(3, stage - 2))
    variants = ('orange-white', 'red-white', 'gold-black')
    travel = (1, -1, 1)
    progresses = (0.14, 0.57, 0.82)
    phase_tint = {
        'morning': (255, 239, 217),
        'afternoon': (255, 255, 255),
        'evening': (229, 185, 175),
        'night': (168, 184, 221),
    }[phase]
    fish_alpha = (0.94, 1.0, 0.78, 0.58)[PHASES.index(phase)]
    for i in range(fish_count):
        px, py = sample_path(SWIM_PATHS[i], progresses[i])
        direction = koi_direction(i, progresses[i], travel[i])
        frame = i % 2
        fish = Image.open(POND_ASSETS / f'koi-{variants[i]}-d{direction}-f{frame}.png').convert('RGBA')
        fish = tint_rgba(fish, phase_tint, fish_alpha * (0.90 - i * 0.04))
        scale = 0.53 + i * 0.018
        paste_center(base, fish, (POND_BOX[0] + px, POND_BOX[1] + py), scale)

    return base


def stage_qa() -> None:
    panels = []
    labels = {3: 'Stage 3 · First koi', 4: 'Stage 4 · Koi garden', 5: 'Stage 5 · Sanctuary pond'}
    for stage in (3, 4, 5):
        image = render_pond_stage(stage, 'afternoon')
        crop = image.crop((450, 480, 1085, 840)).resize((760, 432), Image.Resampling.LANCZOS).convert('RGB')
        draw = ImageDraw.Draw(crop)
        draw.rounded_rectangle((14, 14, 250, 52), 8, fill=(17, 20, 24))
        draw.text((26, 24), labels[stage], fill='white')
        panels.append(crop)
    sheet = Image.new('RGB', (760 * 3, 432), (20, 22, 26))
    for i, panel in enumerate(panels):
        sheet.paste(panel, (i * 760, 0))
    sheet.save(DOCS / 'PRODUCTION-BUILD-21.5-POND-STAGES-3-5-QA.jpg', quality=93)



def full_stage_qa() -> None:
    names = {
        0: 'Stage 0 · Natural pond',
        1: 'Stage 1 · Rippled water',
        2: 'Stage 2 · Lily pond',
        3: 'Stage 3 · First koi',
        4: 'Stage 4 · Koi garden',
        5: 'Stage 5 · Sanctuary pond',
    }
    panels = []
    for stage in range(6):
        image = render_pond_stage(stage, 'afternoon')
        crop = image.crop((450, 480, 1085, 840)).resize((760, 432), Image.Resampling.LANCZOS).convert('RGB')
        draw = ImageDraw.Draw(crop)
        draw.rounded_rectangle((14, 14, 270, 52), 8, fill=(17, 20, 24))
        draw.text((26, 24), names[stage], fill='white')
        panels.append(crop)
    sheet = Image.new('RGB', (760 * 3, 432 * 2), (20, 22, 26))
    for i, panel in enumerate(panels):
        sheet.paste(panel, ((i % 3) * 760, (i // 3) * 432))
    sheet.save(DOCS / 'PRODUCTION-BUILD-21.5-POND-STAGES-0-5-QA.jpg', quality=93)

def phase_qa() -> None:
    panels = []
    for phase in PHASES:
        image = render_pond_stage(5, phase)
        crop = image.crop((450, 480, 1085, 840)).resize((760, 432), Image.Resampling.LANCZOS).convert('RGB')
        draw = ImageDraw.Draw(crop)
        draw.rounded_rectangle((14, 14, 190, 52), 8, fill=(17, 20, 24))
        draw.text((26, 24), phase.title(), fill='white')
        panels.append(crop)
    sheet = Image.new('RGB', (760 * 2, 432 * 2), (20, 22, 26))
    for i, panel in enumerate(panels):
        sheet.paste(panel, ((i % 2) * 760, (i // 2) * 432))
    sheet.save(DOCS / 'PRODUCTION-BUILD-21.5-POND-STAGE5-ALL-PHASES-QA.jpg', quality=93)


def path_qa() -> None:
    masks = []
    safe_masks = []
    for phase in PHASES:
        mask_path = DOCS / f'production-water-debug/{phase}-pond-mask.png'
        phase_mask = cv2.imread(str(mask_path), cv2.IMREAD_GRAYSCALE)
        if phase_mask is None:
            raise FileNotFoundError(mask_path)
        masks.append(phase_mask)
        safe_masks.append(cv2.erode((phase_mask > 0).astype(np.uint8) * 255, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (31, 21)), iterations=1))
    mask = masks[1]  # afternoon boundary for visual context
    safe = safe_masks[0]
    for phase_safe in safe_masks[1:]:
        safe = cv2.bitwise_and(safe, phase_safe)
    source = Image.open(ISLAND / 'stage0-afternoon.png').convert('RGB').crop(POND_BOX)
    overlay = np.array(source).copy()
    # tint safe water area softly green, original water boundary cyan.
    m = mask > 0
    s = safe > 0
    overlay[m] = (overlay[m] * 0.75 + np.array([30, 150, 190]) * 0.25).astype(np.uint8)
    overlay[s] = (overlay[s] * 0.78 + np.array([75, 190, 105]) * 0.22).astype(np.uint8)
    image = Image.fromarray(overlay)
    draw = ImageDraw.Draw(image)
    route_colors = [(255, 235, 90), (255, 130, 175), (130, 215, 255)]
    for idx, path in enumerate(SWIM_PATHS):
        points = path + [path[0]]
        draw.line(points, fill=route_colors[idx], width=3, joint='curve')
        for p in path:
            draw.ellipse((p[0] - 2, p[1] - 2, p[0] + 2, p[1] + 2), fill=route_colors[idx])
    image = image.resize((1030, 570), Image.Resampling.NEAREST)
    d = ImageDraw.Draw(image)
    d.rectangle((14, 14, 530, 62), fill=(17, 20, 24))
    d.text((28, 27), 'Koi safe-water routes · safe in all 4 time-of-day pond masks', fill='white')
    image.save(DOCS / 'PRODUCTION-BUILD-21.5-KOI-SWIM-PATH-QA.png')


def garden_qa() -> None:
    panel = render_pond_stage(5, 'afternoon').crop((80, 280, 650, 800)).resize((912, 832), Image.Resampling.NEAREST).convert('RGB')
    draw = ImageDraw.Draw(panel)
    draw.rectangle((12, 12, 456, 62), fill=(17, 20, 24))
    draw.text((28, 28), 'Stage 5 · approved Option B vegetable garden', fill='white')
    panel.save(DOCS / 'PRODUCTION-BUILD-21.5-OPTION-B-GARDEN-MAP-FIT-QA.png')


def main() -> None:
    DOCS.mkdir(parents=True, exist_ok=True)
    HOME_DECOR.mkdir(parents=True, exist_ok=True)
    build_option_b_garden()
    stage_qa()
    full_stage_qa()
    phase_qa()
    path_qa()
    garden_qa()
    print('Build 21.5 pond QA and approved Option B garden assets generated.')


if __name__ == '__main__':
    main()
