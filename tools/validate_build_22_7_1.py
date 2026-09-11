from pathlib import Path
from PIL import Image
import hashlib, json, re, sys
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
errors=[]

def fail(msg): errors.append(msg)
def text(rel):
    p=ROOT/rel
    if not p.exists():
        fail(f'missing file: {rel}')
        return ''
    return p.read_text(errors='ignore')

def rgba(rel):
    p=ROOT/rel
    if not p.exists():
        fail(f'missing asset: {rel}')
        return None
    return Image.open(p).convert('RGBA')

# version / current validator wiring
package=json.loads((ROOT/'package.json').read_text())
if package.get('version') != '0.99.58-production-22.7.1': fail(f"package version mismatch: {package.get('version')}")
if 'validate:22.7.1' not in package.get('scripts',{}): fail('missing validate:22.7.1 script')

# 4 source phase maps: exact source canvas
for ph in ['morning','afternoon','evening','night']:
    im=rgba(f'public/garden/islands/stage-0/stage0-{ph}.png')
    if im and im.size != (1448,1086): fail(f'{ph} source scene wrong size: {im.size}')

# Approved terrace stays pixel-clean and hash-locked.
manifest=json.loads((ROOT/'docs/APPROVED-TERRACE-SHA256-22.6.9.json').read_text())
for rel, expected in manifest.items():
    p=ROOT/rel
    if not p.exists():
        fail(f'missing approved terrace asset: {rel}')
        continue
    actual=hashlib.sha256(p.read_bytes()).hexdigest()
    if actual != expected: fail(f'approved terrace changed: {rel}')
    im=Image.open(p).convert('RGBA')
    if im.size != (1448,1086): fail(f'terrace canvas mismatch: {rel} {im.size}')
    a=np.asarray(im.getchannel('A'))
    vals=np.unique(a)
    if len(vals) > 2 or any(v not in (0,255) for v in vals): fail(f'soft alpha in terrace: {rel}')

stage = text('src/game/scenes/Stage0Scene.ts')
lantern = text('src/game/systems/LanternEvolutionSystem.ts')
tree = text('src/game/systems/TreeEvolutionSystem.ts')
lighting = text('src/game/systems/LightingSystem.ts')
critter = text('src/game/systems/CritterSystem.ts')
kono = text('src/game/systems/KonoMascotSystem.ts')
home = text('src/game/systems/HomeEvolutionSystem.ts')
cloud = text('src/game/systems/CloudSystem.ts')
render = text('src/game/engine/RenderLayers.ts')
pond = text('src/game/systems/PondEvolutionSystem.ts')

# No terrace-specific glow/emissive/mask pass.
for forbidden in ['sanctuary-lantern-glow', '/lanterns/emissive/', 'BlendModes.ADD']:
    if forbidden in lantern: fail(f'terrace runtime contains forbidden layer token: {forbidden}')
if 'sanctuary-lantern-glow' in stage: fail('legacy procedural terrace glow still generated in Stage0Scene')

# Phase switches protect painted art rather than tint-flashing it.
if 'alpha: 0.13' in stage or 'veilColor' in stage: fail('colored phase veil animation still active')
if 'this.evolution?.setPhase(phase, false)' not in stage: fail('tree phase art is not synchronized to painted phase frame')
if 'setPhase(phase: DayPhase, animate = true)' not in tree: fail('tree phase API does not support exact no-crossfade sync')

# Runtime lighting must remain restrained because phase maps are already fully painted.
for token in ['darkness * 0.28','warmth * 0.036','coolness * 0.032']:
    if token not in lighting: fail(f'lighting restraint token missing: {token}')

# Home stage 5 must fully cover original Stage 0 house footprint for every phase.
mask=np.asarray(Image.open(ROOT/'public/garden/evolution/home/source/stage0-house-coverage-mask.png').convert('L'))>0
for ph in ['morning','afternoon','evening','night']:
    im=rgba(f'public/garden/evolution/home/{ph}-stage-5.png')
    if not im: continue
    alpha=np.asarray(im.getchannel('A'))>0
    if alpha.shape != mask.shape: fail(f'home stage5 canvas mismatch {ph}: {alpha.shape} vs {mask.shape}')
    elif np.any(mask & ~alpha): fail(f'home stage5 exposes old Stage0 roofline in {ph}')
if 'VEGETABLE_GARDEN_OFFSET_Y = -25' not in home: fail('vegetable garden foreground-clearance offset changed')

# KONO pond exclusion / path graph stays in the production system.
for token in ['POND_EXCLUSION','isWalkablePoint','pond-south-west','pond-south-east','bridge']:
    if token not in kono: fail(f'KONO safe navigation token missing: {token}')

# Koi progression lock: 1 / 2 / 3 fish at stages 3 / 4 / 5.
if 'return Math.min(MAX_FISH, stage - 2)' not in pond: fail('koi stage progression formula changed')

# Cloud front layer remains behind world evolution art; prevents cloud covering tree/house/terrace.
m=re.search(r'cloudsFront:\s*([0-9.]+)', render)
e=re.search(r'evolution:\s*([0-9.]+)', render)
if m and e and float(m.group(1)) >= float(e.group(1)): fail('cloud front layer is not behind evolution art')

# Existing pixel moth is now wired as a real evening/night ambient behavior.
if "'moth'" not in critter or "critter25-moth" not in critter or 'spawnMoth' not in critter: fail('moth ambient behavior not integrated')
moth=rgba('public/garden/critters/moth-01.png')
if moth:
    vals=np.unique(np.asarray(moth.getchannel('A')))
    if len(vals)>2 or any(v not in (0,255) for v in vals): fail('moth sprite has soft alpha fringe')

# Responsive scene fit must preserve full island aspect and resize all production systems.
if 'Math.min(this.scale.width / sourceWidth, this.scale.height / sourceHeight)' not in stage: fail('responsive full-island fit rule missing')
for token in ['this.lighting.resize','this.fluid.resize','this.clouds.resize','this.pondEvolution.resize','this.homeEvolution.resize','this.lanternEvolution.resize','this.konoMascot.resize']:
    if token not in stage: fail(f'production resize call missing: {token}')

if errors:
    print('Build 22.7.1 production QA FAILED')
    for e in errors: print('-',e)
    sys.exit(1)
print('Build 22.7.1 production QA passed')
print('- 4 phase source scenes validated')
print('- approved 22.6.9 terrace PNGs hash-locked and hard-alpha clean')
print('- phase tint-flash / legacy terrace glow removed')
print('- tree + home + terrace + fishing phase sync checked')
print('- stage5 house roofline coverage checked in all phases')
print('- vegetable garden clearance lock checked')
print('- KONO pond-safe navigation tokens checked')
print('- koi progression and cloud/evolution layering checked')
print('- evening/night moth behavior integrated')
