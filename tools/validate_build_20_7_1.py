from pathlib import Path
import json
from PIL import Image
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
HOME = ROOT / 'public/garden/evolution/home'
PHASES = ('morning', 'afternoon', 'evening', 'night')
errors: list[str] = []

version_text = (ROOT / 'src/version.ts').read_text(encoding='utf-8')
package = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))
if '0.99.18-production-20.7.1' not in version_text:
    errors.append('src version is not Build 20.7.1')
if package.get('version') != '0.99.18-production-20.7.1':
    errors.append('package version is not Build 20.7.1')

for required in [
    ROOT / 'tools/repair_home_transparency.py',
    ROOT / 'docs/PRODUCTION-BUILD-20.7.1-HOME-TRANSPARENCY-QA.jpg',
    ROOT / 'docs/PRODUCTION-BUILD-20.7.1-HOME-STAGES-QA.jpg',
    ROOT / 'docs/PRODUCTION-BUILD-20.7.1-HOME-PHASES-QA.jpg',
]:
    if not required.exists():
        errors.append(f'missing Build 20.7.1 artifact: {required.name}')

for phase in PHASES:
    stage0 = Image.open(HOME / f'{phase}-stage-0.png').convert('RGBA')
    if stage0.size != (500, 450) or stage0.getchannel('A').getextrema() != (0, 0):
        errors.append(f'{phase} stage 0 changed from transparent map-painted home')

for stage in range(1, 6):
    reference_alpha = None
    for phase in PHASES:
        path = HOME / f'{phase}-stage-{stage}.png'
        if not path.exists():
            errors.append(f'missing {path.name}')
            continue
        im = Image.open(path).convert('RGBA')
        if im.size != (500, 450):
            errors.append(f'wrong size {path.name}: {im.size}')
            continue
        alpha = np.array(im.getchannel('A'))
        values = set(np.unique(alpha).tolist())
        if not values.issubset({0, 255}):
            errors.append(f'non-binary alpha fringe in {path.name}: {sorted(values)[:8]}')
        if reference_alpha is None:
            reference_alpha = alpha
            ys, xs = np.where(alpha > 0)
            if len(xs) == 0:
                errors.append(f'empty home alpha stage {stage}')
            else:
                bbox = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
                # Hotfix guardrails: the old cutout contained a left cloud fragment and
                # a vertical extraction seam at x~350.  Clean cottage masks stay inside.
                if bbox[0] < 55:
                    errors.append(f'stage {stage} still contains left scenic cutout: bbox={bbox}')
                if bbox[2] >= 350:
                    errors.append(f'stage {stage} still contains right extraction seam: bbox={bbox}')
                if bbox[1] < 40 or bbox[3] >= 320:
                    errors.append(f'stage {stage} alpha extends into scenic crop: bbox={bbox}')
        elif not np.array_equal(reference_alpha, alpha):
            errors.append(f'phase alpha mismatch at stage {stage}: {phase}')

if errors:
    raise SystemExit('build 20.7.1 validation failed: ' + '; '.join(errors))

print('production build 20.7.1 validation passed')
print('home: 20 evolved PNGs share clean binary transparency masks')
print('cutout repair: scenic cloud/grass/seam remnants removed')
print('phase alignment: identical alpha geometry across morning/afternoon/evening/night')
