from __future__ import annotations

from pathlib import Path
import cv2
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
HOME = ROOT / 'public/garden/evolution/home'
SOURCE = HOME / 'source'
ISLAND = ROOT / 'public/garden/islands/stage-0'
DOCS = ROOT / 'docs'
PHASES = ('morning', 'afternoon', 'evening', 'night')
CROP_X, CROP_Y = 100, 300
OUT_SIZE = (500, 450)
GRAND_WIDTH = 350
GRAND_X = 38
GRAND_Y = 48


def isolate_grand_house() -> Image.Image:
    path = SOURCE / 'approved-stage-5-grand-reference.png'
    bgr = cv2.imread(str(path), cv2.IMREAD_COLOR)
    if bgr is None:
        raise FileNotFoundError(path)
    h, w = bgr.shape[:2]

    cv2.setRNGSeed(3)
    mask = np.zeros((h, w), np.uint8)
    bgd = np.zeros((1, 65), np.float64)
    fgd = np.zeros((1, 65), np.float64)
    cv2.grabCut(bgr, mask, (40, 110, w - 80, 680), bgd, fgd, 12, cv2.GC_INIT_WITH_RECT)
    alpha = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)

    count, labels, stats, _ = cv2.connectedComponentsWithStats(alpha, 8)
    keep = np.zeros_like(alpha)
    components = sorted(range(1, count), key=lambda i: stats[i, cv2.CC_STAT_AREA], reverse=True)
    for component in components[:10]:
        if stats[component, cv2.CC_STAT_AREA] >= 100:
            keep[labels == component] = 255
    keep = cv2.morphologyEx(keep, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8), iterations=1)
    keep = np.where(keep >= 128, 255, 0).astype(np.uint8)

    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    rgba = np.dstack([rgb, keep])
    source = Image.fromarray(rgba, 'RGBA')
    bbox = source.getchannel('A').getbbox()
    if bbox is None:
        raise RuntimeError('grand home extraction produced no visible pixels')
    source = source.crop(bbox)

    grand_height = round(source.height * GRAND_WIDTH / source.width)
    source = source.resize((GRAND_WIDTH, grand_height), Image.Resampling.NEAREST)
    canvas = Image.new('RGBA', OUT_SIZE, (0, 0, 0, 0))
    canvas.alpha_composite(source, (GRAND_X, GRAND_Y))
    canvas.save(SOURCE / 'approved-stage-5-grand-cut.png', optimize=True)
    return canvas


def fit_phase_matrices() -> dict[str, np.ndarray]:
    # Stage 4 remains the stable visual reference for the approved four-phase lighting system.
    morning = np.array(Image.open(HOME / 'morning-stage-4.png').convert('RGBA'))
    visible = morning[:, :, 3] > 0
    x = morning[:, :, :3][visible].astype(np.float64)
    x1 = np.concatenate([x, np.ones((len(x), 1), dtype=np.float64)], axis=1)
    matrices: dict[str, np.ndarray] = {}
    for phase in PHASES:
        target = np.array(Image.open(HOME / f'{phase}-stage-4.png').convert('RGBA'))
        y = target[:, :, :3][visible].astype(np.float64)
        matrix, *_ = np.linalg.lstsq(x1, y, rcond=None)
        matrices[phase] = matrix
    return matrices


def apply_phase(master: Image.Image, phase: str, matrix: np.ndarray) -> Image.Image:
    rgba = np.array(master.convert('RGBA'))
    rgb = rgba[:, :, :3].astype(np.float64)
    alpha = rgba[:, :, 3]

    flat = rgb.reshape(-1, 3)
    output = np.concatenate([flat, np.ones((len(flat), 1), dtype=np.float64)], axis=1) @ matrix
    output = np.clip(output, 0, 255).reshape(rgb.shape)

    # The approved Stage 5 concept uses blue glass. At dusk/night, convert those glass
    # clusters to a warm interior glow while leaving the straw roof under phase lighting.
    blue = (
        (alpha > 0)
        & (rgb[:, :, 2] > 70)
        & (rgb[:, :, 2] > rgb[:, :, 0] * 1.08)
        & (rgb[:, :, 2] > rgb[:, :, 1] * 0.90)
    )
    blue_u8 = blue.astype(np.uint8)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(blue_u8, 8)
    window_mask = np.zeros_like(blue_u8)
    for component in range(1, count):
        area = stats[component, cv2.CC_STAT_AREA]
        if 3 <= area <= 500:
            window_mask[labels == component] = 1
    window = window_mask.astype(bool)

    if phase in ('evening', 'night') and np.any(window):
        strength = 0.55 if phase == 'evening' else 0.82
        lum = np.clip(rgb[:, :, 2] / 180.0, 0.35 if phase == 'evening' else 0.45, 1.0)
        warm = np.stack([235 * lum, 150 * lum, 62 * lum], axis=2)
        output[window] = (1.0 - strength) * output[window] + strength * warm[window]

    out = np.dstack([np.clip(output, 0, 255).astype(np.uint8), alpha])
    return Image.fromarray(out, 'RGBA')


