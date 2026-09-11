from __future__ import annotations

from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
HOME = ROOT / 'public/garden/evolution/home'
ISLAND = ROOT / 'public/garden/islands/stage-0'
DOCS = ROOT / 'docs'
PHASES = ('morning', 'afternoon', 'evening', 'night')
CROP_X, CROP_Y = 100, 300
OUT_SIZE = (500, 450)


def build_stage5_master() -> Image.Image:
    """Build Stage 5 only from the same-orientation Stage 4/2 pixel sprites.

    Stage 4 is copied byte-for-byte into the new master before any additions.
    The final stage grows outward to the right with the existing porch roof pitch,
    vines, flower-box details, and a second matching chimney. No re-oriented house
    reference or procedural vector art is used.
    """
    stage4 = Image.open(HOME / 'afternoon-stage-4.png').convert('RGBA')
    stage2 = Image.open(HOME / 'afternoon-stage-2.png').convert('RGBA')

    master = Image.new('RGBA', OUT_SIZE, (0, 0, 0, 0))
    master.alpha_composite(stage4)

    extension = stage2.crop((190, 112, 318, 258)).copy()
    arr = np.array(extension)
    arr[:, 112:, 3] = 0  # do not duplicate the mailbox/right fringe
    for x in range(18):
        arr[:, x, 3] = (arr[:, x, 3].astype(np.float32) * (x / 18.0)).astype(np.uint8)
    extension = Image.fromarray(arr, 'RGBA')
    master.alpha_composite(extension, (280, 114))

    # Same roof pitch: bridge the added wing with pixels from the Stage 4 porch roof.
    connector = stage4.crop((177, 111, 247, 160)).resize((100, 49), Image.Resampling.NEAREST)
    arr = np.array(connector)
    for x in range(10):
        arr[:, x, 3] = (arr[:, x, 3].astype(np.float32) * (x / 10.0)).astype(np.uint8)
        arr[:, -x - 1, 3] = (arr[:, -x - 1, 3].astype(np.float32) * (x / 10.0)).astype(np.uint8)
    connector = Image.fromarray(arr, 'RGBA')
    master.alpha_composite(connector, (238, 108))

    flower_box = stage4.crop((115, 188, 166, 224))
    master.alpha_composite(flower_box, (328, 190))
    vine = stage4.crop((145, 150, 188, 255))
    master.alpha_composite(vine, (270, 155))

    # A second stone chimney uses the exact same Stage 4 pixel construction.
    chimney = stage4.crop((222, 45, 258, 104))
    master.alpha_composite(chimney, (335, 92))

    source = HOME / 'source'
    source.mkdir(parents=True, exist_ok=True)
    master.save(source / 'approved-stage-5-same-orientation-master.png', optimize=True)
    return master


def fit_phase_matrices() -> dict[str, np.ndarray]:
    afternoon = np.array(Image.open(HOME / 'afternoon-stage-4.png').convert('RGBA'))
    visible = afternoon[:, :, 3] > 0
    x = afternoon[:, :, :3][visible].astype(np.float64)
    x1 = np.concatenate([x, np.ones((len(x), 1), dtype=np.float64)], axis=1)
    matrices: dict[str, np.ndarray] = {}
    for phase in PHASES:
        target = np.array(Image.open(HOME / f'{phase}-stage-4.png').convert('RGBA'))
        y = target[:, :, :3][visible].astype(np.float64)
        matrix, *_ = np.linalg.lstsq(x1, y, rcond=None)
        matrices[phase] = matrix
    return matrices


def apply_phase(master: Image.Image, matrix: np.ndarray) -> Image.Image:
    rgba = np.array(master.convert('RGBA'))
    rgb = rgba[:, :, :3].astype(np.float64)
    alpha = rgba[:, :, 3]
    flat = rgb.reshape(-1, 3)
    output = np.concatenate([flat, np.ones((len(flat), 1), dtype=np.float64)], axis=1) @ matrix
    output = np.clip(output, 0, 255).reshape(rgb.shape)
    return Image.fromarray(np.dstack([output.astype(np.uint8), alpha]), 'RGBA')


def build_stage5_phases() -> None:
    master = build_stage5_master()
    matrices = fit_phase_matrices()
    for phase in PHASES:
        apply_phase(master, matrices[phase]).save(HOME / f'{phase}-stage-5.png', optimize=True)


def checkerboard(size: tuple[int, int]) -> Image.Image:
    image = Image.new('RGB', size, (61, 66, 73))
    draw = ImageDraw.Draw(image)
    tile = 18
    for y in range(0, size[1], tile):
        for x in range(0, size[0], tile):
            if (x // tile + y // tile) % 2:
                draw.rectangle((x, y, x + tile - 1, y + tile - 1), fill=(82, 89, 97))
    return image


def composite_stage(phase: str, stage: int) -> Image.Image:
    base = Image.open(ISLAND / f'stage0-{phase}.png').convert('RGBA')
    if stage > 0:
        overlay = Image.open(HOME / f'{phase}-stage-{stage}.png').convert('RGBA')
        base.alpha_composite(overlay, (CROP_X, CROP_Y))
    return base


def make_qas() -> None:
    panels = [composite_stage('afternoon', stage).resize((724, 543), Image.Resampling.NEAREST).convert('RGB') for stage in range(6)]
    sheet = Image.new('RGB', (724 * 3, 543 * 2), (23, 26, 30))
    draw = ImageDraw.Draw(sheet)
    for index, panel in enumerate(panels):
        x, y = (index % 3) * 724, (index // 3) * 543
        sheet.paste(panel, (x, y))
        draw.rectangle((x + 8, y + 8, x + 128, y + 38), fill=(18, 20, 24))
        draw.text((x + 16, y + 16), f'Stage {index}', fill='white')
    sheet.save(DOCS / 'PRODUCTION-BUILD-20.8.2-HOME-STAGES-QA.jpg', quality=95)

    phase_sheet = Image.new('RGB', (724 * 2, 543 * 2), (23, 26, 30))
    draw = ImageDraw.Draw(phase_sheet)
    for index, phase in enumerate(PHASES):
        panel = composite_stage(phase, 5).resize((724, 543), Image.Resampling.NEAREST).convert('RGB')
        x, y = (index % 2) * 724, (index // 2) * 543
        phase_sheet.paste(panel, (x, y))
        draw.rectangle((x + 8, y + 8, x + 158, y + 38), fill=(18, 20, 24))
        draw.text((x + 16, y + 16), phase.title(), fill='white')
    phase_sheet.save(DOCS / 'PRODUCTION-BUILD-20.8.2-HOME-PHASES-QA.jpg', quality=95)

    s4 = Image.open(HOME / 'afternoon-stage-4.png').convert('RGBA')
    s5 = Image.open(HOME / 'afternoon-stage-5.png').convert('RGBA')
    raw = Image.new('RGB', (1000, 450), (0, 0, 0))
    draw = ImageDraw.Draw(raw)
    for idx, (label, sprite) in enumerate((('Stage 4', s4), ('Stage 5', s5))):
        check = checkerboard(sprite.size)
        check.paste(sprite, (0, 0), sprite)
        raw.paste(check, (idx * 500, 0))
        draw.text((idx * 500 + 12, 12), label, fill='white')
    raw.save(DOCS / 'PRODUCTION-BUILD-20.8.2-HOME-ORIENTATION-QA.png')


if __name__ == '__main__':
    build_stage5_phases()
    make_qas()
    print('Build 20.8.2 same-orientation Stage 5 assets generated')
