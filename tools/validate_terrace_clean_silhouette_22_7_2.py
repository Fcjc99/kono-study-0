from pathlib import Path
from PIL import Image
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
PHASE_ROOT = ROOT / 'public/garden/evolution/lanterns/phases'

problems = []
for phase in ['morning','afternoon','evening','night']:
    for stage in range(0,6):
        path = PHASE_ROOT / phase / f'terrace-stage-{stage}.png'
        if not path.exists():
            problems.append(f'missing: {path.relative_to(ROOT)}')
            continue
        arr = np.array(Image.open(path).convert('RGBA'))
        alpha = arr[:,:,3]
        opaque = alpha > 0
        bad_black = opaque & (arr[:,:,:3].max(axis=2) <= 5)
        if bad_black.any():
            problems.append(f'opaque black contamination: {phase} stage {stage}: {int(bad_black.sum())} px')
        # Runtime assets must stay on the full 1448x1086 Sanctuary canvas.
        if (arr.shape[1], arr.shape[0]) != (1448,1086):
            problems.append(f'wrong canvas: {phase} stage {stage}: {(arr.shape[1],arr.shape[0])}')
        bbox = Image.fromarray(alpha).getbbox()
        if stage > 0 and bbox is None:
            problems.append(f'empty terrace: {phase} stage {stage}')
        if bbox:
            x0,y0,x1,y1=bbox
            if not (900 <= x0 <= 1030 and 320 <= y0 <= 430 and 1200 <= x1 <= 1300 and 500 <= y1 <= 540):
                problems.append(f'out-of-map-fit bbox: {phase} stage {stage}: {bbox}')

if problems:
    raise SystemExit('\n'.join(problems))
print('terrace clean-silhouette validation passed: no opaque black contamination; map-fit canvas/bounds valid')
