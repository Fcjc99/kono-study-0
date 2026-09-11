from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
errors: list[str] = []
version = (ROOT / 'src/version.ts').read_text(encoding='utf-8')
package = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))
scene = (ROOT / 'src/game/scenes/Stage0Scene.ts').read_text(encoding='utf-8')
home = (ROOT / 'src/game/systems/HomeEvolutionSystem.ts').read_text(encoding='utf-8')
progression = (ROOT / 'src/game/progression/progressionEngine.ts').read_text(encoding='utf-8')

if 'production-20.7' not in version or 'production-20.7' not in package.get('version', ''):
    errors.append('20.7 version metadata missing')
if 'HomeEvolutionSystem.preload(this)' not in scene:
    errors.append('Home evolution not preloaded')
if 'HOME_STAGE_THRESHOLDS = [0, 5, 12, 20, 30, 40]' not in progression:
    errors.append('Home thresholds missing')
if 'complete pre-rendered PNG replacement patches' not in home:
    errors.append('PNG replacement-patch contract missing')
if (ROOT / 'src/game/systems/BambooEvolutionSystem.ts').exists():
    errors.append('bamboo system was reintroduced')
if (ROOT / 'public/garden/evolution/bamboo-grove').exists():
    errors.append('bamboo assets were reintroduced')

if errors:
    raise SystemExit('build 20.7 validation failed: ' + '; '.join(errors))
print('production build 20.7 validation passed')
print('home: six-stage full PNG replacement evolution active')
print('bamboo: remains removed')
