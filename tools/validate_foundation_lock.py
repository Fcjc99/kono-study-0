from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
errors: list[str] = []

required_files = [
    ROOT / 'src/game/progression/types.ts',
    ROOT / 'src/game/progression/progressionEngine.ts',
    ROOT / 'src/game/scenes/Stage0Scene.ts',
    ROOT / 'src/components/GardenCard.tsx',
    ROOT / 'src/game/weather/liveWeather.ts',
]
for path in required_files:
    if not path.exists():
        errors.append(f'missing {path.relative_to(ROOT)}')

engine = (ROOT / 'src/game/progression/progressionEngine.ts').read_text(encoding='utf-8')
threshold_match = re.search(r'SANCTUARY_STAGE_THRESHOLDS\s*=\s*\[([^\]]+)\]', engine)
if not threshold_match:
    errors.append('stage thresholds are missing')
else:
    thresholds = [int(value.strip()) for value in threshold_match.group(1).split(',') if value.strip()]
    if thresholds != [0, 3, 8, 15, 25, 40]:
        errors.append(f'unexpected stage thresholds: {thresholds}')

scene = (ROOT / 'src/game/scenes/Stage0Scene.ts').read_text(encoding='utf-8')
if 'localStorage.getItem' in scene:
    errors.append('Stage0Scene still polls localStorage')
if 'SANCTUARY_EVENTS.progress' not in scene:
    errors.append('Stage0Scene is missing progress event integration')

app = (ROOT / 'src/App.tsx').read_text(encoding='utf-8')
checks = {
    'profile-scoped progress save': 'sanctuaryProgress:Record<string,SanctuaryProgressState>',
    'task completion hook': 'applyTaskCompletionChange',
    'profile migration': 'migrateSanctuaryProgress',
    'new profile progress': 'createSanctuaryProgress(id)',
}
for label, token in checks.items():
    if token not in app:
        errors.append(f'missing {label}')

weather = (ROOT / 'src/game/weather/liveWeather.ts').read_text(encoding='utf-8')
for token in ['CACHE_MAX_AGE_MS', 'readCachedWeather', 'writeCachedWeather', 'isValidZipCode']:
    if token not in weather:
        errors.append(f'weather safeguard missing: {token}')

package = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))
version = package.get('version', '')
if not re.fullmatch(r'0\.99\.[0-9]+-production-(?:15(?:\.[123])?|16|17(?:\.[12])?|18|19(?:\.[123])?|20(?:\.[0-9]+){0,2}|21(?:\.[0-9]+){0,2}|22(?:\.[0-9]+){0,2})', version):
    errors.append(f'package version mismatch: {version}')

if errors:
    print('\n'.join(f'ERROR: {error}' for error in errors))
    raise SystemExit(1)

print('foundation lock validation passed')
print('profiles: isolated progression saves')
print('stage thresholds: 0, 3, 8, 15, 25, 40')
print('weather cache/fallback hooks: present')
print('Stage0Scene localStorage polling: removed')
