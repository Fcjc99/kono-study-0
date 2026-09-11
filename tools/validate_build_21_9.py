from __future__ import annotations

import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / 'public/garden/evolution/bridge-fishing'
QA_DIR = ROOT / 'docs/bridge-fishing-21.9-qa'


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(f'FAIL — {message}')


def validate_sprite(name: str) -> None:
    path = ASSET_DIR / name
    require(path.exists(), f'missing {path.relative_to(ROOT)}')
    with Image.open(path) as image:
        require(image.size == (1448, 1086), f'{name} must be 1448×1086; found {image.size}')
        require(image.mode == 'RGBA', f'{name} must be RGBA; found {image.mode}')
        alpha = image.getchannel('A')
        bbox = alpha.getbbox()
        require(bbox is not None, f'{name} is fully transparent')
        nonzero = sum(alpha.histogram()[1:])
        require(40 <= nonzero <= 5000, f'{name} footprint is unexpectedly large/small: {nonzero} opaque pixels')
        left, top, right, bottom = bbox
        require(700 <= left <= 780 and 730 <= top <= 800, f'{name} left/top registration drifted: {bbox}')
        require(810 <= right <= 860 and 840 <= bottom <= 960, f'{name} right/bottom registration drifted: {bbox}')


def main() -> None:
    validate_sprite('bridge-fishing-idle.png')
    validate_sprite('bridge-fishing-cast.png')

    scene = (ROOT / 'src/game/scenes/Stage0Scene.ts').read_text()
    fishing = (ROOT / 'src/game/systems/FishingSystem.ts').read_text()
    runtime = (ROOT / 'src/game/sanctuary/runtime.ts').read_text()
    package = json.loads((ROOT / 'package.json').read_text())

    require("import { FishingSystem } from '../systems/FishingSystem'" in scene, 'Stage0Scene must import FishingSystem')
    require('FishingSystem.preload(this)' in scene, 'Stage0Scene must preload fishing PNGs')
    require('this.fishing.create(this.settings.reducedMotion, this.progress.profileId)' in scene, 'FishingSystem must be created with the active profile')
    require("landmark.id === 'bridge' && this.fishing.handleBridgePress()" in scene, 'bridge presses must route into the fishing interaction')
    require("'Go Fishing'" in scene, 'bridge popup must expose Go Fishing action')
    require("bridge-fishing-idle" in fishing and "bridge-fishing-cast" in fishing, 'FishingSystem must use both bridge fishing PNG states')
    require("type FishingState = 'idle' | 'waiting' | 'bite' | 'result'" in fishing, 'fishing state machine is incomplete')
    require('Tap the bridge to reel in!' in fishing, 'bite/reel interaction copy is missing')
    require('window.localStorage.setItem' in fishing, 'catch stats must persist per profile')
    require("fishing: 'sanctuary:fishing-event'" in runtime, 'runtime fishing event is missing')
    require(package.get('version') in {'0.99.31-production-21.9', '0.99.32-production-22.0'}, 'package version must be production 21.9 or its locked 22.0 successor')
    require(package.get('scripts', {}).get('validate:21.9') == 'python tools/validate_build_21_9.py', 'validate:21.9 package script missing')

    for qa in ('qa-afternoon-idle.png', 'qa-afternoon-cast.png', 'qa-night-idle.png', 'qa-night-cast.png'):
        require((QA_DIR / qa).exists(), f'missing QA image {qa}')

    manifest_path = QA_DIR / 'LOCKED-21.8-ASSET-HASHES.json'
    require(manifest_path.exists(), 'locked 21.8 hash manifest missing')
    manifest = json.loads(manifest_path.read_text())
    entries = manifest.get('entries', [])
    require(len(entries) >= 100, 'locked hash manifest unexpectedly short')
    for entry in entries:
        path = ROOT / entry['path']
        require(path.exists(), f"locked file missing: {entry['path']}")
        require(sha256(path) == entry['sha256'], f"locked 21.8 file changed: {entry['path']}")

    print('PASS — Build 21.9 bridge fishing functionality validated.')
    print(f'PASS — {len(entries)} locked 21.8 terrace/pond/critters/base-map files remain byte-identical.')
    print('PASS — Fishing PNGs are transparent full-map registered overlays with a compact bridge-only footprint.')
    print('PASS — Cast → wait → bite → reel/miss loop, per-profile catch persistence, and bridge popup action are wired.')


if __name__ == '__main__':
    main()
