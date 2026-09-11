
from pathlib import Path
from PIL import Image
import numpy as np
import re
ROOT=Path(__file__).resolve().parents[1]

def alpha(p):
    return np.array(Image.open(p).convert('RGBA'))[:,:,3] > 0

def clean_png(p):
    arr=np.array(Image.open(p).convert('RGBA'))
    transparent=arr[:,:,3]==0
    return not (transparent.any() and np.any(arr[:,:,:3][transparent] != 0))

def main():
    home=ROOT/'public/garden/evolution/home'
    stage0=alpha(home/'full-silhouette/afternoon-stage-0.png')
    for phase in ['morning','afternoon','evening','night']:
        for stage in range(1,6):
            p=home/f'{phase}-stage-{stage}.png'
            a=alpha(p)
            assert np.all(a[stage0]), f'{phase} home stage {stage} does not fully cover Stage 0'
            assert clean_png(p), f'dirty transparent pixels: {p}'

    # Evening should contain substantially more warm bright window pixels than night.
    for stage in range(1,6):
        eve=np.array(Image.open(home/f'evening-stage-{stage}.png').convert('RGBA')).astype(np.int16)
        night=np.array(Image.open(home/f'night-stage-{stage}.png').convert('RGBA')).astype(np.int16)
        warm_e=((eve[:,:,0]>140)&(eve[:,:,1]>95)&(eve[:,:,0]>eve[:,:,2]+40)&(eve[:,:,3]>0)).sum()
        warm_n=((night[:,:,0]>140)&(night[:,:,1]>95)&(night[:,:,0]>night[:,:,2]+40)&(night[:,:,3]>0)).sum()
        assert warm_e > warm_n, f'evening windows not clearly warmer for stage {stage}'


    # Stage 0 is map-painted, so its phase lighting is baked into the base maps.
    eve0=np.array(Image.open(ROOT/'public/garden/islands/stage-0/stage0-evening.png').convert('RGBA')).astype(np.int16)[300:750,100:600]
    night0=np.array(Image.open(ROOT/'public/garden/islands/stage-0/stage0-night.png').convert('RGBA')).astype(np.int16)[300:750,100:600]
    warm_e0=((eve0[:,:,0]>140)&(eve0[:,:,1]>95)&(eve0[:,:,0]>eve0[:,:,2]+40)).sum()
    warm_n0=((night0[:,:,0]>140)&(night0[:,:,1]>95)&(night0[:,:,0]>night0[:,:,2]+40)).sum()
    assert warm_e0 > warm_n0, 'Stage 0 evening house should be lit while night remains dark'

    # Terrace later stages must fully cover Stage 0 terrace silhouette.
    tf=ROOT/'public/garden/evolution/lanterns/full-silhouette'
    t0=alpha(tf/'terrace-stage-0.png')
    for stage in range(1,6):
        ta=alpha(tf/f'terrace-stage-{stage}.png')
        assert np.all(ta[t0]), f'terrace stage {stage} leaves Stage 0 exposed'

    # Runtime glow/emissive stays disabled.
    lantern=(ROOT/'src/game/systems/LanternEvolutionSystem.ts').read_text()
    assert 'const ACTIVE_LIGHT_COUNTS = [0, 0, 0, 0, 0, 0] as const' in lantern
    for phase in ['evening','night']:
        arr=np.array(Image.open(ROOT/f'public/garden/evolution/lanterns/emissive/{phase}-stage-5.png').convert('RGBA'))
        assert arr[:,:,3].sum()==0, f'{phase} terrace emissive not blank'

    # Vegetable garden offset lock.
    home_ts=(ROOT/'src/game/systems/HomeEvolutionSystem.ts').read_text()
    assert 'VEGETABLE_GARDEN_OFFSET_Y = -25' in home_ts

    # Pond stage koi-count rule remains 1 / 2 / 3 at stages 3 / 4 / 5.
    pond=(ROOT/'src/game/systems/PondEvolutionSystem.ts').read_text()
    assert 'const MAX_FISH = 3' in pond
    assert len(re.findall(r'Object.freeze\(\[\[', pond)) >= 3

    # Bridge fishing assets exist for all phases.
    for phase in ['morning','afternoon','evening','night']:
        for state in ['idle','cast']:
            assert (ROOT/f'public/garden/evolution/bridge-fishing/phases/{phase}/bridge-fishing-{state}.png').exists()

    print('Build 22.1.12 visual-lock validation passed.')

if __name__=='__main__': main()
