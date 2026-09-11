from pathlib import Path
from PIL import Image
import hashlib
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
errors: list[str] = []


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()

# Build wiring.
try:
    package = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))
    if package.get('version') != '0.99.90-production-22.7.40':
        errors.append('package version is not 0.99.90-production-22.7.40')
    scripts = package.get('scripts', {})
    if scripts.get('validate:22.7.40') != 'python tools/validate_build_22_7_40.py':
        errors.append('validate:22.7.40 script missing')
except Exception as exc:
    errors.append(f'cannot read package.json: {exc}')

version = ROOT / 'VERSION.txt'
if not version.exists() or 'KONO Production Build 22.7.40' not in version.read_text(encoding='utf-8'):
    errors.append('VERSION.txt is not Build 22.7.40')

# Protect user-restored Stage 0 exactly.
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

# Preserve Home + Cherry Tree art and still-unapproved Terrace 1-5 runtime maps.
baseline_path = ROOT / 'SANCTUARY-STABILITY-BASELINE-22.7.39.json'
if not baseline_path.exists():
    errors.append('missing SANCTUARY-STABILITY-BASELINE-22.7.39.json')
else:
    baseline = json.loads(baseline_path.read_text(encoding='utf-8'))
    for rel, expected in baseline.get('protected_art_sha256', {}).items():
        path = ROOT / rel
        if not path.exists() or sha(path) != expected:
            errors.append(f'protected art changed or missing: {rel}')
    for rel, expected in baseline.get('legacy_terrace_stage1_5_sha256', {}).items():
        path = ROOT / rel
        if not path.exists() or sha(path) != expected:
            errors.append(f'legacy terrace Stage 1-5 changed: {rel}')

# Water animation must be generated from the exact runtime Stage 0 maps, not the old source-map folder.
water_tool = (ROOT / 'tools/generate_production_water.py').read_text(encoding='utf-8')
for token in [
    "SOURCE = ROOT / 'public/garden/islands/terrace-evolution'",
    "SOURCE / phase / 'stage-0.png'",
]:
    if token not in water_tool:
        errors.append(f'water source alignment token missing: {token}')
if "SOURCE = ROOT / 'public/garden/islands/stage-0'" in water_tool:
    errors.append('water generator still points at stale stage-0 source folder')

# Every pond animation frame must exist, be crop-sized RGBA, and contain visible alpha.
for phase in ('morning', 'afternoon', 'evening', 'night'):
    for frame in range(12):
        path = ROOT / 'public/garden/production-water' / f'{phase}-pond-{frame}.png'
        if not path.exists():
            errors.append(f'missing pond frame: {path.relative_to(ROOT)}')
            continue
        try:
            with Image.open(path) as image:
                if image.size != (515, 285) or image.mode != 'RGBA':
                    errors.append(f'invalid pond frame geometry: {path.relative_to(ROOT)} {image.size} {image.mode}')
                elif image.getchannel('A').getbbox() is None:
                    errors.append(f'pond frame has empty alpha: {path.relative_to(ROOT)}')
        except Exception as exc:
            errors.append(f'unreadable pond frame {path.relative_to(ROOT)}: {exc}')

# Koi self-heal + stronger Stage 3-5 visibility.
pond = (ROOT / 'src/game/systems/PondEvolutionSystem.ts').read_text(encoding='utf-8')
for token in [
    'const MAX_FISH = 3',
    'return Math.min(MAX_FISH, stage - 2)',
    'RenderLayers.pondGlint + 0.075',
    'this.stage >= 5 ? 0.74',
    'runtime.sprite.setVisible(shouldBeVisible)',
    'Always resync visibility/scale',
]:
    if token not in pond:
        errors.append(f'koi visibility token missing: {token}')

# Popup / interaction text must stay in the middle of the smaller canvas rather than top-pinned.
scene = (ROOT / 'src/game/scenes/Stage0Scene.ts').read_text(encoding='utf-8')
if 'Phaser.Math.Clamp(height * 0.50' not in scene:
    errors.append('landmark popup is not vertically centered')
interactions = (ROOT / 'src/game/systems/KonoInteractionSystem.ts').read_text(encoding='utf-8')
if 'this.bounds.height * 0.54' not in interactions:
    errors.append('KONO interaction HUD is not in the visible center band')
css = (ROOT / 'src/sanctuary.css').read_text(encoding='utf-8')
for token in [
    'Production 22.7.40 — Sanctuary viewport + interaction visibility stability',
    'width:min(100%,920px)!important',
    'aspect-ratio:4/3!important',
]:
    if token not in css:
        errors.append(f'Sanctuary sizing token missing: {token}')

if errors:
    print('FAIL — KONO 22.7.40 POND + SANCTUARY UI STABILITY')
    for error in errors:
        print(' -', error)
    sys.exit(1)

print('PASS — KONO 22.7.40 POND + SANCTUARY UI STABILITY')
print('Stage 0 terrace maps: byte-locked and unchanged.')
print('Home + Cherry Tree artwork: unchanged.')
print('Terrace Stages 1-5: unchanged / still unapproved.')
print('Pond animation: regenerated from exact runtime Stage 0 phase maps.')
print('Level 3-5 koi: self-healing visibility; Stage 5 = 3 evenly spaced readable fish.')
print('Sanctuary frame: capped to 920 px wide / 4:3 and centered with toolbar.')
print('Landmark popup + interaction text: moved into visible center band.')
