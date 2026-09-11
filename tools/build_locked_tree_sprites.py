from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageEnhance

ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT / 'public/garden/evolution/cherry-tree/source'
OUTPUT_ROOT = ROOT / 'public/garden/evolution/cherry-tree'
SCENE_ROOT = ROOT / 'public/garden/islands/stage-0'
DOCS_ROOT = ROOT / 'docs'

CANVAS_SIZE = (620, 650)
TREE_ANCHOR_X = 648
TREE_GROUND_Y = 523
CONTENT_BOTTOM_Y = 624
SOURCE_ROOT_X = 768
ALPHA_CROP_THRESHOLD = 16
PHASES = ('morning', 'afternoon', 'evening', 'night')

# Authored physical growth curve. Later stages become a genuine map centerpiece.
STAGE_CONTENT_SCALES = (0.30, 0.28, 0.33, 0.42, 0.46, 0.50)
PHASE_BLEND_STRENGTH = {
    'morning': 0.84,
    'afternoon': 1.00,
    'evening': 0.93,
    'night': 0.96,
}


def significant_bounds(image: Image.Image) -> tuple[int, int, int, int]:
    rgba = np.asarray(image.convert('RGBA'))
    alpha = rgba[:, :, 3]
    ys, xs = np.where(alpha > ALPHA_CROP_THRESHOLD)
    if len(xs) == 0:
        raise ValueError('source image has no visible content')
    return int(xs.min()), int(ys.min()), int(xs.max() + 1), int(ys.max() + 1)


def normalize_stage(source: Image.Image, stage: int) -> Image.Image:
    source = source.convert('RGBA')
    x0, y0, x1, y1 = significant_bounds(source)
    crop = source.crop((x0, y0, x1, y1))
    scale = STAGE_CONTENT_SCALES[stage]
    width = max(1, round(crop.width * scale))
    height = max(1, round(crop.height * scale))
    crop = crop.resize((width, height), Image.Resampling.LANCZOS)

    canvas = Image.new('RGBA', CANVAS_SIZE, (0, 0, 0, 0))
    root_offset_x = round((SOURCE_ROOT_X - x0) * scale)
    paste_x = CANVAS_SIZE[0] // 2 - root_offset_x
    paste_y = CONTENT_BOTTOM_Y - height
    canvas.alpha_composite(crop, (paste_x, paste_y))
    return soften_ground_edge(canvas)


def soften_ground_edge(image: Image.Image) -> Image.Image:
    """Feather only the lower mound rim so it merges into the painted island.

    The authored canopy and trunk remain crisp. The lower twelve-ish pixels of the
    outer grass ring fade naturally instead of reading as a pasted oval sticker.
    """
    rgba = np.asarray(image.convert('RGBA')).astype(np.float32)
    alpha = rgba[:, :, 3] / 255.0
    mask = (alpha > 0.025).astype(np.uint8)
    distance = cv2.distanceTransform(mask, cv2.DIST_L2, 5)
    edge_softness = np.clip(distance / 10.0, 0.0, 1.0)
    rows = np.arange(alpha.shape[0], dtype=np.float32)[:, None]
    lower_blend = np.clip((rows - 455.0) / 85.0, 0.0, 1.0)
    alpha *= (1.0 - lower_blend) + lower_blend * edge_softness
    rgba[:, :, 3] = np.clip(alpha * 255.0, 0, 255)
    return Image.fromarray(rgba.astype(np.uint8), 'RGBA')


def scene_pixels(phase: str) -> np.ndarray:
    return np.asarray(Image.open(SCENE_ROOT / f'stage0-{phase}.png').convert('RGB'), dtype=np.float32) / 255.0


