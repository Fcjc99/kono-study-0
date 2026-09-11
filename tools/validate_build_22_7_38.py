from pathlib import Path
from PIL import Image
import hashlib, json, sys

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'STAGE0-LOCK-22.7.38.json'
errors = []

if not MANIFEST.exists():
    errors.append('missing STAGE0-LOCK-22.7.38.json')
else:
    data = json.loads(MANIFEST.read_text(encoding='utf-8'))
    if data.get('world_size') != [1448, 1086]:
        errors.append('manifest world size changed')
    for phase, info in data.get('phases', {}).items():
        runtime = ROOT / info['runtime_path']
        locked = ROOT / info['locked_source_path']
        for label, p in [('runtime', runtime), ('locked source', locked)]:
            if not p.exists():
                errors.append(f'{phase}: missing {label}: {p.relative_to(ROOT)}')
                continue
            digest = hashlib.sha256(p.read_bytes()).hexdigest()
            if digest != info['sha256']:
                errors.append(f'{phase}: {label} hash changed: {digest}')
            try:
                im = Image.open(p)
                if im.size != (1448, 1086):
                    errors.append(f'{phase}: {label} size changed: {im.size}')
            except Exception as e:
                errors.append(f'{phase}: cannot read {label}: {e}')
        if runtime.exists() and locked.exists() and runtime.read_bytes() != locked.read_bytes():
            errors.append(f'{phase}: runtime Stage 0 no longer byte-identical to locked source')

scene = ROOT / 'src/game/scenes/Stage0Scene.ts'
if scene.exists():
    text = scene.read_text(encoding='utf-8')
    token = '/garden/islands/terrace-evolution/${phase}/stage-${stage}.png'
    if token not in text:
        errors.append('runtime terrace map path changed')
else:
    errors.append('missing Stage0Scene.ts')

if errors:
    print('FAIL — KONO 22.7.38 STAGE 0 ORIGINAL LOCK')
    for e in errors:
        print(' -', e)
    sys.exit(1)
print('PASS — KONO 22.7.38 STAGE 0 ORIGINAL LOCK')
print('All four Stage 0 phase maps match the user-supplied locked originals byte-for-byte.')
