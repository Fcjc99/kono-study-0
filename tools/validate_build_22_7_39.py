from pathlib import Path
from PIL import Image
import hashlib
import json
import math
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
errors: list[str] = []


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


# Version / package wiring.
try:
    package = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))
    if package.get('version') != '0.99.89-production-22.7.39':
        errors.append('package version is not 0.99.89-production-22.7.39')
    scripts = package.get('scripts', {})
    if scripts.get('validate:22.7.39') != 'python tools/validate_build_22_7_39.py':
        errors.append('validate:22.7.39 script missing')
except Exception as exc:
    errors.append(f'cannot read package.json: {exc}')

version = (ROOT / 'VERSION.txt')
if not version.exists() or 'KONO Production Build 22.7.39' not in version.read_text(encoding='utf-8'):
    errors.append('VERSION.txt is not Build 22.7.39')

# Stage 0 lock must still pass exactly.
stage0_manifest = ROOT / 'STAGE0-LOCK-22.7.38.json'
if not stage0_manifest.exists():
    errors.append('missing STAGE0-LOCK-22.7.38.json')
else:
    data = json.loads(stage0_manifest.read_text(encoding='utf-8'))
    for phase, info in data.get('phases', {}).items():
        for field in ('runtime_path', 'locked_source_path'):
            path = ROOT / info[field]
            if not path.exists():
                errors.append(f'{phase}: missing {field}')
                continue
            if sha(path) != info['sha256']:
                errors.append(f'{phase}: Stage 0 hash changed at {info[field]}')
            try:
                with Image.open(path) as image:
                    if image.size != (1448, 1086):
                        errors.append(f'{phase}: Stage 0 dimensions changed: {image.size}')
            except Exception as exc:
                errors.append(f'{phase}: unreadable Stage 0 PNG: {exc}')

# Protect Home + Cherry Tree art and preserve the untouched legacy terrace 1-5 files.
baseline_path = ROOT / 'SANCTUARY-STABILITY-BASELINE-22.7.39.json'
if not baseline_path.exists():
    errors.append('missing SANCTUARY-STABILITY-BASELINE-22.7.39.json')
else:
    baseline = json.loads(baseline_path.read_text(encoding='utf-8'))
    for rel, expected in baseline.get('protected_art_sha256', {}).items():
        path = ROOT / rel
        if not path.exists():
            errors.append(f'protected art missing: {rel}')
        elif sha(path) != expected:
            errors.append(f'protected art changed: {rel}')
    for rel, expected in baseline.get('legacy_terrace_stage1_5_sha256', {}).items():
        path = ROOT / rel
        if not path.exists():
            errors.append(f'legacy terrace runtime missing: {rel}')
        elif sha(path) != expected:
            errors.append(f'legacy terrace Stage 1-5 changed during stability pass: {rel}')

# True reset behavior is wired at migration, final-reopen, and sync boundaries.
progress = (ROOT / 'src/game/progression/progressionEngine.ts').read_text(encoding='utf-8')
required_progress_tokens = [
    'if (profileTasks.length > 0 && currentCompletedTaskIds.length === 0)',
    'if (!change.completed && current.size === 0)',
    'return createSanctuaryProgress(state.profileId, completedAt)',
    'Object.values(state.featureStages).some((stage) => stage > 0)',
]
for token in required_progress_tokens:
    if token not in progress:
        errors.append(f'missing reset guard: {token}')

app = (ROOT / 'src/App.tsx').read_text(encoding='utf-8')
if 'When every assignment in the profile is reopened, the Sanctuary resets to Stage 0.' not in app:
    errors.append('Subjects reopen-all copy does not describe the Stage 0 reset')

# Mascot spawn/path safety.
mascot = (ROOT / 'src/game/systems/KonoMascotSystem.ts').read_text(encoding='utf-8')
if "const DEFAULT_SPAWN_NODE: NavNodeId = 'west-junction'" not in mascot:
    errors.append('KONO default spawn is not west-junction')
if 'private position = { ...NAV_NODES[DEFAULT_SPAWN_NODE] }' not in mascot:
    errors.append('KONO position does not use the verified spawn node')
if 'this.ensureSafePosition()' not in mascot or 'private ensureSafePosition(): void' not in mascot:
    errors.append('KONO runtime safe-position recovery is missing')
if 'private position = { x: 0.455, y: 0.600 }' in mascot:
    errors.append('old invalid pond spawn still present')