def phase_transform() -> dict[str, np.ndarray]:
    """Learn the island's actual time-of-day paint transform.

    The four maps share geometry, so an affine color transform learned from the
    painted land itself is more faithful than hand-picked tint values. This makes
    the tree inherit the same morning warmth, sunset compression, and moonlight
    as the house, paths, cliffs, and vegetation.
    """
    scenes = {phase: scene_pixels(phase) for phase in PHASES}
    reference = scenes['afternoon']
    height, width, _ = reference.shape
    yy, xx = np.ogrid[:height, :width]

    # Island-biased sample: exclude most sky/ocean and strongly blue water pixels.
    mask = (((xx - 724) / 660) ** 2 + ((yy - 580) / 480) ** 2 < 1.0) & (yy > 120) & (yy < 980)
    hsv = cv2.cvtColor((reference * 255).astype(np.uint8), cv2.COLOR_RGB2HSV)
    blue = (hsv[:, :, 0] > 85) & (hsv[:, :, 0] < 130) & (hsv[:, :, 1] > 70)
    mask &= ~blue

    indices = np.flatnonzero(mask)
    rng = np.random.default_rng(153)
    indices = rng.choice(indices, min(200_000, len(indices)), replace=False)
    reference_flat = reference.reshape(-1, 3)[indices]
    design = np.concatenate([reference_flat, np.ones((len(indices), 1), dtype=np.float32)], axis=1)

    transforms: dict[str, np.ndarray] = {
        'afternoon': np.array(
            [[1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, 0]],
            dtype=np.float32,
        )
    }
    for phase in ('morning', 'evening', 'night'):
        target = scenes[phase].reshape(-1, 3)[indices]
        transforms[phase] = np.linalg.lstsq(design, target, rcond=None)[0].astype(np.float32)
    return transforms


def prepare_afternoon(image: Image.Image) -> Image.Image:
    rgba = image.convert('RGBA')
    alpha = rgba.getchannel('A')
    rgb = ImageEnhance.Brightness(rgba.convert('RGB')).enhance(0.97)
    rgb = ImageEnhance.Color(rgb).enhance(0.96)
    out = rgb.convert('RGBA')
    out.putalpha(alpha)
    return out


def grade_from_afternoon(image: Image.Image, phase: str, transforms: dict[str, np.ndarray]) -> Image.Image:
    rgba = np.asarray(image.convert('RGBA')).astype(np.float32) / 255.0
    rgb = rgba[:, :, :3]
    alpha = rgba[:, :, 3]
    design = np.concatenate(
        [rgb.reshape(-1, 3), np.ones((rgb.shape[0] * rgb.shape[1], 1), dtype=np.float32)],
        axis=1,
    )
    transformed = np.clip(design @ transforms[phase], 0.0, 1.0).reshape(rgb.shape)
    strength = PHASE_BLEND_STRENGTH[phase]
    graded = rgb * (1.0 - strength) + transformed * strength

    # Night needs restrained blossom highlights rather than a flat black sprite.
    if phase == 'night':
        luminance = graded.mean(axis=2, keepdims=True)
        graded = np.clip(graded + np.clip(luminance - 0.24, 0, 1) * np.array([0.025, 0.035, 0.065]), 0, 1)

    output = np.dstack([graded, alpha])
    return Image.fromarray((output * 255).astype(np.uint8), 'RGBA')


def composite_on_scene(scene: Image.Image, overlay: Image.Image) -> Image.Image:
    result = scene.convert('RGBA').copy()
    paste_x = TREE_ANCHOR_X - CANVAS_SIZE[0] // 2
    paste_y = TREE_GROUND_Y - CONTENT_BOTTOM_Y
    result.alpha_composite(overlay, (paste_x, paste_y))
    return result


