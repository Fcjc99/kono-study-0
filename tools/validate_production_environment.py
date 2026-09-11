from __future__ import annotations

from pathlib import Path
import json
import sys

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
WATER = ROOT / 'public/garden/production-water'
ISLANDS = ROOT / 'public/garden/islands/stage-0'
SOURCE_PHASES = ('morning', 'afternoon', 'evening', 'night')
RUNTIME_PHASES = SOURCE_PHASES
LAYERS = {
    'ocean': (1448, 666, 12),
    'pond': (515, 285, 12),
    'waterfall': (145, 215, 12),
    'foam': (195, 100, 12),
}


def fail(message: str, errors: list[str]) -> None:
    errors.append(message)


def rgba(path: Path) -> np.ndarray:
    return np.array(Image.open(path).convert('RGBA'))


def mean_frame_delta(frames: list[np.ndarray]) -> float:
    deltas: list[float] = []
    for left, right in zip(frames, frames[1:] + frames[:1]):
        active = (left[..., 3] > 8) | (right[..., 3] > 8)
        if not np.any(active):
            deltas.append(0.0)
            continue
        rgb_delta = np.abs(left[..., :3].astype(np.int16) - right[..., :3].astype(np.int16)).mean(axis=2)
        alpha_delta = np.abs(left[..., 3].astype(np.int16) - right[..., 3].astype(np.int16))
        deltas.append(float((rgb_delta[active] + alpha_delta[active] * 0.25).mean()))
    return float(np.mean(deltas))


def main() -> int:
    errors: list[str] = []
    report: dict[str, object] = {'sources': {}, 'runtime': {}, 'summary': {}}

    for phase in SOURCE_PHASES:
        source = ISLANDS / f'stage0-{phase}.png'
        source_report: dict[str, object] = {'exists': source.exists()}
        if not source.exists():
            fail(f'missing source scene: {source}', errors)
        else:
            with Image.open(source) as image:
                source_report['size'] = image.size
                if image.size != (1448, 1086):
                    fail(f'{source.name}: expected 1448x1086, found {image.size}', errors)
        report['sources'][phase] = source_report

    for phase in RUNTIME_PHASES:
        phase_report: dict[str, object] = {}
        for layer, (width, height, count) in LAYERS.items():
            arrays: list[np.ndarray] = []
            alpha_bboxes: list[tuple[int, int, int, int] | None] = []
            for frame in range(count):
                path = WATER / f'{phase}-{layer}-{frame}.png'
                if not path.exists():
                    fail(f'missing fluid frame: {path.name}', errors)
                    continue
                image = rgba(path)
                if (image.shape[1], image.shape[0]) != (width, height):
                    fail(f'{path.name}: expected {width}x{height}, found {image.shape[1]}x{image.shape[0]}', errors)
                if image[..., 3].max() == 0:
                    fail(f'{path.name}: frame is fully transparent', errors)
                alpha = image[..., 3]
                points = cv2.findNonZero((alpha > 8).astype(np.uint8))
                bbox = cv2.boundingRect(points) if points is not None else None
                alpha_bboxes.append(bbox)
                arrays.append(image)

            if len(arrays) == count:
                delta = mean_frame_delta(arrays)
                if layer in ('ocean', 'pond') and not (0.22 <= delta <= 7.5):
                    fail(f'{phase} {layer}: frame delta {delta:.3f} is outside calm-motion range', errors)
                if layer == 'waterfall' and not (0.45 <= delta <= 13.0):
                    fail(f'{phase} waterfall: frame delta {delta:.3f} is outside flow range', errors)
                if layer == 'foam' and not (0.12 <= delta <= 12.0):
                    fail(f'{phase} foam: frame delta {delta:.3f} is outside breathing range', errors)
                if layer != 'foam' and len(set(alpha_bboxes)) != 1:
                    fail(f'{phase} {layer}: alpha footprint changes between frames', errors)
                if layer == 'waterfall':
                    bbox = alpha_bboxes[0]
                    if bbox is None or bbox[1] < 96 or bbox[0] < 42 or bbox[0] + bbox[2] > 92:
                        fail(f'{phase} waterfall: alpha footprint {bbox} reaches cliff/rock pixels', errors)
                phase_report[layer] = {
                    'frames': count,
                    'meanFrameDelta': round(delta, 4),
                    'alphaBounds': alpha_bboxes[0],
                }
        report['runtime'][phase] = phase_report

    expected = len(RUNTIME_PHASES) * sum(spec[2] for spec in LAYERS.values())
    actual = len(list(WATER.glob('*.png')))
    if actual != expected:
        fail(f'expected {expected} runtime fluid PNGs, found {actual}', errors)

    report['summary'] = {
        'expectedFrames': expected,
        'actualFrames': actual,
        'runtimePhases': list(RUNTIME_PHASES),
        'errors': errors,
        'status': 'passed' if not errors else 'failed',
    }
    output = ROOT / 'BUILD-VALIDATION-PRODUCTION-11.json'
    output.write_text(json.dumps(report, indent=2))

    if errors:
        print('\n'.join(f'ERROR: {error}' for error in errors))
        print(f'validation report: {output}')
        return 1

    print(f'validated {actual} runtime fluid frames and {len(SOURCE_PHASES)} source scenes')
    print(f'validation report: {output}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
