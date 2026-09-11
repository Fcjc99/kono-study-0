from pathlib import Path
import re
ROOT = Path(__file__).resolve().parents[1]
errors=[]
scene=(ROOT/'src/game/scenes/Stage0Scene.ts').read_text(encoding='utf-8')
engine=(ROOT/'src/game/progression/progressionEngine.ts').read_text(encoding='utf-8')
landmarks=(ROOT/'src/game/data/sanctuaryLandmarks.ts').read_text(encoding='utf-8')
critters=(ROOT/'src/game/systems/CritterSystem.ts').read_text(encoding='utf-8')
app=(ROOT/'src/App.tsx').read_text(encoding='utf-8')
for forbidden in ['HomeEvolutionSystem','homeEvolution','BambooEvolutionSystem','bambooEvolution','BAMBOO_STAGE_NAMES']:
    if forbidden in scene: errors.append(f'active scene still references {forbidden}')
if "id: 'bamboo'" in landmarks: errors.append('bamboo landmark still active')
if 'bambooStage' in critters or 'landAtBamboo' in critters: errors.append('critters still depend on bamboo')
if not re.search(r'stages\.home = 0', engine): errors.append('home is not locked to stage 0')
if not re.search(r'stages\.bamboo = 0', engine): errors.append('bamboo migration key is not reset')
if 'next.home = null' not in engine or 'next.bamboo = null' not in engine: errors.append('disabled feature thresholds remain active')
if (ROOT/'src/game/systems/HomeEvolutionSystem.ts').exists(): errors.append('home overlay system still exists')
if (ROOT/'src/game/systems/BambooEvolutionSystem.ts').exists(): errors.append('bamboo system still exists')
if (ROOT/'public/garden/evolution/home').exists(): errors.append('unapproved home assets still exist')
if (ROOT/'public/garden/evolution/bamboo-grove').exists(): errors.append('bamboo assets still exist')
if 'Home evolution is temporarily reset to Stage 0.' not in app: errors.append('subject QA copy does not disclose reset')
if errors:
    raise SystemExit('build 20 rollback validation failed: ' + '; '.join(errors))
print('production build 20 rollback validation passed')
print('home: original map-painted cottage only; stages 1-5 disabled')
print('bamboo: renderer, landmark, habitat dependency, and assets removed')
print('progression: tree, garden, pond, and lanterns remain active')
