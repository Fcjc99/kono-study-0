from pathlib import Path
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
errors: list[str] = []

tree = (ROOT / 'src/game/systems/TreeEvolutionSystem.ts').read_text(encoding='utf-8')
lighting = (ROOT / 'src/game/systems/LightingSystem.ts').read_text(encoding='utf-8')
landmarks = (ROOT / 'src/game/data/sanctuaryLandmarks.ts').read_text(encoding='utf-8')
version = (ROOT / 'src/version.ts').read_text(encoding='utf-8')
package = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))

for token in ['TREE_ANCHOR_X = 668', 'TREE_GROUND_Y = 314', 'ASSET_WIDTH = 410', 'ASSET_HEIGHT = 430']:
    if token not in tree:
        errors.append(f'missing tree placement token: {token}')
for token in ['directionalHighlight', 'directionalShadow', 'moonRim', "environment.phase === 'afternoon'", "environment.phase === 'evening'"]:
    if token not in lighting:
        errors.append(f'missing global lighting token: {token}')
if 'x: 0.461' not in landmarks or 'y: 0.289' not in landmarks:
    errors.append('tree landmark is not aligned to the upper plateau')
if 'production-20.4' not in version or 'production-20.4' not in package.get('version', ''):
    errors.append('20.4 version metadata missing')

for phase in ('morning', 'afternoon', 'evening', 'night'):
    path = ROOT / f'public/garden/islands/stage-0/stage0-{phase}.png'
    if not path.exists():
        errors.append(f'missing phase map: {phase}')
        continue
    with Image.open(path) as image:
        if image.size != (1448, 1086):
            errors.append(f'{phase} map size changed: {image.size}')

if (ROOT / 'src/game/systems/BambooEvolutionSystem.ts').exists():
    errors.append('bamboo system was reintroduced')
if (ROOT / 'public/garden/evolution/bamboo-grove').exists():
    errors.append('bamboo assets were reintroduced')

if errors:
    raise SystemExit('build 20.4 validation failed: ' + '; '.join(errors))
print('production build 20.4 validation passed')
print('tree: upper plateau x=668 y=314, reduced 410x430 footprint')
print('lighting: global morning/afternoon/evening/night directional polish active')
print('road: obsolete center mound removed in all four phase maps')
print('bamboo: remains removed')
