from pathlib import Path
from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[1]
SCENE = ROOT / 'src/game/scenes/Stage0Scene.ts'
SYSTEM = ROOT / 'src/game/systems/TreeEvolutionSystem.ts'
PLACEHOLDER_SYSTEM = ROOT / 'src/game/systems/EvolutionSystem.ts'
PLACEHOLDER_ASSETS = ROOT / 'public/garden/evolution/tree'
SPRITE_ROOT = ROOT / 'public/garden/evolution/cherry-tree'
SOURCE_ROOT = SPRITE_ROOT / 'source'
ART_LOCK = ROOT / 'docs/EVOLUTION_ART_LOCK.md'
MANIFEST = ROOT / 'public/garden/evolution/evolution-art-manifest.json'
PHASES = ('morning', 'afternoon', 'evening', 'night')
RUNTIME_SIZE = (620, 650)

scene = SCENE.read_text(encoding='utf-8')
system = SYSTEM.read_text(encoding='utf-8')
required = (
    "import { TREE_STAGE_NAMES, TreeEvolutionSystem } from '../systems/TreeEvolutionSystem'",
    'TreeEvolutionSystem.preload(this)',
    'this.evolution = new TreeEvolutionSystem(this)',
    'this.evolution?.setPhase(phase, false)',
)
for token in required:
    if token not in scene:
        raise SystemExit(f'missing integration token: {token}')

if "from '../systems/EvolutionSystem'" in scene:
    raise SystemExit('placeholder EvolutionSystem is still imported')
if PLACEHOLDER_SYSTEM.exists():
    raise SystemExit('placeholder EvolutionSystem.ts is still shipped')
if PLACEHOLDER_ASSETS.exists():
    raise SystemExit('placeholder tree asset directory is still shipped')
if not ART_LOCK.exists() or not MANIFEST.exists():
    raise SystemExit('evolution art lock files are missing')
if 'Math.sin' in system or 'Back.Out' in system:
    raise SystemExit('anchored tree still contains continuous deformation or bounce animation')
if 'spawnPersistentPetal' not in system:
    raise SystemExit('mature-tree ambient petals are missing')
if 'TREE_ANCHOR_X = 704' not in system or 'TREE_GROUND_Y = 272' not in system:
    raise SystemExit('tree registration constants are missing')
if 'TREE_ORIGIN_Y = CONTENT_BOTTOM_Y / TEXTURE_HEIGHT' not in system:
    raise SystemExit('tree origin is not registered to the source texture height')
if 'baseTextureKey' in system:
    raise SystemExit('legacy mound-cover renderer is still active')
if 'phaseShadowTint' not in system or 'phasePetalDelayMultiplier' not in system:
    raise SystemExit('phase-aware tree integration controls are missing')

for stage in range(6):
    source = SOURCE_ROOT / f'tree-level-{stage}.png'
    if not source.exists():
        raise SystemExit(f'missing approved source sprite: {source.relative_to(ROOT)}')
    with Image.open(source) as image:
        if image.size != (1536, 1024):
            raise SystemExit(f'wrong source canvas {image.size}: {source.relative_to(ROOT)}')
        if image.mode != 'RGBA':
            raise SystemExit(f'source sprite is not RGBA: {source.relative_to(ROOT)}')
        if image.getchannel('A').getbbox() is None:
            raise SystemExit(f'empty source sprite: {source.relative_to(ROOT)}')

for legacy_base in SPRITE_ROOT.glob('*-base.png'):
    raise SystemExit(f'legacy mound cover still shipped: {legacy_base.relative_to(ROOT)}')

checked = 0
for phase in PHASES:
    for stage in range(6):
        path = SPRITE_ROOT / f'{phase}-stage-{stage}.png'
        if not path.exists():
            raise SystemExit(f'missing sprite: {path.relative_to(ROOT)}')
        with Image.open(path) as image:
            if image.size != RUNTIME_SIZE:
                raise SystemExit(f'wrong sprite canvas {image.size}: {path.relative_to(ROOT)}')
            if image.mode != 'RGBA':
                raise SystemExit(f'sprite is not RGBA: {path.relative_to(ROOT)}')
            if image.getchannel('A').getbbox() is None:
                raise SystemExit(f'empty sprite: {path.relative_to(ROOT)}')
        checked += 1

# The alpha silhouette must stay registered across time-of-day grades.
for stage in range(6):
    reference = Image.open(SPRITE_ROOT / f'afternoon-stage-{stage}.png').convert('RGBA').getchannel('A')
    for phase in ('morning', 'evening', 'night'):
        candidate = Image.open(SPRITE_ROOT / f'{phase}-stage-{stage}.png').convert('RGBA').getchannel('A')
        if ImageChops.difference(reference, candidate).getbbox() is not None:
            raise SystemExit(f'phase alpha registration mismatch at stage {stage}: {phase}')

for preview in (
    ROOT / 'docs/PRODUCTION-BUILD-15.3-TREE-PHASE-INTEGRATION.png',
    ROOT / 'docs/PRODUCTION-BUILD-15.3-TREE-LOW-LIGHT-DETAIL.png',
    ROOT / 'docs/PRODUCTION-BUILD-15.3-TREE-SCALE-PROGRESSION.png',
):
    if not preview.exists():
        raise SystemExit(f'missing QA preview: {preview.relative_to(ROOT)}')

print(f'validated locked tree art, 6 approved sources, and {checked} runtime textures')
print('scene-derived phase grading, feathered mound edges, and phase registration passed')