def make_stage_preview(stages: list[Image.Image]) -> None:
    cell_w, cell_h = CANVAS_SIZE
    sheet = Image.new('RGBA', (cell_w * 3, cell_h * 2), (232, 232, 232, 255))
    draw = ImageDraw.Draw(sheet)
    for index, stage in enumerate(stages):
        x = (index % 3) * cell_w
        y = (index // 3) * cell_h
        for py in range(0, cell_h, 20):
            for px in range(0, cell_w, 20):
                color = (246, 246, 246, 255) if (px // 20 + py // 20) % 2 else (220, 220, 220, 255)
                draw.rectangle((x + px, y + py, x + px + 19, y + py + 19), fill=color)
        sheet.alpha_composite(stage, (x, y))
        draw.text((x + 12, y + 12), f'Stage {index}', fill=(40, 42, 48, 255))
    sheet.save(DOCS_ROOT / 'PRODUCTION-BUILD-15.3-TREE-SCALE-PROGRESSION.png')


def make_phase_preview(graded: dict[str, list[Image.Image]]) -> None:
    thumb_w, thumb_h = 724, 543
    sheet = Image.new('RGB', (thumb_w * 2, thumb_h * 2), (20, 24, 30))
    draw = ImageDraw.Draw(sheet)
    for index, phase in enumerate(PHASES):
        scene = Image.open(SCENE_ROOT / f'stage0-{phase}.png').convert('RGBA')
        comp = composite_on_scene(scene, graded[phase][5])
        thumb = comp.convert('RGB').resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
        x = (index % 2) * thumb_w
        y = (index // 2) * thumb_h
        sheet.paste(thumb, (x, y))
        draw.text((x + 16, y + 16), phase.title(), fill=(255, 255, 255))
    sheet.save(DOCS_ROOT / 'PRODUCTION-BUILD-15.3-TREE-PHASE-INTEGRATION.png')


def make_evening_night_detail(graded: dict[str, list[Image.Image]]) -> None:
    crop = (470, 245, 835, 610)
    size = (730, 730)
    sheet = Image.new('RGB', (size[0] * 2, size[1]), (20, 24, 30))
    draw = ImageDraw.Draw(sheet)
    for index, phase in enumerate(('evening', 'night')):
        scene = Image.open(SCENE_ROOT / f'stage0-{phase}.png').convert('RGBA')
        comp = composite_on_scene(scene, graded[phase][5]).crop(crop).resize(size, Image.Resampling.LANCZOS)
        sheet.paste(comp.convert('RGB'), (index * size[0], 0))
        draw.text((index * size[0] + 18, 18), phase.title(), fill=(255, 255, 255))
    sheet.save(DOCS_ROOT / 'PRODUCTION-BUILD-15.3-TREE-LOW-LIGHT-DETAIL.png')


def main() -> None:
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    DOCS_ROOT.mkdir(parents=True, exist_ok=True)
    transforms = phase_transform()

    normalized: list[Image.Image] = []
    afternoon: list[Image.Image] = []
    for stage in range(6):
        source_path = SOURCE_ROOT / f'tree-level-{stage}.png'
        stage_image = normalize_stage(Image.open(source_path), stage)
        normalized.append(stage_image)
        afternoon.append(prepare_afternoon(stage_image))

    graded: dict[str, list[Image.Image]] = {phase: [] for phase in PHASES}
    for phase in PHASES:
        for stage, image in enumerate(afternoon):
            phase_image = grade_from_afternoon(image, phase, transforms)
            graded[phase].append(phase_image)
            phase_image.save(OUTPUT_ROOT / f'{phase}-stage-{stage}.png', optimize=True)

    # Build 15.3 removes the visible inpaint oval. Every authored sprite already
    # includes a registered mound large enough to cover the baked starter patch.
    for legacy_base in OUTPUT_ROOT.glob('*-base.png'):
        legacy_base.unlink()

    make_stage_preview(normalized)
    make_phase_preview(graded)
    make_evening_night_detail(graded)
    print('built 24 scene-derived phase textures and 3 QA previews')
    print('removed legacy mound-cover plates')
    print('stage scales:', ', '.join(f'{value:.2f}' for value in STAGE_CONTENT_SCALES))


if __name__ == '__main__':
    main()
