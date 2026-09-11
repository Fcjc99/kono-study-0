from pathlib import Path
from PIL import Image
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
MAPS = ROOT / 'public/garden/islands/terrace-evolution'
SRC = ROOT / 'public/garden/evolution/lanterns/source'
WORLD = (1448, 1086)
PHASES = ('morning', 'afternoon', 'evening', 'night')
OFFSET = (900, 250)
errors = []

ownership_path = SRC / 'stage0-native-structure-ownership-mask-22.7.25.png'
if not ownership_path.exists():
    errors.append('missing 22.7.25 native structure ownership mask')
    ownership = None
else:
    ownership = np.array(Image.open(ownership_path).convert('L')) > 0
    if ownership.shape != (360, 430):
        errors.append(f'ownership mask wrong size: {ownership.shape[::-1]}')

full_allowed = np.zeros((WORLD[1], WORLD[0]), dtype=bool)
if ownership is not None:
    y0, x0 = OFFSET[1], OFFSET[0]
    full_allowed[y0:y0+ownership.shape[0], x0:x0+ownership.shape[1]] = ownership

for phase in PHASES:
    base_path = MAPS / phase / 'stage-0.png'
    if not base_path.exists():
        errors.append(f'missing {phase} stage 0')
        continue
    base_im = Image.open(base_path).convert('RGBA')
    if base_im.size != WORLD:
        errors.append(f'wrong size {phase} stage 0: {base_im.size}')
    base = np.array(base_im)
    if np.any(base[:, :, 3] != 255):
        errors.append(f'{phase} stage 0 contains non-opaque pixels')

    for stage in range(6):
        p = MAPS / phase / f'stage-{stage}.png'
        if not p.exists():
            errors.append(f'missing {phase} stage {stage}')
            continue
        im = Image.open(p).convert('RGBA')
        if im.size != WORLD:
            errors.append(f'wrong size {phase} stage {stage}: {im.size}')
            continue
        arr = np.array(im)
        if np.any(arr[:, :, 3] != 255):
            errors.append(f'{phase} stage {stage}: non-opaque pixels found')
        if stage > 0:
            changed = np.any(arr[:, :, :3] != base[:, :, :3], axis=2)
            leaked = changed & ~full_allowed
            if leaked.any():
                errors.append(f'{phase} stage {stage}: {int(leaked.sum())} changed pixels outside locked native structure footprint')
            # A stage must actually contain a terrace evolution and not silently fall back to Stage 0.
            inside_changes = int((changed & full_allowed).sum())
            if inside_changes < 250:
                errors.append(f'{phase} stage {stage}: too few terrace changes ({inside_changes})')

# The four Stage 0 maps are the permanent phase terrain bases and must remain present.
for phase in PHASES:
    if not (MAPS / phase / 'stage-0.png').exists():
        errors.append(f'permanent Stage 0 base missing for {phase}')

# Runtime architecture lock: full-map-only, with no dedicated terrace overlay/recolor path.
scene = (ROOT / 'src/game/scenes/Stage0Scene.ts').read_text(encoding='utf-8')
lighting = (ROOT / 'src/game/systems/LightingSystem.ts').read_text(encoding='utf-8')
lantern = (ROOT / 'src/game/systems/LanternEvolutionSystem.ts').read_text(encoding='utf-8')
if '/garden/islands/terrace-evolution/${phase}/stage-${stage}.png' not in scene:
    errors.append('missing full-map terrace texture path')
for token in ['/garden/evolution/lanterns/phases/', 'phaseSwapVeil']:
    if token in scene:
        errors.append(f'legacy terrace overlay path in scene: {token}')
for token in ['this.scene.add', '.setTint(', '.setBlendMode(', 'BlendModes.', 'fillRect(', 'createCanvas']:
    if token in lighting:
        errors.append(f'LightingSystem renders visible lighting: {token}')
for token in ['.add.image(', '.add.sprite(', '.setTint(']:
    if token in lantern:
        errors.append(f'LanternEvolutionSystem renders terrace overlay object: {token}')

manifest = ROOT / 'docs/terrace-22.7.25-full-restart/rebuild-manifest.json'
if not manifest.exists():
    errors.append('missing 22.7.25 rebuild manifest')

if errors:
    print('FAIL — KONO 22.7.25 TERRACE FULL RESTART')
    for e in errors:
        print(' -', e)
    raise SystemExit(1)
print('PASS — KONO 22.7.25 TERRACE FULL RESTART')
print('24 opaque full-map states validated; outside native terrace/decor footprint is pixel-identical to each phase Stage 0; no terrace runtime overlay/recolor path detected.')
