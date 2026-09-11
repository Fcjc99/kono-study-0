from pathlib import Path
from PIL import Image
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
HOME = ROOT / 'public/garden/evolution/home'
PHASES = ('morning', 'afternoon', 'evening', 'night')
errors: list[str] = []

required = [
    ROOT / 'tools/build_home_20_8_2.py',
    HOME / 'source/approved-stage-5-same-orientation-master.png',
    ROOT / 'docs/PRODUCTION-BUILD-20.8.2-HOME-STAGES-QA.jpg',
    ROOT / 'docs/PRODUCTION-BUILD-20.8.2-HOME-PHASES-QA.jpg',
    ROOT / 'docs/PRODUCTION-BUILD-20.8.2-HOME-ORIENTATION-QA.png',
]
for path in required:
    if not path.exists():
        errors.append(f'missing required Build 20.8.2 file: {path.relative_to(ROOT)}')

for phase in PHASES:
    s4 = Image.open(HOME / f'{phase}-stage-4.png').convert('RGBA')
    s5 = Image.open(HOME / f'{phase}-stage-5.png').convert('RGBA')
    if s4.size != (500, 450) or s5.size != (500, 450):
        errors.append(f'{phase}: home canvas is not 500x450')
        continue
    a4 = np.array(s4.getchannel('A'))
    a5 = np.array(s5.getchannel('A'))
    b4 = s4.getchannel('A').getbbox()
    b5 = s5.getchannel('A').getbbox()
    if not b4 or not b5:
        errors.append(f'{phase}: missing Stage 4/5 alpha')
        continue
    # The exact Stage 4 footprint must remain covered by Stage 5, eliminating
    # regressions where the baked Stage 0 roof/steps became visible again.
    if np.any((a4 > 0) & (a5 == 0)):
        errors.append(f'{phase}: Stage 5 lost pixels from Stage 4 core coverage')
    if b5[0] != b4[0] or b5[1] != b4[1] or b5[3] != b4[3]:
        errors.append(f'{phase}: Stage 5 moved the locked left/top/ground anchors: {b4} -> {b5}')
    w4 = b4[2] - b4[0]
    w5 = b5[2] - b5[0]
    if w5 < round(w4 * 1.15):
        errors.append(f'{phase}: Stage 5 did not expand outward enough ({w4} -> {w5})')
    border = np.concatenate([a5[0], a5[-1], a5[:,0], a5[:,-1]])
    if np.any(border > 0):
        errors.append(f'{phase}: Stage 5 alpha touches canvas border')

# Stage 0 remains map-painted/transparent overlay.
for phase in PHASES:
    s0 = Image.open(HOME / f'{phase}-stage-0.png').convert('RGBA')
    if s0.getchannel('A').getbbox() is not None:
        errors.append(f'{phase}: Stage 0 overlay is no longer transparent')

home_system = (ROOT / 'src/game/systems/HomeEvolutionSystem.ts').read_text(encoding='utf-8')
for token in ['Build 20.8.2', 'preserves the Stage 4 core footprint', 'expands outward']:
    if token not in home_system:
        errors.append(f'HomeEvolutionSystem documentation missing: {token}')

pkg = (ROOT / 'package.json').read_text(encoding='utf-8')
if 'build_home_20_8_2.py' not in pkg or 'validate_build_20_8_2.py' not in pkg:
    errors.append('package scripts are not wired to Build 20.8.2')

if errors:
    raise SystemExit('Build 20.8.2 validation failed:\n- ' + '\n- '.join(errors))

print('Build 20.8.2 validation passed')
print('Stage 5 preserves 100% of Stage 4 alpha coverage and expands outward >=15%')
print('Stage 5 keeps the locked left/top/ground anchors and 500x450 transparent pixel-PNG canvas')
print('Stage 0 remains map-painted; no re-oriented Stage 5 reference is active')
