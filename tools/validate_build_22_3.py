
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
interaction = (ROOT / 'src/game/systems/KonoInteractionSystem.ts').read_text()
scene = (ROOT / 'src/game/scenes/Stage0Scene.ts').read_text()

assert "phase: DayPhase" in interaction
assert "REPEAT_GUARD_MS = 520" in interaction
assert "KONO · ${PHASE_LABEL[action.phase]} · visit ${visits}" in interaction
assert "terraceCue" in interaction
assert "phase: this.paintedPhase" in scene
assert "A Cozy Evening at Home" in interaction
assert "Quiet Night at Home" in interaction
assert "Moonlight settles over the branches." in interaction
assert "The koi move slowly beneath the moonlit water." in interaction
assert ".setScale(sceneScale * 0.62)" in interaction
assert "action.cue === 'firefly' ? 2 : 2" in interaction

version = (ROOT / 'src/version.ts').read_text() if (ROOT / 'src/version.ts').exists() else ''
assert '0.99.45-production-22.3' in version
print('Build 22.3 validation passed.')
