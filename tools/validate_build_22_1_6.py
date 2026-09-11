from pathlib import Path
from PIL import Image
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
# terrace runtime should not add glow/emissive overlays
text=(ROOT/'src/game/systems/LanternEvolutionSystem.ts').read_text()
assert 'const ACTIVE_LIGHT_COUNTS = [0, 0, 0, 0, 0, 0] as const' in text
assert '.setAlpha(0)' in text
# emissive images should be blank at night/evening stage5
for phase in ['evening','night']:
    arr=np.array(Image.open(ROOT/f'public/garden/evolution/lanterns/emissive/{phase}-stage-5.png').convert('RGBA'))
    assert arr[:,:,3].sum() == 0, f'{phase} emissive not blank'
print('Build 22.1.6 validation passed.')
