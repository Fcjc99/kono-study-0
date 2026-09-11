
from pathlib import Path
from PIL import Image
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
KONO=ROOT/'public/garden/kono'
required=['idle.png','happy.png','excited.png','question.png','sleep.png','tea.png','read.png',
          'walk-down-01.png','walk-down-02.png','walk-up-01.png','walk-up-02.png',
          'walk-left-01.png','walk-left-02.png','walk-right-01.png','walk-right-02.png']
for name in required:
    p=KONO/name
    assert p.exists(), f'missing {name}'
    a=np.array(Image.open(p).convert('RGBA'))
    assert a[:,:,3].sum()>0, f'empty {name}'
    transparent=a[:,:,3]==0
    assert not np.any(a[:,:,:3][transparent]!=0), f'dirty transparent RGB {name}'
ts=(ROOT/'src/game/systems/KonoMascotSystem.ts').read_text()
for key in ['kono-tea','kono-read','kono-excited']:
    assert key in ts, f'missing reaction {key}'
assert 'this.bounds.height * 0.060 * perspective' in ts, 'KONO scale lock missing'
print('Build 22.4.1 validation passed.')
