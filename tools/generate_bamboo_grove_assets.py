from __future__ import annotations

from pathlib import Path
from typing import Iterable
import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / 'public/garden/evolution/bamboo-grove/source'
OUT_DIR = ROOT / 'public/garden/evolution/bamboo-grove'
DOCS_DIR = ROOT / 'docs'
OBJECTS_DIR = ROOT / 'public/garden/objects'
OUT_DIR.mkdir(parents=True, exist_ok=True)
DOCS_DIR.mkdir(parents=True, exist_ok=True)

CANVAS = (768, 640)
ANCHOR = (384, 590)
MAP_ANCHOR = (1035, 410)
PHASES = ('morning', 'afternoon', 'evening', 'night')
STAGE_NAMES = ('Sleeping shoot', 'First stalk', 'Twin shoots', 'Young cluster', 'Established grove', 'Mature grove')


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    return image.getchannel('A').getbbox() or (0, 0, image.width, image.height)


def crop_alpha(image: Image.Image) -> Image.Image:
    return image.crop(alpha_bbox(image))


def paste_bottom_center(canvas: Image.Image, layer: Image.Image, x: int, bottom: int) -> None:
    canvas.alpha_composite(layer, (round(x - layer.width / 2), round(bottom - layer.height)))


def isolate_stalk(image: Image.Image) -> Image.Image:
    rgba = np.asarray(image.convert('RGBA')).copy()
    h, w = rgba.shape[:2]
    alpha = rgba[:, :, 3]
    yy, xx = np.mgrid[0:h, 0:w]
    # The source cutout still contains a slice of the original planting mound.
    # Keep the leafy top intact, then taper to the central stalk below it.
    half_width = np.where(yy < int(h * 0.58), w, np.where(yy < int(h * 0.72), w * 0.34, w * 0.18))
    center = w * 0.50
    keep = (np.abs(xx - center) <= half_width / 2) | (yy < int(h * 0.58))
    alpha[~keep] = 0
    rgb = rgba[:, :, :3]
    pale_checker = (rgb.min(axis=2) > 175) & ((rgb.max(axis=2) - rgb.min(axis=2)) < 45)
    alpha[pale_checker] = 0
    alpha[-12:, :] = 0
    rgba[:, :, 3] = alpha
    return Image.fromarray(rgba, 'RGBA')


def recolor_bamboo(image: Image.Image) -> Image.Image:
    rgba = np.asarray(isolate_stalk(image).convert('RGBA')).copy()
    rgb = rgba[:, :, :3].astype(np.float32)
    alpha = rgba[:, :, 3]
    lum = rgb[:, :, 0] * 0.299 + rgb[:, :, 1] * 0.587 + rgb[:, :, 2] * 0.114
    t = np.clip((lum - 35.0) / 205.0, 0.0, 1.0)
    dark = np.array([48.0, 80.0, 47.0])
    mid = np.array([101.0, 136.0, 73.0])
    light = np.array([174.0, 190.0, 108.0])
    low = np.clip(t / 0.58, 0.0, 1.0)[..., None]
    high = np.clip((t - 0.58) / 0.42, 0.0, 1.0)[..., None]
    mapped = dark * (1 - low) + mid * low
    mapped = mapped * (1 - high) + light * high
    # Preserve a little original value texture while removing the neon yellow-green cast.
    mapped = mapped * 0.78 + rgb * 0.22
    rgba[:, :, :3] = np.clip(mapped, 0, 255).astype(np.uint8)
    rgba[:, :, 3] = alpha
    return Image.fromarray(rgba, 'RGBA')


def transform(layer: Image.Image, height: int, width_ratio: float = 0.58, flip: bool = False, angle: float = 0.0) -> Image.Image:
    crop = crop_alpha(layer)
    if flip:
        crop = crop.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    scale = height / crop.height
    width = max(1, round(crop.width * scale * width_ratio))
    crop = crop.resize((width, height), Image.Resampling.LANCZOS)
    if angle:
        crop = crop.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)
    return crop


def transform_prop(layer: Image.Image, width: int, flip: bool = False) -> Image.Image:
    crop = crop_alpha(layer)
    if flip:
        crop = crop.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    height = max(1, round(crop.height * width / crop.width))
    return crop.resize((width, height), Image.Resampling.LANCZOS)


