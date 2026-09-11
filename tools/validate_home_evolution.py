from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
errors: list[str] = []
home = ROOT / 'src/game/systems/HomeEvolutionSystem.ts'
scene = ROOT / 'src/game/scenes/Stage0Scene.ts'
progression = ROOT / 'src/game/progression/progressionEngine.ts'
coordinator = ROOT / 'src/game/evolution/EvolutionCoordinator.ts'

if not home.exists():
    errors.append('HomeEvolutionSystem.ts missing')
else:
    text = home.read_text(encoding='utf-8')
    for token in ['HOME_STAGE_NAMES', 'CROP_X = 100', 'CROP_Y = 300', 'CROP_WIDTH = 500', 'CROP_HEIGHT = 450']:
        if token not in text:
            errors.append(f'home system token missing: {token}')
    if 'generateTexture' in text or 'scene.make.graphics' in text:
        errors.append('home evolution contains procedural graphics')

asset_dir = ROOT / 'public/garden/evolution/home'
for phase in ['morning', 'afternoon', 'evening', 'night']:
    for stage in range(6):
        path = asset_dir / f'{phase}-stage-{stage}.png'
        if not path.exists():
            errors.append(f'missing home PNG: {path.name}')
            continue
        im = Image.open(path).convert('RGBA')
        if im.size != (500, 450):
            errors.append(f'wrong size for {path.name}: {im.size}')
        extrema = im.getchannel('A').getextrema()
        if stage == 0 and extrema != (0, 0):
            errors.append(f'stage 0 should be transparent: {path.name}')
        if stage > 0 and extrema[1] == 0:
            errors.append(f'stage {stage} contains no visible pixels: {path.name}')

scene_text = scene.read_text(encoding='utf-8')
for token in ['HomeEvolutionSystem.preload(this)', 'new HomeEvolutionSystem(this)', "change.feature === 'home'", 'this.homeEvolution.resize']:
    if token not in scene_text:
        errors.append(f'home scene integration missing: {token}')
if 'syncRegisteredPhaseArt' not in scene_text or 'this.homeEvolution?.setPhase(phase)' not in scene_text:
    errors.append('home scene integration missing coordinated painted-phase synchronization')
prog_text = progression.read_text(encoding='utf-8')
for token in ['HOME_STAGE_THRESHOLDS = [0, 5, 12, 20, 30, 40]', 'homeStageForCredits', 'nextHomeThreshold']:
    if token not in prog_text:
        errors.append(f'home progression missing: {token}')
coord_text = coordinator.read_text(encoding='utf-8')
if "['tree', 'home', 'garden', 'pond', 'lanterns']" not in coord_text:
    errors.append('home missing from evolution coordinator order')

if errors:
    raise SystemExit('home evolution validation failed: ' + '; '.join(errors))
print('home evolution validation passed')
print('24 phase/stage PNG overlays validated at 500x450')

# Build 20.7.1 transparency lock: evolved Home sprites must not carry a rectangular scene cutout.
for phase in ['morning', 'afternoon', 'evening', 'night']:
    for stage in range(1, 6):
        path = asset_dir / f'{phase}-stage-{stage}.png'
        im = Image.open(path).convert('RGBA')
        alpha = im.getchannel('A')
        bbox = alpha.getbbox()
        if bbox is None:
            errors.append(f'empty evolved home sprite: {path.name}')
            continue
        # No visible pixels are allowed to touch the 500x450 crop boundary.
        x0, y0, x1, y1 = bbox
        if x0 <= 0 or y0 <= 0 or x1 >= 500 or y1 >= 450:
            errors.append(f'home alpha touches crop edge (possible cutout): {path.name} {bbox}')
        hist = alpha.histogram()
        visible = sum(hist[1:])
        # A full/near-full rectangle would indicate embedded terrain rather than an isolated sprite.
        if visible > 120000:
            errors.append(f'home alpha coverage too large (possible terrain rectangle): {path.name} {visible}')

if errors:
    raise SystemExit('home evolution validation failed: ' + '; '.join(errors))
print('20.7.1 transparency lock passed: isolated Home silhouettes, no crop-edge rectangles')
