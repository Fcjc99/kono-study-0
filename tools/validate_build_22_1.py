#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
from hashlib import sha256
import json
import re

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PHASES = ('morning', 'afternoon', 'evening', 'night')
VERSION = '0.99.33-production-22.1'
errors: list[str] = []


def rgba(path: Path) -> Image.Image:
    if not path.exists():
        errors.append(f'missing asset: {path.relative_to(ROOT)}')
        return Image.new('RGBA', (1, 1))
    try:
        return Image.open(path).convert('RGBA')
    except Exception as exc:
        errors.append(f'unreadable asset {path.relative_to(ROOT)}: {exc}')
        return Image.new('RGBA', (1, 1))


def digest(path: Path) -> str:
    return sha256(path.read_bytes()).hexdigest()


# --- Version / release identity ---
package = json.loads((ROOT / 'package.json').read_text())
if package.get('version') != VERSION:
    errors.append(f'package version is {package.get("version")!r}, expected {VERSION!r}')
if VERSION not in (ROOT / 'src/version.ts').read_text():
    errors.append('src/version.ts does not expose Build 22.1')

# --- Base painted island remains source of truth ---
lock_path = ROOT / 'docs/kono-interactions-22.0-qa/LOCKED-21.9-GARDEN-ASSET-HASHES.json'
if not lock_path.exists():
    errors.append('missing locked 21.9 garden hash manifest')
else:
    lock = json.loads(lock_path.read_text())
    by_path = {entry['path']: entry['sha256'] for entry in lock.get('entries', [])}
    for phase in PHASES:
        rel = f'public/garden/islands/stage-0/stage0-{phase}.png'
        p = ROOT / rel
        if not p.exists():
            errors.append(f'missing Stage 0 phase map: {rel}')
        elif by_path.get(rel) != digest(p):
            errors.append(f'Stage 0 phase map changed instead of being repaired by overlays: {rel}')

# --- Home: afternoon is geometry master for every phase ---
home_dir = ROOT / 'public/garden/evolution/home'
for stage in range(1, 6):
    master = rgba(home_dir / f'afternoon-stage-{stage}.png')
    if master.size != (500, 450):
        errors.append(f'home stage {stage} afternoon canvas is {master.size}, expected 500x450')
        continue
    master_alpha = np.asarray(master.getchannel('A'))
    master_bbox = master.getchannel('A').getbbox()
    if master_bbox is None:
        errors.append(f'home stage {stage} afternoon sprite is empty')
        continue
    x0, y0, x1, y1 = master_bbox
    if x0 <= 0 or y0 <= 0 or x1 >= 500 or y1 >= 450:
        errors.append(f'home stage {stage} lacks safe transparent padding: {master_bbox}')
    for phase in PHASES:
        image = rgba(home_dir / f'{phase}-stage-{stage}.png')
        if image.size != (500, 450):
            errors.append(f'home {phase} stage {stage} wrong size: {image.size}')
            continue
        alpha = np.asarray(image.getchannel('A'))
        if not np.array_equal(alpha, master_alpha):
            errors.append(f'home {phase} stage {stage} alpha/silhouette is shifted or clipped versus afternoon')

# Stage 0 home overlays stay transparent.
for phase in PHASES:
    image = rgba(home_dir / f'{phase}-stage-0.png')
    if image.size != (500, 450) or image.getchannel('A').getbbox() is not None:
        errors.append(f'home {phase} stage 0 must remain a transparent 500x450 overlay')

# --- Approved Option B vegetable garden, readable and phase-locked ---
garden_source = home_dir / 'source/approved-vegetable-garden-option-b.png'
if not garden_source.exists():
    errors.append('approved Option B vegetable-garden source is missing')
else:
    source = rgba(garden_source)
    if source.getchannel('A').getbbox() is None:
        errors.append('approved Option B vegetable-garden source is empty')