def load_prop(relative: str) -> Image.Image:
    return Image.open(OBJECTS_DIR / relative).convert('RGBA')


def compose_stage(stalk: Image.Image, stage: int) -> Image.Image:
    canvas = Image.new('RGBA', CANVAS, (0, 0, 0, 0))
    grass_short = load_prop('grass/grass-short-02.png')
    grass_edge = load_prop('grass/grass-edge-04.png')
    grass_tall = load_prop('grass/grass-tall-03.png')

    layouts: dict[int, list[tuple[int, int, int, bool, float, float]]] = {
        # height, x offset, bottom offset, flip, angle, width ratio
        0: [(92, 0, -2, False, -2.5, 0.52)],
        1: [(190, 0, -2, False, -3.5, 0.52)],
        2: [(250, -22, -2, False, -4.5, 0.52), (168, 35, 0, True, 4.5, 0.50)],
        3: [(305, 0, -3, False, -1.5, 0.52), (225, -48, 0, True, -5.0, 0.50), (196, 50, 1, False, 5.5, 0.50)],
        4: [(350, -8, -4, False, -1.0, 0.52), (278, -62, 0, True, -5.5, 0.49), (258, 50, 0, False, 5.0, 0.50), (205, -100, 3, False, -7.0, 0.47), (190, 94, 4, True, 7.0, 0.47)],
        5: [(405, 0, -5, False, -1.0, 0.52), (330, -58, -1, True, -5.0, 0.49), (312, 55, -1, False, 5.0, 0.49), (258, -105, 2, False, -7.0, 0.46), (244, 105, 3, True, 7.0, 0.46), (205, -145, 5, True, -8.0, 0.45), (196, 145, 6, False, 8.0, 0.45)],
    }

    # Back-to-front irregular stalk placement. No circular dirt island is used.
    for height, x_offset, bottom_offset, flip, angle, width_ratio in layouts[stage]:
        layer = transform(stalk, height, width_ratio, flip, angle)
        paste_bottom_center(canvas, layer, ANCHOR[0] + x_offset, ANCHOR[1] + bottom_offset)

    # Sparse grass and one restrained stone integrate the grove directly into the hill.
    if stage >= 0:
        paste_bottom_center(canvas, transform_prop(grass_short, 66, False), ANCHOR[0] - 28, ANCHOR[1] + 7)
    if stage >= 2:
        paste_bottom_center(canvas, transform_prop(grass_edge, 74, True), ANCHOR[0] + 48, ANCHOR[1] + 9)
    if stage >= 3:
        paste_bottom_center(canvas, transform_prop(grass_tall, 72, False), ANCHOR[0] - 76, ANCHOR[1] + 8)
    if stage >= 4:
        paste_bottom_center(canvas, transform_prop(grass_short, 58, True), ANCHOR[0] + 92, ANCHOR[1] + 8)

    return canvas


def local_map_color(phase: str) -> tuple[int, int, int]:
    image = Image.open(ROOT / f'public/garden/islands/stage-0/stage0-{phase}.png').convert('RGB')
    x, y = MAP_ANCHOR
    patch = np.asarray(image.crop((x - 55, y - 38, x + 55, y + 38)), dtype=np.uint8).reshape(-1, 3)
    # Median is robust against flowers, stones, and bright path pixels.
    return tuple(int(value) for value in np.median(patch, axis=0))


def color_grade(image: Image.Image, phase: str) -> Image.Image:
    alpha = image.getchannel('A')
    rgb = image.convert('RGB')
    local = local_map_color(phase)
    if phase == 'morning':
        rgb = ImageEnhance.Brightness(rgb).enhance(1.10)
        rgb = ImageEnhance.Contrast(rgb).enhance(0.96)
        rgb = ImageEnhance.Color(rgb).enhance(0.94)
        amount = 0.08
    elif phase == 'evening':
        rgb = ImageEnhance.Brightness(rgb).enhance(0.80)
        rgb = ImageEnhance.Contrast(rgb).enhance(0.95)
        rgb = ImageEnhance.Color(rgb).enhance(0.78)
        amount = 0.24
    elif phase == 'night':
        rgb = ImageEnhance.Brightness(rgb).enhance(0.50)
        rgb = ImageEnhance.Contrast(rgb).enhance(0.90)
        rgb = ImageEnhance.Color(rgb).enhance(0.60)
        amount = 0.36
    else:
        rgb = ImageEnhance.Brightness(rgb).enhance(1.12)
        rgb = ImageEnhance.Contrast(rgb).enhance(1.00)
        rgb = ImageEnhance.Color(rgb).enhance(0.98)
        amount = 0.05
    rgb = Image.blend(rgb, Image.new('RGB', rgb.size, local), amount)
    result = rgb.convert('RGBA')
    result.putalpha(alpha)
    return result


