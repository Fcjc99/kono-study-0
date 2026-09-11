
from pathlib import Path
from PIL import Image
import numpy as np

ROOT = Path(__file__).resolve().parents[1]

def assert_clean_transparent_rgb(folder: Path):
    problems = []
    for p in folder.rglob('*.png'):
        arr = np.array(Image.open(p).convert('RGBA'))
        mask = arr[:, :, 3] == 0
        if mask.any() and np.any(arr[:, :, :3][mask] != 0):
            problems.append(str(p.relative_to(ROOT)))
    return problems

def main():
    home_text = (ROOT / 'src/game/systems/HomeEvolutionSystem.ts').read_text()
    assert 'VEGETABLE_GARDEN_OFFSET_Y = -25' in home_text, 'Vegetable garden offset missing'
    assert '.setPosition(x + VEGETABLE_GARDEN_OFFSET_X * scaleX, y + VEGETABLE_GARDEN_OFFSET_Y * scaleY)' in home_text, 'Vegetable garden position not offset'

    lantern_text = (ROOT / 'src/game/systems/LanternEvolutionSystem.ts').read_text()
    assert 'const ACTIVE_LIGHT_COUNTS = [0, 0, 0, 0, 0, 0] as const' in lantern_text, 'Terrace runtime glows re-enabled unexpectedly'
    assert '.setAlpha(0)' in lantern_text, 'Terrace emissive alpha not forced off'

    for phase in ['evening', 'night']:
        arr = np.array(Image.open(ROOT / f'public/garden/evolution/lanterns/emissive/{phase}-stage-5.png').convert('RGBA'))
        assert arr[:, :, 3].sum() == 0, f'{phase} terrace emissive not blank'

    bad = []
    for folder in [
        ROOT / 'public/garden/evolution/home',
        ROOT / 'public/garden/evolution/home/decor',
        ROOT / 'public/garden/evolution/lanterns',
        ROOT / 'public/garden/evolution/bridge-fishing',
    ]:
        if folder.exists():
            bad.extend(assert_clean_transparent_rgb(folder))
    assert not bad, 'Transparent RGB contamination present: ' + ', '.join(bad[:12])
    print('Build 22.1.7 validation passed.')

if __name__ == '__main__':
    main()
