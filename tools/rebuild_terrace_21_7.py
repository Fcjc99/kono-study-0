from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
LANTERNS = ROOT / 'public/garden/evolution/lanterns'
SOURCE = LANTERNS / 'source/approved-terrace-evolution.png'
MAP = ROOT / 'public/garden/islands/stage-0/stage0-afternoon.png'
FULL = LANTERNS / 'full-silhouette'
FULL.mkdir(parents=True, exist_ok=True)

MAP_W, MAP_H = 1448, 1086
CROP_X, CROP_Y = 900, 250
CROP_W, CROP_H = 430, 360
PANEL_COORDS = {
    0: (20, 20, 690, 345),
    1: (725, 20, 1390, 345),
    2: (20, 385, 690, 680),
    3: (725, 385, 1390, 680),
    4: (20, 720, 690, 1015),
    5: (725, 720, 1390, 1015),
}

# Exact terrace floor footprint on the production Stage 0 map crop.
FLOOR_POLY = np.array([
    [82, 197], [106, 153], [263, 156], [341, 195], [340, 220],
    [289, 247], [224, 268], [115, 252], [81, 224]
], dtype=np.int32)

# Source panel crops.
sheet = Image.open(SOURCE).convert('RGB')
for stage, box in PANEL_COORDS.items():
    sheet.crop(box).save(LANTERNS / 'source' / f'approved-terrace-stage-{stage}.png')

actual_map = cv2.imread(str(MAP), cv2.IMREAD_COLOR)
actual_crop = actual_map[CROP_Y:CROP_Y+CROP_H, CROP_X:CROP_X+CROP_W].copy()

# Register the generated/approved Stage 0 panel directly against the production map's terrace.
s0 = cv2.imread(str(LANTERNS / 'source/approved-terrace-stage-0.png'), cv2.IMREAD_COLOR)
orb = cv2.ORB_create(5000)
g1 = cv2.cvtColor(s0, cv2.COLOR_BGR2GRAY)
g2 = cv2.cvtColor(actual_crop, cv2.COLOR_BGR2GRAY)
kp1, des1 = orb.detectAndCompute(g1, None)
kp2, des2 = orb.detectAndCompute(g2, None)
if des1 is None or des2 is None:
    raise RuntimeError('Terrace registration features unavailable')
matcher = cv2.BFMatcher(cv2.NORM_HAMMING)
good = [m for m, n in matcher.knnMatch(des1, des2, k=2) if m.distance < 0.75 * n.distance]
if len(good) < 20:
    raise RuntimeError(f'Not enough terrace registration matches: {len(good)}')
src = np.float32([kp1[m.queryIdx].pt for m in good]).reshape(-1, 1, 2)
dst = np.float32([kp2[m.trainIdx].pt for m in good]).reshape(-1, 1, 2)
H, inliers = cv2.findHomography(src, dst, cv2.RANSAC, 5)
if H is None:
    raise RuntimeError('Terrace homography failed')

warps = []
for stage in range(6):
    panel = cv2.imread(str(LANTERNS / 'source' / f'approved-terrace-stage-{stage}.png'), cv2.IMREAD_COLOR)
    warp = cv2.warpPerspective(panel, H, (CROP_W, CROP_H))
    warps.append(warp)

# Color-lock all approved stage panels to the real Stage 0 terrace wood/palette.
floor_mask = np.zeros((CROP_H, CROP_W), dtype=np.uint8)
cv2.fillPoly(floor_mask, [FLOOR_POLY], 255)
x = warps[0][floor_mask > 0].astype(np.float64)
y = actual_crop[floor_mask > 0].astype(np.float64)
coeffs = []
for c in range(3):
    A = np.vstack([x[:, c], np.ones(len(x))]).T
    a, b = np.linalg.lstsq(A, y[:, c], rcond=None)[0]
    coeffs.append((float(a), float(b)))

matched = []
for warp in warps:
    z = warp.astype(np.float32)
    for c, (a, b) in enumerate(coeffs):
        z[:, :, c] = np.clip(z[:, :, c] * a + b, 0, 255)
    matched.append(z.astype(np.uint8))

# Remove source-sheet stage label remnants before detecting tall pergola additions.
for stage in (4, 5):
    # Label lands in this narrow upper strip after registration; restore base there.
    matched[stage][80:108, 160:305] = matched[0][80:108, 160:305]

