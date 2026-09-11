from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
engine = (ROOT / 'src/game/progression/progressionEngine.ts').read_text()
types = (ROOT / 'src/game/progression/types.ts').read_text()
scene = (ROOT / 'src/game/scenes/Stage0Scene.ts').read_text()
pond = (ROOT / 'src/game/systems/PondEvolutionSystem.ts').read_text()
app = (ROOT / 'src/App.tsx').read_text()
assets = ROOT / 'public/garden/evolution/pond'

checks = {
    'schema v7': 'SANCTUARY_PROGRESS_SCHEMA_VERSION = 7' in types,
    'subject key credits': 'creditsBySubjectKey' in types and 'normalizeProgressSubjectKey' in engine,
    'pond thresholds': 'POND_STAGE_THRESHOLDS = [0, 1, 2, 3, 5, 8]' in engine,
    'pond system': 'export class PondEvolutionSystem' in pond,
    'pixel asset preload': 'PondEvolutionSystem.preload(this)' in scene and 'static preload(scene: Phaser.Scene)' in pond,
    'real koi sprites': 'KOI_VARIANTS' in pond and 'koiTextureKey' in pond,
    'no procedural pond textures': 'scene.make.graphics' not in pond and 'generateTexture' not in pond,
    'eight-way koi': 'KOI_DIRECTIONS = 8' in pond,
    'tail frames': 'KOI_FRAMES = 2' in pond,
    'visible pond decor': 'DECORATIONS' in pond and 'pond-lotus-1' in pond and 'pond-reeds-1' in pond,
    'reduced motion': 'setReducedMotion' in pond,
    'scene integration': 'this.pondEvolution.update' in scene and 'this.pondEvolution.resize' in scene,
    'science mapping': "subjectKey:subject?.name??current.subjectId" in app,
    'profile migration mapping': 'subjectKey:subjects.find' in app,
}
missing = [name for name, passed in checks.items() if not passed]
if missing:
    raise SystemExit('pond evolution validation failed: ' + ', '.join(missing))

required_static = [
    'lily-pad-1.png', 'lily-pad-2.png', 'lily-pad-3.png', 'lotus-pink.png',
    'reeds-cluster.png', 'moss-stones.png', 'ripple-small.png', 'ripple-large.png',
    'water-sparkle.png', 'shore-flowers.png',
]
for name in required_static:
    path = assets / name
    if not path.exists():
        raise SystemExit(f'missing pond pixel asset: {path.relative_to(ROOT)}')
    with Image.open(path) as image:
        if image.mode != 'RGBA' or image.getchannel('A').getbbox() is None:
            raise SystemExit(f'invalid transparent PNG: {path.relative_to(ROOT)}')

koi_count = 0
for variant in ('orange-white', 'red-white', 'gold-black'):
    for direction in range(8):
        for frame in range(2):
            path = assets / f'koi-{variant}-d{direction}-f{frame}.png'
            if not path.exists():
                raise SystemExit(f'missing koi frame: {path.relative_to(ROOT)}')
            with Image.open(path) as image:
                if image.mode != 'RGBA' or image.getchannel('A').getbbox() is None:
                    raise SystemExit(f'invalid koi PNG: {path.relative_to(ROOT)}')
            koi_count += 1

print('pond evolution validation passed')
print('science thresholds: 0, 1, 2, 3, 5, 8')
print(f'pixel koi frames: {koi_count} (3 variants x 8 directions x 2 tail frames)')
print('visual stages: natural, ripples, lilies, first koi, koi garden, sanctuary pond')
