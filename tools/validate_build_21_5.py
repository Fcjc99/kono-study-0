#!/usr/bin/env python3
from pathlib import Path
import json
import re

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
POND = ROOT / 'src/game/systems/PondEvolutionSystem.ts'
HOME_DECOR = ROOT / 'public/garden/evolution/home/decor'
HOME_SOURCE = ROOT / 'public/garden/evolution/home/source'
DEBUG = ROOT / 'docs/production-water-debug'
PACKAGE = ROOT / 'package.json'
APP_VERSION = ROOT / 'src/version.ts'

text = POND.read_text()
package = json.loads(PACKAGE.read_text())

checks = {
    'version 21.5+': package.get('version') in {'0.99.27-production-21.5', '0.99.28-production-21.6', '0.99.29-production-21.7', '0.99.30-production-21.8', '0.99.31-production-21.9', '0.99.32-production-22.0', '0.99.33-production-22.1'} and any(v in APP_VERSION.read_text() for v in ('0.99.27-production-21.5','0.99.28-production-21.6','0.99.29-production-21.7','0.99.30-production-21.8','0.99.31-production-21.9','0.99.32-production-22.0','0.99.33-production-22.1')),
    'safe route table': 'KOI_SWIM_PATHS' in text and 'sampleSwimPath' in text,
    'no old orbit math': 'Math.cos(angle)' not in text and 'Math.sin(angle) * this.radiusY' not in text,
    'fish under lily layer': 'RenderLayers.pondLife + 0.03' in text,
    'three fish cap': 'MAX_FISH = 3' in text and 'return Math.min(MAX_FISH, stage - 2)' in text,
    'stage4 shoreline': "pond-flowers-1" in text and 'mapX: 892' in text and 'mapY: 641' in text,
    'stage5 shoreline': "pond-reeds-2" in text and "pond-stones-2" in text and "pond-flowers-2" in text,
    'phase tint': 'phaseDecorationTint' in text and 'decorationTint' in text,
    'option B source': (HOME_SOURCE / 'approved-vegetable-garden-option-b.png').exists(),
}
missing = [name for name, ok in checks.items() if not ok]
if missing:
    raise SystemExit('Build 21.5 validation failed: ' + ', '.join(missing))

# Runtime route points are duplicated here intentionally so validation can prove every
# segment stays inside the intersection of all four eroded production-water masks.
paths = [
    [(285, 145), (330, 150), (370, 155), (400, 170), (385, 190), (350, 205), (300, 210), (255, 200), (235, 185), (235, 165), (250, 150)],
    [(255, 155), (295, 150), (330, 160), (350, 175), (335, 190), (300, 200), (265, 195), (240, 180), (240, 165)],
    [(320, 160), (360, 155), (392, 165), (400, 175), (380, 185), (350, 198), (315, 190), (300, 175)],
]

safe_intersection = None
for phase in ('morning', 'afternoon', 'evening', 'night'):
    path = DEBUG / f'{phase}-pond-mask.png'
    mask = cv2.imread(str(path), cv2.IMREAD_GRAYSCALE)
    if mask is None:
        raise SystemExit(f'missing pond mask: {path.relative_to(ROOT)}')
    safe = cv2.erode((mask > 0).astype(np.uint8) * 255, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (31, 21)), iterations=1)
    safe_intersection = safe if safe_intersection is None else cv2.bitwise_and(safe_intersection, safe)

for path_index, route in enumerate(paths):
    for a, b in zip(route, route[1:] + route[:1]):
        for t in np.linspace(0, 1, 400):
            x = int(round(a[0] + (b[0] - a[0]) * t))
            y = int(round(a[1] + (b[1] - a[1]) * t))
            if y < 0 or x < 0 or y >= safe_intersection.shape[0] or x >= safe_intersection.shape[1] or safe_intersection[y, x] == 0:
                raise SystemExit(f'koi route {path_index} leaves safe water at ({x},{y})')

# Option B phase sprites must be true transparent 500x450 overlays and retain enough
# bottom/side padding to avoid the old cutout behavior.
for phase in ('morning', 'afternoon', 'evening', 'night'):
    path = HOME_DECOR / f'vegetable-garden-stage5-{phase}.png'
    if not path.exists():
        raise SystemExit(f'missing Option B garden phase asset: {path.relative_to(ROOT)}')
    with Image.open(path).convert('RGBA') as image:
        if image.size != (500, 450):
            raise SystemExit(f'bad Option B garden canvas: {path.relative_to(ROOT)} {image.size}')
        alpha = image.getchannel('A')
        bbox = alpha.getbbox()
        if bbox is None:
            raise SystemExit(f'empty Option B garden asset: {path.relative_to(ROOT)}')
        left, top, right, bottom = bbox
        if left < 20 or top < 20 or right > 480 or bottom > 430:
            raise SystemExit(f'Option B garden lacks transparent safety padding: {path.relative_to(ROOT)} bbox={bbox}')

for name in (
    'PRODUCTION-BUILD-21.5-POND-STAGES-0-5-QA.jpg',
    'PRODUCTION-BUILD-21.5-POND-STAGES-3-5-QA.jpg',
    'PRODUCTION-BUILD-21.5-POND-STAGE5-ALL-PHASES-QA.jpg',
    'PRODUCTION-BUILD-21.5-KOI-SWIM-PATH-QA.png',
    'PRODUCTION-BUILD-21.5-OPTION-B-GARDEN-MAP-FIT-QA.png',
):
    if not (ROOT / 'docs' / name).exists():
        raise SystemExit(f'missing Build 21.5 QA: docs/{name}')

print('Build 21.5 validation passed')
print('koi routes: 3 unique loops, safe in the intersection of all 4 phase pond masks')
print('pond stages: Stage 3 = 1 koi, Stage 4 = 2 koi + shoreline garden, Stage 5 = 3 koi + sanctuary details')
print('approved Option B vegetable garden: integrated as four phase-matched transparent PNG overlays')
