from pathlib import Path
from PIL import Image
import sys
root=Path(__file__).resolve().parents[1]
errors=[]
for phase in ['morning','afternoon','evening','night']:
  for stage in range(6):
    p=root/'public/garden/islands/terrace-evolution'/phase/f'stage-{stage}.png'
    if not p.exists(): errors.append(f'missing {p.relative_to(root)}'); continue
    if Image.open(p).size!=(1448,1086): errors.append(f'bad size {p.relative_to(root)}')
scene=(root/'src/game/scenes/Stage0Scene.ts').read_text(); lantern=(root/'src/game/systems/LanternEvolutionSystem.ts').read_text()
if 'terraceMapTextureKey' not in scene: errors.append('Stage0Scene missing terrace map keys')
if '.add.image' in lantern or 'terraceSprite' in lantern: errors.append('runtime terrace sprite still present')
if errors:
 print('Build 22.7.12 validation FAILED'); [print('-',e) for e in errors]; sys.exit(1)
print('Build 22.7.12 validation PASSED: 24 full Sanctuary terrace maps and no runtime terrace sprite.')