nodes = {
    'house': (.282,.525), 'mailbox': (.312,.500), 'garden': (.250,.650), 'west-junction': (.392,.555),
    'north-west': (.420,.492), 'north-center': (.545,.474), 'cherry': (.500,.365), 'terrace-entry': (.680,.485),
    'lanterns': (.748,.455), 'pond-north': (.575,.545), 'pond-west': (.390,.650), 'pond-south-west': (.425,.715),
    'bridge': (.505,.755), 'pond-south-east': (.670,.735), 'pond-east': (.720,.640),
}
graph = {
    'house':['mailbox','west-junction','garden'], 'mailbox':['house','west-junction'], 'garden':['house','pond-west'],
    'west-junction':['house','mailbox','north-west','pond-west'], 'north-west':['west-junction','north-center'],
    'north-center':['north-west','cherry','pond-north','terrace-entry'], 'cherry':['north-center'],
    'terrace-entry':['north-center','lanterns','pond-east'], 'lanterns':['terrace-entry'], 'pond-north':['north-center'],
    'pond-west':['garden','west-junction','pond-south-west'], 'pond-south-west':['pond-west','bridge'],
    'bridge':['pond-south-west','pond-south-east'], 'pond-south-east':['bridge','pond-east'],
    'pond-east':['pond-south-east','terrace-entry'],
}
cx, cy, rx, ry = .555, .635, .155, .085

def safe(point: tuple[float,float]) -> bool:
    x,y = point
    if x < .18 or x > .82 or y < .30 or y > .80:
        return False
    nx=(x-cx)/rx
    ny=(y-cy)/ry
    return nx*nx+ny*ny >= 1

if not safe(nodes['west-junction']):
    errors.append('new KONO spawn is not outside pond exclusion')
seen: set[tuple[str,str]] = set()
for a, bs in graph.items():
    for b in bs:
        edge = tuple(sorted((a,b)))
        if edge in seen:
            continue
        seen.add(edge)
        pa,pb=nodes[a],nodes[b]
        for i in range(201):
            t=i/200
            point=(pa[0]+(pb[0]-pa[0])*t, pa[1]+(pb[1]-pa[1])*t)
            if not safe(point):
                errors.append(f'KONO nav edge crosses pond: {a}->{b} at {point}')
                break

# Koi runtime and assets.
pond = (ROOT / 'src/game/systems/PondEvolutionSystem.ts').read_text(encoding='utf-8')
for token in [
    'const MAX_FISH = 3',
    'return Math.min(MAX_FISH, stage - 2)',
    'RenderLayers.pondGlint + 0.015',
    "this.stage >= 5 ? 0.70",
    "if (environment.phase === 'night') return 0.82",
    'speed: [0.0000200, 0.0000170, 0.0000140]',
]:
    if token not in pond:
        errors.append(f'koi stability token missing: {token}')

assets = ROOT / 'public/garden/evolution/pond'
koi_count=0
for variant in ('orange-white','red-white','gold-black'):
    for direction in range(8):
        for frame in range(2):
            path=assets / f'koi-{variant}-d{direction}-f{frame}.png'
            if not path.exists():
                errors.append(f'missing koi frame: {path.relative_to(ROOT)}')
                continue
            try:
                with Image.open(path) as image:
                    if image.size != (64,64) or image.mode != 'RGBA' or image.getchannel('A').getbbox() is None:
                        errors.append(f'invalid koi frame: {path.relative_to(ROOT)}')
            except Exception as exc:
                errors.append(f'unreadable koi frame {path.relative_to(ROOT)}: {exc}')
            koi_count += 1
if koi_count != 48:
    errors.append(f'expected 48 koi frames, found {koi_count}')

if errors:
    print('FAIL — KONO 22.7.39 SANCTUARY STABILITY REPAIR')
    for error in errors:
        print(' -', error)
    sys.exit(1)

print('PASS — KONO 22.7.39 SANCTUARY STABILITY REPAIR')
print('Stage 0 terrace: locked and byte-identical.')
print('Home + Cherry Tree art: preserved byte-identical to 22.7.38.')
print('Legacy Terrace Stages 1-5: unchanged / still unapproved.')
print('Reopen-all reset guards: migration + runtime + sync present.')
print('KONO spawn/path graph: safe; no pond-crossing edges.')
print('Level 5 koi: 3 fish, 48 valid frames, visibility/scale/swim repair present.')