garden_dir = home_dir / 'decor'
garden_alpha_master = None
for phase in PHASES:
    p = garden_dir / f'vegetable-garden-stage5-{phase}.png'
    image = rgba(p)
    if image.size != (500, 450):
        errors.append(f'vegetable garden {phase} wrong canvas: {image.size}')
        continue
    alpha = np.asarray(image.getchannel('A'))
    bbox = image.getchannel('A').getbbox()
    if bbox is None:
        errors.append(f'vegetable garden {phase} is empty')
        continue
    x0, y0, x1, y1 = bbox
    if x0 < 20 or y0 < 20 or x1 > 480 or y1 > 430:
        errors.append(f'vegetable garden {phase} lacks safe canvas padding: {bbox}')
    if x1 - x0 < 105:
        errors.append(f'vegetable garden {phase} is too small to match approved readable Option B reference: {bbox}')
    if garden_alpha_master is None:
        garden_alpha_master = alpha
    elif not np.array_equal(alpha, garden_alpha_master):
        errors.append(f'vegetable garden {phase} silhouette shifts between phases')

# --- Lantern terrace: one exact footprint across all four phases ---
lantern_dir = ROOT / 'public/garden/evolution/lanterns'
for stage in range(6):
    alpha_master = None
    for phase in PHASES:
        p = lantern_dir / f'phases/{phase}/terrace-stage-{stage}.png'
        image = rgba(p)
        if image.size != (1448, 1086):
            errors.append(f'terrace {phase} stage {stage} wrong size: {image.size}')
            continue
        alpha = np.asarray(image.getchannel('A'))
        bbox = image.getchannel('A').getbbox()
        if stage == 0 and bbox is not None:
            errors.append(f'terrace {phase} Stage 0 overlay must remain transparent')
        if stage > 0 and bbox is None:
            errors.append(f'terrace {phase} stage {stage} is empty')
        if alpha_master is None:
            alpha_master = alpha
        elif not np.array_equal(alpha, alpha_master):
            errors.append(f'terrace stage {stage} {phase} silhouette shifted versus morning')
    for light_phase in ('evening', 'night'):
        p = lantern_dir / f'emissive/{light_phase}-stage-{stage}.png'
        image = rgba(p)
        if image.size != (1448, 1086):
            errors.append(f'{light_phase} terrace emissive stage {stage} wrong size: {image.size}')
        bbox = image.getchannel('A').getbbox()
        if stage == 0 and bbox is not None:
            errors.append(f'{light_phase} terrace Stage 0 emissive must remain transparent')
        if stage >= 2 and bbox is None:
            errors.append(f'{light_phase} terrace emissive stage {stage} is empty')

# --- Fishing: approved-style registered full-map overlays for every phase ---
fishing_dir = ROOT / 'public/garden/evolution/bridge-fishing'
for source_name in ('stage0-night-bridge-crop.png', 'approved-bridge-fishing-reference.png'):
    if not (fishing_dir / 'source' / source_name).exists():
        errors.append(f'missing fishing registration source: {source_name}')
for phase in PHASES:
    for state in ('idle', 'cast'):
        p = fishing_dir / f'phases/{phase}/bridge-fishing-{state}.png'
        image = rgba(p)
        if image.size != (1448, 1086):
            errors.append(f'fishing {phase} {state} wrong size: {image.size}')
            continue
        bbox = image.getchannel('A').getbbox()
        if bbox is None:
            errors.append(f'fishing {phase} {state} is empty')
        elif not (470 <= bbox[0] <= 560 and 680 <= bbox[1] <= 760 and 790 <= bbox[2] <= 880 and 860 <= bbox[3] <= 970):
            errors.append(f'fishing {phase} {state} escaped approved bridge registration area: {bbox}')

