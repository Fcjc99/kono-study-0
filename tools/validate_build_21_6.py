from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
ASSET=ROOT/'public/garden/evolution/lanterns'
SYSTEM=(ROOT/'src/game/systems/LanternEvolutionSystem.ts').read_text()
SCENE=(ROOT/'src/game/scenes/Stage0Scene.ts').read_text()
LANDMARK=(ROOT/'src/game/data/sanctuaryLandmarks.ts').read_text()
errors=[]
for stage in range(6):
    p=ASSET/f'terrace-stage-{stage}.png'
    if not p.exists():
        errors.append(f'missing {p.name}'); continue
    im=Image.open(p)
    if im.size!=(1448,1086): errors.append(f'{p.name} wrong size {im.size}')
    if im.mode!='RGBA': errors.append(f'{p.name} must be RGBA')
    a=im.getchannel('A')
    if stage==0 and a.getbbox() is not None: errors.append('stage 0 overlay should be fully transparent')
    if stage>0 and a.getbbox() is None: errors.append(f'{p.name} has no visible pixels')
    # decor must stay inside terrace region / away from map edges
    bbox=a.getbbox()
    if bbox and (bbox[0]<900 or bbox[1]<280 or bbox[2]>1350 or bbox[3]>650): errors.append(f'{p.name} decor escaped terrace bounds: {bbox}')
if not (ASSET/'lantern-glow.png').exists(): errors.append('missing raster lantern-glow.png')
for token in ['sanctuary-terrace-stage-', 'setDisplaySize(sceneBounds.width, sceneBounds.height)', "'Tea nook'", "'Cozy hangout'"]:
    if token not in SYSTEM: errors.append(f'missing system token: {token}')
if 'generateTexture' in SYSTEM or 'make.graphics' in SYSTEM: errors.append('runtime-generated lantern graphics still present')
if 'LanternEvolutionSystem.preload(this)' not in SCENE: errors.append('terrace preload missing from scene')
if 'LANTERN_STAGE_INTERACTIONS' not in SCENE: errors.append('terrace interaction copy missing')
if 'tea seating' not in LANDMARK: errors.append('landmark description not updated')
if errors:
    print('Build 21.6 validation FAILED')
    for e in errors: print('-',e)
    raise SystemExit(1)
print('Build 21.6 validation PASS')
print('- 6 fixed-footprint transparent terrace overlays')
print('- raster lantern glow asset')
print('- Stage 2 lantern string, Stage 3 tea nook, Stage 4 garden terrace, Stage 5 cozy hangout')
print('- map-fit bounds and scene preload verified')
