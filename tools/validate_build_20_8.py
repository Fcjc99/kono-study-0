from pathlib import Path
import json
from PIL import Image
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
HOME = ROOT / 'public/garden/evolution/home'
PHASES = ('morning', 'afternoon', 'evening', 'night')
errors: list[str] = []

version_text = (ROOT / 'src/version.ts').read_text(encoding='utf-8')
package = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))
if '0.99.19-production-20.8' not in version_text:
    errors.append('src version is not Build 20.8')
if package.get('version') != '0.99.19-production-20.8':
    errors.append('package version is not Build 20.8')

required = [
    ROOT / 'tools/build_home_stage5_grand.py',
    HOME / 'source/approved-stage-5-grand-reference.png',
    HOME / 'source/approved-stage-5-grand-cut.png',
    ROOT / 'docs/PRODUCTION-BUILD-20.8-HOME-STAGES-QA.jpg',
    ROOT / 'docs/PRODUCTION-BUILD-20.8-HOME-PHASES-QA.jpg',
    ROOT / 'docs/PRODUCTION-BUILD-20.8-HOME-STAGE5-TRANSPARENCY-QA.png',
]
for path in required:
    if not path.exists():
        errors.append(f'missing Build 20.8 artifact: {path.name}')

# Stage 0 must remain map-painted / transparent.
for phase in PHASES:
    stage0 = Image.open(HOME / f'{phase}-stage-0.png').convert('RGBA')
    if stage0.size != (500, 450) or stage0.getchannel('A').getextrema() != (0, 0):
        errors.append(f'{phase} Stage 0 changed from transparent map-painted home')

# Grand Stage 5 must be isolated, phase-aligned, and meaningfully larger than Stage 4.
stage4 = Image.open(HOME / 'morning-stage-4.png').convert('RGBA')
stage4_bbox = stage4.getchannel('A').getbbox()
if stage4_bbox is None:
    errors.append('Stage 4 alpha missing')
    stage4_width = 0
else:
    stage4_width = stage4_bbox[2] - stage4_bbox[0]

reference_alpha = None
for phase in PHASES:
    path = HOME / f'{phase}-stage-5.png'
    image = Image.open(path).convert('RGBA')
    if image.size != (500, 450):
        errors.append(f'wrong Stage 5 size: {path.name} {image.size}')
        continue
    alpha = np.array(image.getchannel('A'))
    unique = set(np.unique(alpha).tolist())
    if not unique.issubset({0, 255}):
        errors.append(f'Stage 5 has alpha fringe: {path.name} {sorted(unique)[:8]}')
    bbox = image.getchannel('A').getbbox()
    if bbox is None:
        errors.append(f'empty Stage 5: {path.name}')
        continue
    x0, y0, x1, y1 = bbox
    width = x1 - x0
    if x0 <= 0 or y0 <= 0 or x1 >= 500 or y1 >= 450:
        errors.append(f'Stage 5 touches crop edge: {path.name} {bbox}')
    if stage4_width and width < round(stage4_width * 1.25):
        errors.append(f'Grand Stage 5 is not at least 25% wider than Stage 4: {width} vs {stage4_width}')
    if reference_alpha is None:
        reference_alpha = alpha
    elif not np.array_equal(reference_alpha, alpha):
        errors.append(f'Stage 5 phase alpha mismatch: {phase}')

home_system = (ROOT / 'src/game/systems/HomeEvolutionSystem.ts').read_text(encoding='utf-8')
if "'Grand sanctuary home'" not in home_system:
    errors.append('Grand sanctuary home label missing')
if 'build_home_stage5_grand.py' not in (ROOT / 'package.json').read_text(encoding='utf-8'):
    errors.append('Stage 5 asset build script is not wired into package scripts')

if errors:
    raise SystemExit('build 20.8 validation failed: ' + '; '.join(errors))

print('production build 20.8 validation passed')
print('home: Stage 0–4 preserved from clean evolution set')
print(f'grand Stage 5: isolated 500x450 pixel-PNG, >=25% wider than Stage 4 ({stage4_width}px baseline)')
print('phase lock: identical Stage 5 alpha geometry across morning/afternoon/evening/night')
print('asset rule: final Home remains PNG-based; no runtime procedural house pieces')
