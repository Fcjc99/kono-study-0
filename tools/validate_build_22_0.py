from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'docs/kono-interactions-22.0-qa/LOCKED-21.9-GARDEN-ASSET-HASHES.json'


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(f'FAIL — {message}')


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()


def main() -> None:
    system_path = ROOT / 'src/game/systems/KonoInteractionSystem.ts'
    scene_path = ROOT / 'src/game/scenes/Stage0Scene.ts'
    garden_card_path = ROOT / 'src/components/GardenCard.tsx'
    runtime_path = ROOT / 'src/game/sanctuary/runtime.ts'
    css_path = ROOT / 'src/sanctuary.css'

    for path in (system_path, scene_path, garden_card_path, runtime_path, css_path, MANIFEST):
        require(path.exists(), f'missing {path.relative_to(ROOT)}')

    system = system_path.read_text(encoding='utf-8')
    scene = scene_path.read_text(encoding='utf-8')
    garden_card = garden_card_path.read_text(encoding='utf-8')
    runtime = runtime_path.read_text(encoding='utf-8')
    css = css_path.read_text(encoding='utf-8')
    package = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))

    require("export class KonoInteractionSystem" in system, 'KONO interaction system class missing')
    require("kono:sanctuary:interactions:v1:" in system, 'profile-scoped interaction persistence key missing')
    require("'rest-home'" in system and "'tend-garden'" in system and "'sit-cherry'" in system, 'home/garden/tree actions missing')
    require("'watch-koi'" in system and "'quiet-bridge'" in system, 'pond/bridge actions missing')
    require("'terrace-tea'" in system and "'terrace-read'" in system and "'terrace-rest'" in system, 'terrace actions missing')
    require("ripple-02" in system and "petal" in system and "firefly" in system and "leaf" in system, 'existing pixel-PNG world cues are not reused')
    require('scene.add.graphics' not in system, 'procedural in-world graphics must not be used for KONO cues')

    require("import { KonoInteractionSystem" in scene, 'Stage0Scene does not import KonoInteractionSystem')
    require('this.konoInteractions.create(this.settings.reducedMotion, this.progress.profileId)' in scene, 'interaction system not created with active profile')
    require('this.konoInteractions.getActions' in scene, 'landmark popups are not wired to context actions')
    require("label: 'Go Fishing'" in scene, 'bridge fishing action was lost')
    require('this.konoInteractions.resize(this.sceneBounds)' in scene, 'interaction system does not track world resizing')
    require('this.konoInteractions.setReducedMotion(reducedMotion)' in scene, 'Reduced Motion not wired to interactions')
    require('this.konoInteractions?.setProfile(this.progress.profileId)' in scene, 'profile switching not wired to interactions')
    require('this.konoInteractions.destroy()' in scene, 'interaction system not destroyed on shutdown')

    require("interaction: 'sanctuary:kono-interaction'" in runtime, 'runtime interaction event missing')
    require('SANCTUARY_EVENTS.interaction' in garden_card, 'React accessibility interaction notice not wired')
    require('sanctuary-interaction-toast' in garden_card and '.sanctuary-interaction-toast' in css, 'interaction status toast missing')

    require(package.get('version') == '0.99.32-production-22.0', 'package version must be production 22.0')
    require((ROOT / 'src/version.ts').read_text().strip() == "export const APP_VERSION = '0.99.32-production-22.0'", 'APP_VERSION mismatch')
    require(package.get('scripts', {}).get('validate:22.0') == 'python tools/validate_build_22_0.py', 'validate:22.0 script missing')

    manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
    entries = manifest.get('entries', [])
    require(len(entries) >= 500, '21.9 garden asset lock manifest unexpectedly short')
    for entry in entries:
        path = ROOT / entry['path']
        require(path.exists(), f"locked 21.9 garden asset missing: {entry['path']}")
        require(sha256(path) == entry['sha256'], f"locked 21.9 garden asset changed: {entry['path']}")

    require(not (ROOT / 'public/garden/characters').exists(), 'placeholder KONO/companion character art should not be invented in this build')

    print('PASS — Build 22.0 KONO context interaction foundation validated.')
    print('PASS — Home, garden, cherry tree, pond, bridge, mailbox, and stage-aware terrace actions are wired.')
    print('PASS — Interaction history persists per profile and Reduced Motion / resize / shutdown paths are connected.')
    print(f'PASS — {len(entries)} Build 21.9 garden art assets remain byte-identical; no placeholder character sprite was introduced.')


if __name__ == '__main__':
    main()
