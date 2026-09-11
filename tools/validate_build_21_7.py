from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSET = ROOT / 'public/garden/evolution/lanterns'
FULL = ASSET / 'full-silhouette'
SYSTEM = (ROOT / 'src/game/systems/LanternEvolutionSystem.ts').read_text()
errors=[]
areas=[]
for stage in range(6):
    p=ASSET/f'terrace-stage-{stage}.png'
    q=FULL/f'terrace-stage-{stage}.png'
    if not p.exists(): errors.append(f'missing runtime {p.name}'); continue
    if not q.exists(): errors.append(f'missing standalone {q.name}'); continue
    im=Image.open(p)
    if im.size!=(1448,1086): errors.append(f'{p.name} wrong runtime size {im.size}')
    if im.mode!='RGBA': errors.append(f'{p.name} runtime must be RGBA')
    a=im.getchannel('A')
    bbox=a.getbbox()
    count=sum(1 for v in a.getdata() if v)
    areas.append(count)
    if stage==0 and bbox is not None: errors.append('stage 0 runtime overlay must remain transparent (base map is authoritative)')
    if stage>0:
        if bbox is None: errors.append(f'{p.name} has no visible pixels')
        elif bbox[0]<940 or bbox[1]<330 or bbox[2]>1285 or bbox[3]>535:
            errors.append(f'{p.name} escaped production terrace footprint: {bbox}')
        if count < 18000: errors.append(f'{p.name} is too sparse/blocky for a full terrace surface: {count} px')
    sm=Image.open(q)
    if sm.size!=(430,360): errors.append(f'{q.name} wrong standalone size {sm.size}')
    if sm.mode!='RGBA': errors.append(f'{q.name} standalone must be RGBA')
    sb=sm.getchannel('A').getbbox()
    if sb is None: errors.append(f'{q.name} standalone sprite is empty')
    elif sb[0]<=0 or sb[1]<=0 or sb[2]>=430 or sb[3]>=360:
        errors.append(f'{q.name} standalone silhouette touches crop edge: {sb}')

if len(areas)>=6 and areas[5] <= areas[4] * 1.10:
    errors.append(f'Stage 5 must be visibly grander than Stage 4 by silhouette area: {areas[4]} -> {areas[5]}')

for src in ['approved-terrace-evolution.png','approved-stage0-reference.png']:
    if not (ASSET/'source'/src).exists(): errors.append(f'missing approved source {src}')
for token in ["'First touches'", "'Resting rug'", "'Tea terrace'", "'Blossom pergola'", "'Grand sanctuary terrace'", 'Stage-0-aligned full-surface pixel PNG overlays']:
    if token not in SYSTEM: errors.append(f'missing 21.7 system token: {token}')
if 'generateTexture' in SYSTEM or 'make.graphics' in SYSTEM:
    errors.append('runtime-generated terrace graphics are prohibited')

if errors:
    print('Build 21.7 validation FAILED')
    for e in errors: print('-', e)
    raise SystemExit(1)
print('Build 21.7 validation PASS')
print('- Stage 0 production terrace remains authoritative')
print('- Stages 1-5 are full-surface Sanctuary-style pixel PNG overlays')
print('- Six standalone terrace PNGs available for visual QA')
print('- Stage 5 silhouette is clearly more elaborate than Stage 4')
print('- Production map footprint/orientation remains locked')
