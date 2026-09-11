from pathlib import Path
from PIL import Image
import hashlib
import numpy as np
import cv2

ROOT = Path(__file__).resolve().parents[1]
PHASES = ['morning', 'afternoon', 'evening', 'night']
MAPS = ROOT / 'public/garden/islands/terrace-evolution'
BASE = ROOT / 'public/garden/islands/stage-0'
WORLD = (1448, 1086)
# Union of all clean terrace stages. Outside this box the runtime map must be
# byte-identical to the native Sanctuary phase map.
TERRACE_BOX = (930, 245, 1275, 570)
SHARPNESS_MIN = {
    'morning': 1600.0,
    'afternoon': 2800.0,
    'evening': 2400.0,
    'night': 540.0,
}
errors = []
hashes = set()

for phase in PHASES:
    base_path = BASE / f'stage0-{phase}.png'
    if not base_path.exists():
        errors.append(f'missing native base map {base_path.relative_to(ROOT)}')
        continue
    base = np.array(Image.open(base_path).convert('RGB'))
    if base.shape[:2] != (WORLD[1], WORLD[0]):
        errors.append(f'wrong native base dimensions for {phase}: {base.shape[1]}x{base.shape[0]}')

    for stage in range(6):
        path = MAPS / phase / f'stage-{stage}.png'
        if not path.exists():
            errors.append(f'missing runtime map {path.relative_to(ROOT)}')
            continue
        im = Image.open(path)
        if im.size != WORLD:
            errors.append(f'wrong dimensions {phase} stage {stage}: {im.size}')
        if im.mode != 'RGB':
            errors.append(f'{phase} stage {stage} must be an opaque RGB full map, found {im.mode}')
        rgb = np.array(im.convert('RGB'))
        hashes.add(hashlib.sha256(path.read_bytes()).hexdigest())

        x0, y0, x1, y1 = TERRACE_BOX
        outside = np.ones(rgb.shape[:2], dtype=bool)
        outside[y0:y1, x0:x1] = False
        leaked = np.any(rgb != base, axis=2) & outside
        if leaked.any():
            errors.append(f'{phase} stage {stage} changes {int(leaked.sum())} pixels outside locked terrace zone')

        # Full-map pipeline must contain an actual authored terrace state.
        changed_inside = np.any(rgb[y0:y1, x0:x1] != base[y0:y1, x0:x1], axis=2)
        if int(changed_inside.sum()) < 5000:
            errors.append(f'{phase} stage {stage} terrace region is unexpectedly empty')

# 24 unique opaque runtime maps.
if len(hashes) != 24:
    errors.append(f'expected 24 unique runtime map files, found {len(hashes)} unique hashes')

# Stage 5 must retain the crisp full-map source rather than the later soft
# difference-sprite reconstruction. Measured on the locked terrace region.
x0, y0, x1, y1 = TERRACE_BOX
for phase, threshold in SHARPNESS_MIN.items():
    path = MAPS / phase / 'stage-5.png'
    if not path.exists():
        continue
    arr = np.array(Image.open(path).convert('RGB'))[y0:y1, x0:x1]
    gray = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)
    score = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    if score < threshold:
        errors.append(f'{phase} stage 5 sharpness too low: {score:.1f} < {threshold:.1f}')

scene = (ROOT / 'src/game/scenes/Stage0Scene.ts').read_text(encoding='utf-8')
lighting = (ROOT / 'src/game/systems/LightingSystem.ts').read_text(encoding='utf-8')
lantern = (ROOT / 'src/game/systems/LanternEvolutionSystem.ts').read_text(encoding='utf-8')

required_scene = [
    '/garden/islands/terrace-evolution/${phase}/stage-${stage}.png',
    'direct FULL-MAP texture swap only',
]
for token in required_scene:
    if token not in scene:
        errors.append(f'missing full-map runtime lock token: {token}')

for forbidden in [
    "/garden/evolution/lanterns/phases/",
    "this.load.image('stage0-morning'",
    "this.load.image('stage0-afternoon'",
    "this.load.image('stage0-evening'",
    "this.load.image('stage0-night'",
    'phaseSwapVeil',
]:
    if forbidden in scene:
        errors.append(f'forbidden legacy terrace/background path remains in Stage0Scene: {forbidden}')

# Lighting system may expose state to water/weather/ambience, but it may not
# create or tint visible Phaser objects.
for forbidden in ['this.scene.add', '.setTint(', '.setBlendMode(', 'BlendModes.', 'fillRect(', 'createCanvas']:
    if forbidden in lighting:
        errors.append(f'LightingSystem renders visible lighting: {forbidden}')

# Lantern evolution runtime owns progression metadata only. No second terrace
# visual can be rendered on top of the full map.
for forbidden in ['.add.image(', '.add.sprite(', '.load.image(', '.setTint(', '.setAlpha(']:
    if forbidden in lantern:
        errors.append(f'LanternEvolutionSystem still renders a terrace object: {forbidden}')

if errors:
    print('FAIL — KONO 22.7.21 TERRACE CRISP NATIVE PIPELINE')
    for error in errors:
        print(' -', error)
    raise SystemExit(1)

print('PASS — KONO 22.7.21 TERRACE CRISP NATIVE PIPELINE')
print('24 opaque 1448x1086 full-map terrace states validated.')
print('All non-terrace pixels are identical to the native Sanctuary phase maps.')
print('Runtime uses direct full-map swapping only; no terrace sprite/tint/glow overlay path exists.')
print('Stage 5 crispness thresholds pass in Morning / Afternoon / Evening / Night.')
