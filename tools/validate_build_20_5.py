from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
errors: list[str] = []

tree = (ROOT / 'src/game/systems/TreeEvolutionSystem.ts').read_text(encoding='utf-8')
landmarks = (ROOT / 'src/game/data/sanctuaryLandmarks.ts').read_text(encoding='utf-8')
coordinator = (ROOT / 'src/game/evolution/EvolutionCoordinator.ts').read_text(encoding='utf-8')
version = (ROOT / 'src/version.ts').read_text(encoding='utf-8')
package = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))

for token in [
    'TREE_ANCHOR_X = 704',
    'TREE_GROUND_Y = 314',
    'TEXTURE_HEIGHT = 650',
    'TREE_ORIGIN_Y = CONTENT_BOTTOM_Y / TEXTURE_HEIGHT',
    'ASSET_WIDTH = 410',
    'ASSET_HEIGHT = 430',
]:
    if token not in tree:
        errors.append(f'missing tree center token: {token}')
if 'x: 0.486' not in landmarks or 'y: 0.289' not in landmarks:
    errors.append('tree landmark does not follow the plateau center')
if "tree: { x: 704, y: 314" not in coordinator:
    errors.append('tree milestone accent does not follow the plateau center')
if 'production-20.5' not in version or 'production-20.5' not in package.get('version', ''):
    errors.append('20.5 version metadata missing')
if (ROOT / 'src/game/systems/BambooEvolutionSystem.ts').exists():
    errors.append('bamboo system was reintroduced')
if (ROOT / 'public/garden/evolution/bamboo-grove').exists():
    errors.append('bamboo assets were reintroduced')

if errors:
    raise SystemExit('build 20.5 validation failed: ' + '; '.join(errors))
print('production build 20.5 validation passed')
print('tree: exact user-marked upper-platform center x=704, y=314')
print('origin: source-relative 624/650 registration')