# --- Runtime synchronization & compile repair locks ---
scene_text = (ROOT / 'src/game/scenes/Stage0Scene.ts').read_text()
home_text = (ROOT / 'src/game/systems/HomeEvolutionSystem.ts').read_text()
lantern_text = (ROOT / 'src/game/systems/LanternEvolutionSystem.ts').read_text()
fishing_text = (ROOT / 'src/game/systems/FishingSystem.ts').read_text()
pond_text = (ROOT / 'src/game/systems/PondEvolutionSystem.ts').read_text()
kono_text = (ROOT / 'src/game/systems/KonoInteractionSystem.ts').read_text()

for token in (
    'syncRegisteredPhaseArt(phase)',
    'this.homeEvolution?.setPhase(phase)',
    'this.lanternEvolution?.setPhase(phase)',
    'this.fishing?.setPhase(phase)',
):
    if token not in scene_text:
        errors.append(f'missing coordinated phase-sync token: {token}')
if 'this.homeEvolution.setPhase(nextBlend.dominant)' in scene_text:
    errors.append('old early Home phase swap remains and can expose Stage 0 roofline during phase transition')
if 'this.swapTo(textureKey(phase, this.stage), visibleAlpha(this.stage), 0)' not in home_text:
    errors.append('Home phase swap is not immediate with painted-map synchronization')
if 'TERRACE_PHASES' not in lantern_text or 'emissive/night-stage-' not in lantern_text or 'setPhase(phase: DayPhase)' not in lantern_text:
    errors.append('four-phase terrace runtime integration is incomplete')
if 'FISHING_PHASES' not in fishing_text or '/bridge-fishing/phases/${phase}/' not in fishing_text or 'setPhase(phase: DayPhase)' not in fishing_text:
    errors.append('four-phase fishing runtime integration is incomplete')

# Compile-error regressions reported in Build 22.0.
if re.search(r'constructor\s*\(\s*(private|public|protected)\b', fishing_text + kono_text):
    errors.append('erasableSyntaxOnly-incompatible constructor parameter property remains')
if 'type KoiPoint = readonly [number, number]' not in pond_text:
    errors.append('readonly koi tuple compile fix is missing')
if 'const alphaObject = object as Phaser.GameObjects.GameObject & { setAlpha?:' not in scene_text:
    errors.append('safe popup setAlpha typing fix is missing')

# Preserve koi progression and safe-path semantics.
for token in ('MAX_FISH = 3', 'return Math.min(MAX_FISH, stage - 2)', 'KOI_SWIM_PATHS', 'sampleSwimPath'):
    if token not in pond_text:
        errors.append(f'pond/koi preservation token missing: {token}')

# Fishing functionality and KONO interactions survive the visual repair.
for token in ("state: FishingState = 'idle'", 'FISHING_STORAGE_PREFIX', 'beginBite', 'resolveCatch', 'finishSession'):
    if token not in fishing_text:
        errors.append(f'fishing functionality missing after visual repair: {token}')
if "label: 'Go Fishing'" not in scene_text or 'this.fishing.start()' not in scene_text:
    errors.append('bridge Go Fishing interaction is missing after visual repair')
for token in ('KonoInteractionSystem', 'Have Tea', 'Read', 'Rest'):
    if token not in scene_text + kono_text + lantern_text:
        errors.append(f'KONO interaction preservation token missing: {token}')

if errors:
    print('Build 22.1 visual repair validation FAILED')
    for error in errors:
        print('-', error)
    raise SystemExit(1)

print('Build 22.1 visual repair validation PASS')
print('- Stage 0 painted phase maps remain byte-locked')
print('- Home phases share the exact afternoon silhouette and safe padding')
print('- Approved Option B vegetable garden is phase-locked and readable')
print('- Terrace Stages 0-5 share one footprint across morning/afternoon/evening/night')
print('- Evening/night terrace emissive passes are present')
print('- Fishing art is registered to the approved bridge area in all four phases')
print('- Painted map + Home + terrace + fishing phase changes are frame-synchronized')
print('- Reported TypeScript compile patterns are repaired; koi/fishing/interactions preserved')
