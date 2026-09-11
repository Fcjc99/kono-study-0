from __future__ import annotations
import json
import re
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'public/garden/evolution/cherry-tree'
PHASES = ('morning', 'afternoon', 'evening', 'night')
RUNTIME_SIZE = (620, 650)
errors: list[str] = []

for stage in range(6):
    source = ASSETS / 'source' / f'tree-level-{stage}.png'
    if not source.exists():
        errors.append(f'missing {source.relative_to(ROOT)}')

for legacy_base in ASSETS.glob('*-base.png'):
    errors.append(f'legacy mound cover still exists: {legacy_base.name}')

for phase in PHASES:
    for stage in range(6):
        path = ASSETS / f'{phase}-stage-{stage}.png'
        if not path.exists():
            errors.append(f'missing {path.relative_to(ROOT)}')
            continue
        image = Image.open(path).convert('RGBA')
        if image.size != RUNTIME_SIZE:
            errors.append(f'{path.name} has size {image.size}')
        if image.getchannel('A').getbbox() is None:
            errors.append(f'{path.name} is empty')

progression = (ROOT / 'src/game/progression/progressionEngine.ts').read_text()
types = (ROOT / 'src/game/progression/types.ts').read_text()
scene = (ROOT / 'src/game/scenes/Stage0Scene.ts').read_text()
system = (ROOT / 'src/game/systems/TreeEvolutionSystem.ts').read_text()
checks = {
    'schema version 7': 'SANCTUARY_PROGRESS_SCHEMA_VERSION = 7' in types,
    'tree feature persistence': 'featureStages.tree' in progression,
    'tree system': 'TreeEvolutionSystem' in scene,
    'tree update': 'this.evolution.update' in scene,
    'static anchored sprite': 'Math.sin' not in system,
    'registered tree anchor': 'TREE_ANCHOR_X = 648' in system and 'TREE_GROUND_Y = 523' in system,
    'persistent mature petals': 'spawnPersistentPetal' in system and 'this.stage < 4' in system,
    'phase-aware petals': 'phasePetalDelayMultiplier' in system,
    'phase-aware shadow': 'phaseShadowTint' in system,
    'no legacy cover': 'baseTextureKey' not in system,
    'ground shadow': 'SHADOW_TEXTURE_KEY' in system,
    'art lock': (ROOT / 'docs/EVOLUTION_ART_LOCK.md').exists(),
    'phase preview': (ROOT / 'docs/PRODUCTION-BUILD-15.3-TREE-PHASE-INTEGRATION.png').exists(),
    'low-light preview': (ROOT / 'docs/PRODUCTION-BUILD-15.3-TREE-LOW-LIGHT-DETAIL.png').exists(),
}
for label, passed in checks.items():
    if not passed:
        errors.append(f'missing {label}')
match = re.search(r'SANCTUARY_STAGE_THRESHOLDS\s*=\s*\[([^\]]+)\]', progression)
if not match or [int(value.strip()) for value in match.group(1).split(',') if value.strip()] != [0, 3, 8, 15, 25, 40]:
    errors.append('stage thresholds mismatch')
if json.loads((ROOT / 'package.json').read_text()).get('version') != '0.99.9-production-19.3':
    errors.append('package version mismatch')
if errors:
    print('\n'.join(f'ERROR: {error}' for error in errors))
    raise SystemExit(1)
print('tree evolution validation passed')
print('approved source sprites: 6')
print('runtime textures: 24 at 620x650')
print('registered anchor: 648, 523')
print('growth thresholds: 0, 3, 8, 15, 25, 40')
