from pathlib import Path
from PIL import Image
import numpy as np
import cv2
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[1]
PHASES = ['morning', 'afternoon', 'evening', 'night']
MAPS = ROOT / 'public/garden/islands/terrace-evolution'
PATCHES = ROOT / 'public/garden/evolution/lanterns/native-patches'
BASE = ROOT / 'public/garden/islands/stage-0'
LOCKED = ROOT / 'public/garden/evolution/lanterns/source/22.7.15-clean-afternoon-maps'
WARP_X, WARP_Y = 900, 250
PATCH_BOX = (861, 301, 1350, 605)
errors = []

LIGHT_SPOTS = {
    0: [(138,113,8),(158,127,8),(186,137,8),(207,142,8),(232,138,8),(246,129,8)],
    1: [(130,114,8),(152,127,8),(178,139,8),(204,141,8),(229,137,8),(245,128,8),(291,157,7),(305,181,8)],
    2: [(124,113,8),(146,127,8),(172,138,8),(201,141,8),(226,137,8),(240,129,8),(287,155,8),(303,184,9)],
    3: [(137,73,8),(157,86,8),(184,98,8),(216,103,8),(240,100,8),(254,91,8),(280,156,9),(194,171,8)],
    4: [(129,77,8),(149,92,8),(178,105,8),(212,107,8),(239,103,8),(252,94,8),(282,163,9),(181,178,8)],
    5: [(121,76,8),(141,86,8),(159,96,8),(191,104,8),(216,104,8),(258,98,8),(213,70,9),(114,116,7),(57,193,10),(303,211,10),(181,170,8),(281,171,8)],
}

# 1) 24 exact full-map runtime textures and 24 native QA/reference crops.
for phase in PHASES:
    for stage in range(6):
        m = MAPS / phase / f'stage-{stage}.png'
        p = PATCHES / phase / f'stage-{stage}.png'
        if not m.exists():
            errors.append(f'missing full runtime map: {m.relative_to(ROOT)}')
            continue
        im = Image.open(m)
        if im.size != (1448,1086): errors.append(f'bad full-map dimensions: {m.relative_to(ROOT)} {im.size}')
        if im.mode not in ('RGB','RGBA'): errors.append(f'bad full-map mode: {m.relative_to(ROOT)} {im.mode}')
        a = np.array(im.convert('RGB'))
        # Runtime map must be opaque and contain no large black-matte cutout contamination.
        if np.mean(np.max(a[220:610,850:1340], axis=2) < 4) > 0.0005:
            errors.append(f'black-gap contamination: {phase} stage {stage}')
        if not p.exists():
            errors.append(f'missing native patch: {p.relative_to(ROOT)}')
        else:
            pi = Image.open(p)
            if pi.size != (489,304): errors.append(f'bad native patch dimensions: {p.relative_to(ROOT)} {pi.size}')
            # Native patch must be a literal crop from the runtime map, not a separate overlay asset.
            x0,y0,x1,y1 = PATCH_BOX
            if not np.array_equal(np.array(pi.convert('RGB')), a[y0:y1,x0:x1]):
                errors.append(f'native patch is not exact runtime crop: {phase} stage {stage}')

# 2) Exact registration/geometry source remains locked; no scaling or re-anchor pass exists.
for stage in range(6):
    locked = LOCKED / f'stage-{stage}.png'
    if not locked.exists() or Image.open(locked).size != (1448,1086):
        errors.append(f'missing/bad locked geometry source stage {stage}')

# 3) Runtime must use only baked full Sanctuary maps for terrace visuals.
stage_scene = (ROOT/'src/game/scenes/Stage0Scene.ts').read_text()
lantern = (ROOT/'src/game/systems/LanternEvolutionSystem.ts').read_text()
if '/garden/islands/terrace-evolution/${phase}/stage-${stage}.png' not in stage_scene:
    errors.append('Stage0Scene is not loading the 24 baked terrace full maps')
for bad in ['scene.add.image', '.setTint(', '.setBlendMode(', '.setAlpha(']:
    if bad in lantern:
        errors.append(f'terrace-specific runtime visual/tint/glow returned: {bad}')

