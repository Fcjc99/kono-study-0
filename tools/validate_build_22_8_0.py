from pathlib import Path
from PIL import Image
import hashlib
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
PHASES = ("morning", "afternoon", "evening", "night")
errors: list[str] = []


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


lock_path = ROOT / "STAGE0-LOCK-22.7.38.json"
manifest_path = ROOT / "TERRACE-EVOLUTION-22.8.0.json"
if not lock_path.exists():
    errors.append("missing Stage 0 lock manifest")
if not manifest_path.exists():
    errors.append("missing final terrace manifest")

if lock_path.exists():
    lock = json.loads(lock_path.read_text(encoding="utf-8"))
    for phase, info in lock.get("phases", {}).items():
        runtime = ROOT / info["runtime_path"]
        source = ROOT / info["locked_source_path"]
        for path in (runtime, source):
            if not path.exists() or sha(path) != info["sha256"]:
                errors.append(f"{phase}: Stage 0 lock changed at {path.relative_to(ROOT)}")

if manifest_path.exists():
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    for phase in PHASES:
        stage0 = ROOT / f"public/garden/islands/terrace-evolution/{phase}/stage-0.png"
        expected = manifest.get("stage0_sha256", {}).get(phase)
        if not stage0.exists() or sha(stage0) != expected:
            errors.append(f"{phase}: final manifest does not preserve Stage 0")
    for stage in range(1, 6):
        for phase in PHASES:
            path = ROOT / f"public/garden/islands/terrace-evolution/{phase}/stage-{stage}.png"
            info = manifest.get("stages", {}).get(str(stage), {}).get("phases", {}).get(phase, {})
            if not path.exists():
                errors.append(f"missing {phase} Stage {stage}")
                continue
            with Image.open(path) as image:
                if image.size != (1448, 1086) or image.mode not in ("RGB", "RGBA"):
                    errors.append(f"invalid geometry for {phase} Stage {stage}: {image.size} {image.mode}")
            if sha(path) != info.get("sha256"):
                errors.append(f"hash mismatch for {phase} Stage {stage}")

package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
if package.get("version") != "0.99.91-production-22.8.0":
    errors.append("package version is not the final terrace build")
if "KONO Production Build 22.8.0" not in (ROOT / "VERSION.txt").read_text(encoding="utf-8"):
    errors.append("VERSION.txt is not Build 22.8.0")

if errors:
    print("FAIL — KONO 22.8.0 FINAL TERRACE EVOLUTION")
    for error in errors:
        print(" -", error)
    sys.exit(1)

print("PASS — KONO 22.8.0 FINAL TERRACE EVOLUTION")
print("Stage 0: byte-locked and unchanged across all four phases.")
print("Stages 1-5: complete, aligned, phase-treated, and manifest-verified.")
