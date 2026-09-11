from __future__ import annotations

import json
import re
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
errors: list[str] = []

required_files = [
    ROOT / 'src/game/systems/GardenEvolutionSystem.ts',
    ROOT / 'src/game/systems/CritterSystem.ts',
    ROOT / 'src/game/scenes/Stage0Scene.ts',
    ROOT / 'src/game/progression/progressionEngine.ts',
    ROOT / 'src/game/data/sanctuaryLandmarks.ts',
]
for path in required_files:
    if not path.exists():
        errors.append(f'missing {path.relative_to(ROOT)}')

engine = (ROOT / 'src/game/progression/progressionEngine.ts').read_text(encoding='utf-8')
match = re.search(r'GARDEN_STAGE_THRESHOLDS\s*=\s*\[([^\]]+)\]', engine)
if not match:
    errors.append('garden thresholds missing')
else:
    values = [int(value.strip()) for value in match.group(1).split(',') if value.strip()]
    if values != [0, 4, 10, 18, 30, 45]:
        errors.append(f'unexpected garden thresholds: {values}')

scene = (ROOT / 'src/game/scenes/Stage0Scene.ts').read_text(encoding='utf-8')
for token in [
    'GardenEvolutionSystem.preload(this)',
    'CritterSystem.preload(this)',
    'this.gardenEvolution.update',
    'this.critters.update',
    'this.gardenEvolution.resize',
    'this.critters.resize',
    'this.critters?.setStages',
]:
    if token not in scene:
        errors.append(f'missing scene integration: {token}')

garden = (ROOT / 'src/game/systems/GardenEvolutionSystem.ts').read_text(encoding='utf-8')
if 'GARDEN_STAGE_NAMES' not in garden or 'GARDEN_ANCHORS' not in garden:
    errors.append('garden system lacks staged anchors')
if 'environment.phase' not in garden or 'tintForEnvironment' not in garden:
    errors.append('garden phase integration missing')

critters = (ROOT / 'src/game/systems/CritterSystem.ts').read_text(encoding='utf-8')
for name in ['butterfly', 'dragonfly', 'frog', 'bird', 'moth']:
    if f"'{name}'" not in critters:
        errors.append(f'critter behavior missing: {name}')
for token in ['environment.precipitation', 'setReducedMotion', 'setDensity', 'setStages']:
    if token not in critters:
        errors.append(f'critter safeguard missing: {token}')

assets = [
    'butterfly-01.png', 'butterfly-02.png', 'dragonfly-01.png',
    'frog-01.png', 'frog-02.png', 'bird-01.png', 'bird-02.png', 'moth-01.png',
]
for name in assets:
    path = ROOT / 'public/garden/critters' / name
    if not path.exists():
        errors.append(f'missing critter asset: {name}')
        continue
    image = Image.open(path).convert('RGBA')
    if image.getchannel('A').getextrema()[0] != 0:
        errors.append(f'critter asset lacks transparency: {name}')

landmarks = (ROOT / 'src/game/data/sanctuaryLandmarks.ts').read_text(encoding='utf-8')
if "id: 'garden'" not in landmarks:
    errors.append('garden landmark missing')

package = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))
if package.get('version') not in {'0.99.16-production-20.6', '0.99.17-production-20.7', '0.99.18-production-20.7.1', '0.99.19-production-20.8', '0.99.20-production-20.8.1', '0.99.21-production-20.8.2', '0.99.22-production-20.9', '0.99.23-production-21.0', '0.99.24-production-21.1', '0.99.25-production-21.3', '0.99.26-production-21.4', '0.99.27-production-21.5', '0.99.28-production-21.6', '0.99.29-production-21.7', '0.99.30-production-21.8', '0.99.31-production-21.9', '0.99.32-production-22.0', '0.99.33-production-22.1'}:
    errors.append(f"package version mismatch: {package.get('version')}")

if errors:
    print('\n'.join(f'ERROR: {error}' for error in errors))
    raise SystemExit(1)

print('garden and critter foundation validation passed')
print('garden thresholds: 0, 4, 10, 18, 30, 45 task credits')
print('garden anchors: house, tree, pond, terrace, bridge, coastline')
print('critters: butterfly, dragonfly, frog, bird, moth')
print('weather, reduced-motion, density, and quality safeguards: present')