def build_assets() -> None:
    master = isolate_grand_house()
    matrices = fit_phase_matrices()
    for phase in PHASES:
        image = apply_phase(master, phase, matrices[phase])
        image.save(HOME / f'{phase}-stage-5.png', optimize=True)


def checkerboard(size: tuple[int, int]) -> Image.Image:
    image = Image.new('RGB', size, (57, 64, 72))
    draw = ImageDraw.Draw(image)
    tile = 16
    for y in range(0, size[1], tile):
        for x in range(0, size[0], tile):
            if (x // tile + y // tile) % 2:
                draw.rectangle((x, y, x + tile - 1, y + tile - 1), fill=(78, 86, 95))
    return image


def composite_stage(phase: str, stage: int) -> Image.Image:
    base = Image.open(ISLAND / f'stage0-{phase}.png').convert('RGBA')
    if stage > 0:
        overlay = Image.open(HOME / f'{phase}-stage-{stage}.png').convert('RGBA')
        base.alpha_composite(overlay, (CROP_X, CROP_Y))
    return base


def make_qas() -> None:
    # Full 0–5 progression at morning so the final-stage jump is easy to judge.
    panels = [composite_stage('morning', stage).resize((724, 543), Image.Resampling.NEAREST).convert('RGB') for stage in range(6)]
    sheet = Image.new('RGB', (724 * 3, 543 * 2), (24, 27, 31))
    draw = ImageDraw.Draw(sheet)
    for index, panel in enumerate(panels):
        x, y = (index % 3) * 724, (index // 3) * 543
        sheet.paste(panel, (x, y))
        draw.rectangle((x + 8, y + 8, x + 118, y + 36), fill=(18, 20, 24))
        draw.text((x + 16, y + 15), f'Stage {index}', fill='white')
    sheet.save(DOCS / 'PRODUCTION-BUILD-20.8.1-HOME-STAGES-QA.jpg', quality=94)

    phase_panels = [(phase, composite_stage(phase, 5).resize((724, 543), Image.Resampling.NEAREST).convert('RGB')) for phase in PHASES]
    phase_sheet = Image.new('RGB', (724 * 2, 543 * 2), (24, 27, 31))
    draw = ImageDraw.Draw(phase_sheet)
    for index, (phase, panel) in enumerate(phase_panels):
        x, y = (index % 2) * 724, (index // 2) * 543
        phase_sheet.paste(panel, (x, y))
        draw.rectangle((x + 8, y + 8, x + 152, y + 36), fill=(18, 20, 24))
        draw.text((x + 16, y + 15), phase.title(), fill='white')
    phase_sheet.save(DOCS / 'PRODUCTION-BUILD-20.8.1-HOME-PHASES-QA.jpg', quality=94)

    # Transparency/asset-scale QA for the final house itself.
    sprite = Image.open(HOME / 'morning-stage-5.png').convert('RGBA')
    checker = checkerboard(sprite.size)
    checker.paste(sprite, (0, 0), sprite)
    checker.resize((1000, 900), Image.Resampling.NEAREST).save(DOCS / 'PRODUCTION-BUILD-20.8.1-HOME-STAGE5-TRANSPARENCY-QA.png')


if __name__ == '__main__':
    build_assets()
    make_qas()
    print('Build 20.8.1 Home Stage 5 roofline alignment assets generated')