# 4) Light-state sweep: Evening emitters ON, Morning/Afternoon/Night OFF.
# Sample the tiny registered fixture cores in the actual full runtime images.
yy, xx = np.ogrid[:1086,:1448]
for stage in range(6):
    core = np.zeros((1086,1448), bool)
    for cx,cy,r in LIGHT_SPOTS[stage]:
        rr = max(3, r-3)
        core |= ((xx-(WARP_X+cx))**2 + (yy-(WARP_Y+cy))**2 <= rr**2)
    readings = {}
    for phase in PHASES:
        arr = np.array(Image.open(MAPS/phase/f'stage-{stage}.png').convert('RGB'))
        V = cv2.cvtColor(arr, cv2.COLOR_RGB2HSV)[:,:,2][core]
        readings[phase] = (float(V.mean()), int(np.sum(V > 175)), int(V.size))
    ev_mean, ev_hot, n = readings['evening']
    if ev_mean < 185 or ev_hot < int(n*0.70):
        errors.append(f'evening terrace practicals not clearly ON at stage {stage}: {readings}')
    # Off states must not retain a meaningful field of emissive cores.
    for phase in ('morning','afternoon','night'):
        mean, hot, n = readings[phase]
        if hot > max(12, int(n*0.04)):
            errors.append(f'{phase} terrace practicals still read ON at stage {stage}: {readings[phase]}')
    if ev_mean <= max(readings[p][0] for p in ('morning','afternoon','night')) + 35:
        errors.append(f'evening emitter contrast too weak at stage {stage}: {readings}')

# 5) Stage progression footprint/anchor sanity and Stage 5 scale limit.
base_by_phase = {p: np.array(Image.open(BASE/f'stage0-{p}.png').convert('RGB')) for p in PHASES}
for phase in PHASES:
    areas=[]
    bboxes=[]
    for stage in range(6):
        arr=np.array(Image.open(MAPS/phase/f'stage-{stage}.png').convert('RGB'))
        diff=np.max(np.abs(arr.astype(np.int16)-base_by_phase[phase].astype(np.int16)),axis=2)>3
        ys,xs=np.where(diff)
        if len(xs)==0:
            errors.append(f'empty terrace geometry: {phase} stage {stage}')
            continue
        b=(int(xs.min()),int(ys.min()),int(xs.max()+1),int(ys.max()+1))
        bboxes.append(b); areas.append(int(diff.sum()))
        # Same world anchor zone; no detached/sticker drift.
        if not (930 <= b[0] <= 950 and 1235 <= b[2] <= 1252 and 240 <= b[1] <= 330 and 525 <= b[3] <= 570):
            errors.append(f'terrace registration drift: {phase} stage {stage} bbox={b}')
    if len(areas)==6:
        if not (areas[5] > areas[4] > areas[3]):
            errors.append(f'Stage 5/4/3 progression area not increasing in {phase}: {areas}')
        if areas[5] > areas[0]*1.60:
            errors.append(f'Stage 5 oversized in {phase}: base={areas[0]} stage5={areas[5]}')

# 6) The house and base Sanctuary phase maps are byte-identical to the uploaded 22.7.15 source.
manifest_path = ROOT/'docs/BASE-HOUSE-LOCK-SHA256-22.7.16.json'
if not manifest_path.exists():
    errors.append('missing base/house preservation manifest')
else:
    manifest=json.loads(manifest_path.read_text()).get('files',{})
    for rel, expected in manifest.items():
        p=ROOT/rel
        if not p.exists():
            errors.append(f'preserved file missing: {rel}')
        elif hashlib.sha256(p.read_bytes()).hexdigest()!=expected:
            errors.append(f'house/base source changed unexpectedly: {rel}')

# 7) Version/build marker.
pkg=json.loads((ROOT/'package.json').read_text())
if pkg.get('version')!='0.99.67-production-22.7.16': errors.append('package version not 22.7.16')
version=(ROOT/'src/version.ts').read_text()
if '0.99.67-production-22.7.16' not in version: errors.append('src/version.ts not 22.7.16')

if errors:
    print('FAIL — PRODUCTION 22.7.16 TERRACE LIGHTING + SILHOUETTE QA')
    for e in errors: print('-',e)
    raise SystemExit(1)
print('PASS — PRODUCTION 22.7.16')
print('24/24 terrace states present as baked full-map runtime PNGs')
print('Morning OFF / Afternoon OFF / Evening ON / Night OFF practical-state sweep passed')
print('Terrace runtime overlay/tint path absent; geometry/anchor sweep passed')
print('Stage 5 progression/size guard passed; base Sanctuary + house hashes unchanged')
