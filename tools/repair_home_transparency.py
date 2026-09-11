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
# Stages 1–4 use the historical extraction repair. Stage 5 is rebuilt by
# build_home_stage5_grand.py from the separately approved final-home reference.
STAGES = range(1, 5)
CROP_X, CROP_Y = 100, 300
OUT_SIZE = (500, 450)


def clean_source_mask(stage: int) -> np.ndarray:
    src_path = SOURCE / f'approved-stage-{stage}.png'
    bgr = cv2.imread(str(src_path), cv2.IMREAD_COLOR)
    if bgr is None:
        raise FileNotFoundError(src_path)
    h, w = bgr.shape[:2]
    cv2.setRNGSeed(0)
    mask = np.zeros((h, w), np.uint8)
    bgd = np.zeros((1, 65), np.float64)
    fgd = np.zeros((1, 65), np.float64)
    cv2.grabCut(bgr, mask, (20, 15, w - 40, h - 40), bgd, fgd, 10, cv2.GC_INIT_WITH_RECT)
    alpha = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(alpha, 8)
    keep = np.zeros_like(alpha)
    components = sorted(range(1, count), key=lambda i: stats[i, cv2.CC_STAT_AREA], reverse=True)
    for component in components[:8]:
        if stats[component, cv2.CC_STAT_AREA] >= 80:
            keep[labels == component] = 255
    return keep


def stage_homography(stage: int) -> np.ndarray:
    src = cv2.imread(str(SOURCE / f'approved-stage-{stage}.png'), cv2.IMREAD_COLOR)
    runtime_rgba = np.array(Image.open(HOME / f'morning-stage-{stage}.png').convert('RGBA'))
    runtime = cv2.cvtColor(runtime_rgba[:, :, :3], cv2.COLOR_RGB2BGR)
    gray_a = cv2.cvtColor(src, cv2.COLOR_BGR2GRAY)
    gray_b = cv2.cvtColor(runtime, cv2.COLOR_BGR2GRAY)
    sift = cv2.SIFT_create(nfeatures=5000)
    kp_a, desc_a = sift.detectAndCompute(gray_a, None)
    kp_b, desc_b = sift.detectAndCompute(gray_b, None)
    matcher = cv2.FlannBasedMatcher(dict(algorithm=1, trees=5), dict(checks=80))
    pairs = matcher.knnMatch(desc_a, desc_b, k=2)
    good = [m for m, n in pairs if m.distance < 0.70 * n.distance]
    if len(good) < 30:
        raise RuntimeError(f'not enough home alignment matches for stage {stage}: {len(good)}')
    pts_a = np.float32([kp_a[m.queryIdx].pt for m in good]).reshape(-1, 1, 2)
    pts_b = np.float32([kp_b[m.trainIdx].pt for m in good]).reshape(-1, 1, 2)
    H, inliers = cv2.findHomography(pts_a, pts_b, cv2.RANSAC, 3.0)
    if H is None or inliers is None or int(inliers.sum()) < 25:
        raise RuntimeError(f'failed home alignment for stage {stage}')
    return H


def repair_assets() -> None:
    for stage in STAGES:
        alpha_src = clean_source_mask(stage)
        H = stage_homography(stage)
        alpha_runtime = cv2.warpPerspective(
            alpha_src, H, OUT_SIZE, flags=cv2.INTER_NEAREST,
            borderMode=cv2.BORDER_CONSTANT, borderValue=0,
        )
        alpha_runtime = np.where(alpha_runtime >= 128, 255, 0).astype(np.uint8)
        for phase in PHASES:
            path = HOME / f'{phase}-stage-{stage}.png'
            rgba = np.array(Image.open(path).convert('RGBA'))
            rgba[:, :, 3] = alpha_runtime
            Image.fromarray(rgba, 'RGBA').save(path, optimize=True)


def checkerboard(size: tuple[int, int]) -> Image.Image:
    w, h = size
    image = Image.new('RGB', size, (57, 64, 72))
    draw = ImageDraw.Draw(image)
    tile = 16
    for y in range(0, h, tile):
        for x in range(0, w, tile):
            if (x // tile + y // tile) % 2:
                draw.rectangle((x, y, x + tile - 1, y + tile - 1), fill=(78, 86, 95))
    return image


def make_transparency_qa() -> None:
    panels: list[Image.Image] = []
    for stage in STAGES:
        sprite = Image.open(HOME / f'morning-stage-{stage}.png').convert('RGBA')
        panel = checkerboard(sprite.size)
        panel.paste(sprite, (0, 0), sprite)
        d = ImageDraw.Draw(panel)
        d.rectangle((8, 8, 100, 34), fill=(18, 20, 24))
        d.text((16, 14), f'Stage {stage}', fill='white')
        panels.append(panel)
    w, h = OUT_SIZE
    sheet = Image.new('RGB', (w * 3, h * 2), (25, 28, 32))
    for i, panel in enumerate(panels):
        sheet.paste(panel, ((i % 3) * w, (i // 3) * h))
    sheet.save(DOCS / 'PRODUCTION-BUILD-20.7.1-HOME-TRANSPARENCY-QA.jpg', quality=94)


def composite_stage(phase: str, stage: int) -> Image.Image:
    base = Image.open(ISLAND / f'stage0-{phase}.png').convert('RGBA')
    if stage > 0:
        overlay = Image.open(HOME / f'{phase}-stage-{stage}.png').convert('RGBA')
        base.alpha_composite(overlay, (CROP_X, CROP_Y))
    return base


def make_scene_qas() -> None:
    stage_panels = [composite_stage('morning', s).resize((724, 543), Image.Resampling.NEAREST).convert('RGB') for s in range(6)]
    sw, sh = stage_panels[0].size
    stage_sheet = Image.new('RGB', (sw * 3, sh * 2), (24, 27, 31))
    draw = ImageDraw.Draw(stage_sheet)
    for i, panel in enumerate(stage_panels):
        x, y = (i % 3) * sw, (i // 3) * sh
        stage_sheet.paste(panel, (x, y))
        draw.rectangle((x + 8, y + 8, x + 112, y + 34), fill=(18, 20, 24))
        draw.text((x + 16, y + 14), f'Stage {i}', fill='white')
    stage_sheet.save(DOCS / 'PRODUCTION-BUILD-20.7.1-HOME-STAGES-QA.jpg', quality=93)

    phase_panels = [composite_stage(p, 5).resize((724, 543), Image.Resampling.NEAREST).convert('RGB') for p in PHASES]
    phase_sheet = Image.new('RGB', (sw * 2, sh * 2), (24, 27, 31))
    draw = ImageDraw.Draw(phase_sheet)
    for i, (phase, panel) in enumerate(zip(PHASES, phase_panels)):
        x, y = (i % 2) * sw, (i // 2) * sh
        phase_sheet.paste(panel, (x, y))
        draw.rectangle((x + 8, y + 8, x + 142, y + 34), fill=(18, 20, 24))
        draw.text((x + 16, y + 14), phase.title(), fill='white')
    phase_sheet.save(DOCS / 'PRODUCTION-BUILD-20.7.1-HOME-PHASES-QA.jpg', quality=93)


if __name__ == '__main__':
    repair_assets()
    make_transparency_qa()
    make_scene_qas()
    print('Build 20.7.1 home transparency repaired')
