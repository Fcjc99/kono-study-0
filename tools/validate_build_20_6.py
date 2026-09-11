from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
errors: list[str] = []

tree = (ROOT / 'src/game/systems/TreeEvolutionSystem.ts').read_text(encoding='utf-8')
pond = (ROOT / 'src/game/systems/PondEvolutionSystem.ts').read_text(encoding='utf-8')
landmarks = (ROOT / 'src/game/data/sanctuaryLandmarks.ts').read_text(encoding='utf-8')
coordinator = (ROOT / 'src/game/evolution/EvolutionCoordinator.ts').read_text(encoding='utf-8')
scene = (ROOT / 'src/game/scenes/Stage0Scene.ts').read_text(encoding='utf-8')
version = (ROOT / 'src/version.ts').read_text(encoding='utf-8')
package = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))

for token in [
    'TREE_ANCHOR_X = 704',
    'TREE_GROUND_Y = 272',
    'TEXTURE_HEIGHT = 650',
    'TREE_ORIGIN_Y = CONTENT_BOTTOM_Y / TEXTURE_HEIGHT',
    'ASSET_WIDTH = 410',
    'ASSET_HEIGHT = 430',
]:
    if token not in tree:
        errors.append(f'missing tree height-lock token: {token}')
if 'x: 0.486' not in landmarks or 'y: 0.250' not in landmarks:
    errors.append('tree landmark does not follow raised plateau position')
if "tree: { x: 704, y: 272" not in coordinator:
    errors.append('tree milestone accent does not follow raised plateau position')
if 'PondEvolutionSystem.preload(this)' not in scene:
    errors.append('pond pixel assets are not preloaded')
if 'scene.make.graphics' in pond or 'generateTexture' in pond:
    errors.append('pond system still contains procedural shape stand-ins')
if 'KOI_DIRECTIONS = 8' not in pond or 'KOI_FRAMES = 2' not in pond:
    errors.append('koi sprite direction/frame system missing')
if not any(tag in version and tag in package.get('version', '') for tag in ('production-20.6', 'production-20.7')):
    errors.append('20.6+ version metadata missing')
if (ROOT / 'src/game/systems/BambooEvolutionSystem.ts').exists():
    errors.append('bamboo system was reintroduced')
if (ROOT / 'public/garden/evolution/bamboo-grove').exists():
    errors.append('bamboo assets were reintroduced')

if errors:
    raise SystemExit('build 20.6 validation failed: ' + '; '.join(errors))
print('production build 20.6 validation passed')
print('tree: x=704 locked, raised to y=272')
print('pond: PNG-only evolution with real pixel koi sprite frames')