def load_font(size: int) -> ImageFont.ImageFont:
    for path in ('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf'):
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def make_stage_sheet(stages: Iterable[Image.Image]) -> None:
    stages = list(stages)
    cell_w, cell_h = 320, 300
    sheet = Image.new('RGB', (cell_w * 3, cell_h * 2), (35, 53, 58))
    draw = ImageDraw.Draw(sheet)
    font = load_font(22)
    for index, stage in enumerate(stages):
        preview = crop_alpha(stage)
        preview.thumbnail((276, 232), Image.Resampling.LANCZOS)
        col, row = index % 3, index // 3
        x = col * cell_w + (cell_w - preview.width) // 2
        y = row * cell_h + 12 + (232 - preview.height)
        sheet.paste(preview, (x, y), preview)
        label = f'Stage {index} · {STAGE_NAMES[index]}'
        box = draw.textbbox((0, 0), label, font=font)
        draw.text((col * cell_w + (cell_w - (box[2] - box[0])) // 2, row * cell_h + 258), label, font=font, fill=(242, 238, 219))
    sheet.save(DOCS_DIR / 'PRODUCTION-BUILD-17.2-BAMBOO-STAGES.png', optimize=True)


def make_phase_sheet() -> None:
    sheet = Image.new('RGB', (724 * 2, 543 * 2), (28, 36, 44))
    positions = {'morning': (0, 0), 'afternoon': (724, 0), 'evening': (0, 543), 'night': (724, 543)}
    draw = ImageDraw.Draw(sheet)
    font = load_font(24)
    for phase in PHASES:
        map_image = Image.open(ROOT / f'public/garden/islands/stage-0/stage0-{phase}.png').convert('RGBA').resize((724, 543), Image.Resampling.LANCZOS)
        bamboo = Image.open(OUT_DIR / f'{phase}-stage-5.png').convert('RGBA').resize((113, 105), Image.Resampling.LANCZOS)
        x = round(MAP_ANCHOR[0] / 1448 * 724 - bamboo.width / 2)
        y = round(MAP_ANCHOR[1] / 1086 * 543 - bamboo.height * (590 / 640))
        map_image.alpha_composite(bamboo, (x, y))
        px, py = positions[phase]
        sheet.paste(map_image.convert('RGB'), (px, py))
        draw.rectangle((px + 14, py + 14, px + 165, py + 50), fill=(20, 26, 34))
        draw.text((px + 26, py + 20), phase.title(), font=font, fill=(255, 247, 225))
    sheet.save(DOCS_DIR / 'PRODUCTION-BUILD-17.2-BAMBOO-PHASE-INTEGRATION.png', optimize=True)


def main() -> None:
    raw_stalk = Image.open(SOURCE_DIR / 'bamboo-stalk-cutout.png').convert('RGBA')
    stalk = recolor_bamboo(crop_alpha(raw_stalk))
    stalk.save(SOURCE_DIR / 'bamboo-stalk-muted.png', optimize=True)

    afternoon_stages: list[Image.Image] = []
    for stage in range(6):
        authored = compose_stage(stalk, stage)
        authored.save(OUT_DIR / f'source-stage-{stage}.png', optimize=True)
        afternoon_stages.append(authored)
        for phase in PHASES:
            color_grade(authored, phase).save(OUT_DIR / f'{phase}-stage-{stage}.png', optimize=True)

    make_stage_sheet(afternoon_stages)
    make_phase_sheet()
    print('generated muted, terrain-integrated bamboo: 6 stages × 4 phase variants')


if __name__ == '__main__':
    main()