# Base Stage 0 structure mask for standalone sprite QA: floor + posts + stool + string lights.
base_structure = floor_mask.copy()
cv2.rectangle(base_structure, (96, 118), (114, 209), 255, -1)
cv2.rectangle(base_structure, (253, 120), (274, 211), 255, -1)
cv2.rectangle(base_structure, (205, 257), (250, 293), 255, -1)
# The runtime map already contains the original Stage 0 string lights; standalone sprites
# keep the complete deck/posts/stool silhouette without copying strips of surrounding grass.

# Detect additions outside the deck floor. This is used for the pergola/planters/lanterns only;
# the floor itself is always a complete replacement, eliminating the old blocky line-art overlays.
def extras_mask(stage: int) -> np.ndarray:
    if stage <= 3:
        return np.zeros_like(floor_mask)

    diff = cv2.absdiff(matched[stage], matched[0])
    dg = cv2.cvtColor(diff, cv2.COLOR_BGR2GRAY)
    roi = np.zeros_like(floor_mask)
    roi[95:225, 55:360] = 255
    roi[floor_mask > 0] = 0

    hsv = cv2.cvtColor(matched[stage], cv2.COLOR_BGR2HSV)
    hh, ss, vv = cv2.split(hsv)
    plausible = (
        (vv < 178)
        | ((hh < 38) & (ss > 58))
        | ((hh > 135) & (ss > 52))
        | ((hh > 35) & (hh < 95) & (ss > 95) & (vv < 205))
    )
    m = ((dg > 34) & (roi > 0) & plausible).astype(np.uint8) * 255
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8), iterations=1)
    m = cv2.dilate(m, np.ones((3, 3), np.uint8), iterations=1)
    # Strip the source-sheet label band.
    m[80:108, :] = 0

    n, labels, stats, _ = cv2.connectedComponentsWithStats(m, 8)
    out = np.zeros_like(m)
    for i in range(1, n):
        x, y, w, h, area = stats[i].tolist()
        if stage == 4:
            keep = (
                area >= 100
                and y >= 105
                and (
                    (x <= 215)
                    or (x >= 250)
                )
            )
        else:
            keep = area >= 100 and y >= 100
        if keep:
            out[labels == i] = 255
    return out

# Stage 0 runtime overlay remains transparent because Stage 0 is baked into the island map.
Image.new('RGBA', (MAP_W, MAP_H), (0, 0, 0, 0)).save(LANTERNS / 'terrace-stage-0.png')

for stage in range(6):
    extras = extras_mask(stage)
    complete = cv2.bitwise_or(floor_mask, extras)

    # Standalone complete terrace sprite for visual QA.
    crop_rgba = np.zeros((CROP_H, CROP_W, 4), dtype=np.uint8)
    if stage == 0:
        crop_rgba[:, :, :3] = actual_crop
        crop_rgba[:, :, 3] = base_structure
    else:
        # Full terrace floor comes from the approved stage, while original posts/string/stool remain
        # from the production map so every isolated sprite still reads as a complete Stage 0-derived terrace.
        crop_rgba[:, :, :3] = matched[stage]
        crop_rgba[:, :, 3] = cv2.bitwise_or(complete, base_structure)
        # Restore original base structure pixels so orientation/DNA are literally Stage 0.
        base_bool = base_structure > 0
        crop_rgba[base_bool, :3] = actual_crop[base_bool]
        # Re-apply approved stage art over floor and detected new structures.
        stage_bool = complete > 0
        crop_rgba[stage_bool, :3] = matched[stage][stage_bool]
    cv2.imwrite(str(FULL / f'terrace-stage-{stage}.png'), crop_rgba)

    if stage == 0:
        continue
    # Runtime full-map overlay: replace the deck surface + approved new structures only.
    runtime_rgba = np.zeros((MAP_H, MAP_W, 4), dtype=np.uint8)
    runtime_crop = np.zeros((CROP_H, CROP_W, 4), dtype=np.uint8)
    runtime_crop[:, :, :3] = matched[stage]
    runtime_crop[:, :, 3] = complete
    runtime_rgba[CROP_Y:CROP_Y+CROP_H, CROP_X:CROP_X+CROP_W] = runtime_crop
    cv2.imwrite(str(LANTERNS / f'terrace-stage-{stage}.png'), runtime_rgba)

print('Terrace 21.7 rebuild complete')
print('registration matches:', len(good), 'inliers:', int(inliers.sum()) if inliers is not None else 'n/a')
print('color coefficients:', coeffs)
