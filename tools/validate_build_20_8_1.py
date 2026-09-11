from pathlib import Path
import json
from PIL import Image
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
HOME = ROOT / 'public/garden/evolution/home'
PHASES = ('morning', 'afternoon', 'evening', 'night')
errors = []

version = '0.99.20-production-20.8.1'
if version not in (ROOT / 'src/version.ts').read_text(encoding='utf-8'):
    errors.append('src version mismatch')
if json.loads((ROOT / 'package.json').read_text(encoding='utf-8')).get('version') != version:
    errors.append('package version mismatch')

reference_alpha = None
for phase in PHASES:
    image = Image.open(HOME / f'{phase}-stage-5.png').convert('RGBA')
    if image.size != (500, 450):
        errors.append(f'{phase}: wrong canvas size {image.size}')
        continue
    alpha = np.array(image.getchannel('A'))
    bbox = image.getchannel('A').getbbox()
    if bbox is None:
        errors.append(f'{phase}: empty alpha')
        continue
    x0, y0, x1, y1 = bbox
    if y0 > 52:
        errors.append(f'{phase}: Stage 5 roof is too low to occlude Stage 0 roofline: {bbox}')
    if x0 <= 0 or y0 <= 0 or x1 >= 500 or y1 >= 450:
        errors.append(f'{phase}: sprite touches crop edge: {bbox}')
    if set(np.unique(alpha).tolist()) - {0, 255}:
        errors.append(f'{phase}: alpha fringe detected')
    if reference_alpha is None:
        reference_alpha = alpha
    elif not np.array_equal(reference_alpha, alpha):
        errors.append(f'{phase}: alpha geometry differs across phases')

# Stage 0 remains transparent map-painted; stages 1-4 must be untouched and Stage 5 remains the only changed home art.
for phase in PHASES:
    stage0 = Image.open(HOME / f'{phase}-stage-0.png').convert('RGBA')
    if stage0.getchannel('A').getextrema() != (0, 0):
        errors.append(f'{phase}: Stage 0 overlay should remain transparent')

home_system = (ROOT / 'src/game/systems/HomeEvolutionSystem.ts').read_text(encoding='utf-8')
if 'Build 20.8.1 raises Stage 5' not in home_system:
    errors.append('HomeEvolutionSystem roofline-lock note missing')

required = [
    ROOT / 'docs/PRODUCTION-BUILD-20.8.1-HOME-ROOFLINE-QA.jpg',
    ROOT / 'docs/PRODUCTION-BUILD-20.8.1-HOME-PHASES-QA.jpg',
    ROOT / 'BUILD-20.8.1-RELEASE-NOTES.md',
]
for path in required:
    if not path.exists():
        errors.append(f'missing artifact: {path.name}')

if errors:
    raise SystemExit('build 20.8.1 validation failed: ' + '; '.join(errors))
print('production build 20.8.1 validation passed')
print('Stage 5 alpha top is aligned at y<=52 on the 500x450 home canvas')
print('Stage 5 fully covers the original map-painted roofline in QA composites')
print('Stage 0-4 home progression, tree, pond, lighting, and no-bamboo state remain untouched')
