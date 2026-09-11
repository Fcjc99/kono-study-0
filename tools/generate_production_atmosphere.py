#!/usr/bin/env python3
"""Generate production cloud, mist, and vegetation accents from approved KONO assets.

The output intentionally derives from existing artwork so the sky and wind accents
retain the same painted/pixel language as the Sanctuary rather than introducing
procedural web-style shapes.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public" / "garden"
OUTPUT = PUBLIC / "production-atmosphere"
OUTPUT.mkdir(parents=True, exist_ok=True)


def alpha_components(image: Image.Image, threshold: int = 10) -> list[tuple[int, int, int, int, int]]:
    alpha = image.getchannel("A")
    width, height = image.size
    pixels = alpha.load()
    seen: set[tuple[int, int]] = set()
    components: list[tuple[int, int, int, int, int]] = []

    for y in range(height):
        for x in range(width):
            if pixels[x, y] < threshold or (x, y) in seen:
                continue
            stack = [(x, y)]
            seen.add((x, y))
            xs: list[int] = []
            ys: list[int] = []
            while stack:
                cx, cy = stack.pop()
                xs.append(cx)
                ys.append(cy)
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if (
                        0 <= nx < width
                        and 0 <= ny < height
                        and (nx, ny) not in seen
                        and pixels[nx, ny] >= threshold
                    ):
                        seen.add((nx, ny))
                        stack.append((nx, ny))
            if len(xs) >= 120:
                components.append((len(xs), min(xs), min(ys), max(xs) + 1, max(ys) + 1))
    return sorted(components, reverse=True)


def padded_crop(image: Image.Image, box: tuple[int, int, int, int], padding: int = 5) -> Image.Image:
    left, top, right, bottom = box
    left = max(0, left - padding)
    top = max(0, top - padding)
    right = min(image.width, right + padding)
    bottom = min(image.height, bottom + padding)
    return image.crop((left, top, right, bottom))


def save_cloud_library() -> list[str]:
    sources = [PUBLIC / "clouds" / "cloud-02.png", PUBLIC / "clouds" / "cloud-05.png"]
    crops: list[Image.Image] = []
    for source in sources:
        image = Image.open(source).convert("RGBA")
        for size, left, top, right, bottom in alpha_components(image):
            if size < 700:
                continue
            crops.append(padded_crop(image, (left, top, right, bottom), 6))

    names: list[str] = []
    for index, crop in enumerate(crops[:4], start=1):
        name = f"cloud-{index:02d}.png"
        crop.save(OUTPUT / name)
        names.append(name)

    # One wider, low-opacity cloud bank made only from approved cloud fragments.
    if len(crops) >= 3:
        bank = Image.new("RGBA", (360, 105), (0, 0, 0, 0))
        first = crops[0].copy()
        second = crops[2].copy()
        first.thumbnail((210, 90), Image.Resampling.LANCZOS)
        second.thumbnail((150, 65), Image.Resampling.LANCZOS)
        bank.alpha_composite(first, (15, 12))
        bank.alpha_composite(second, (205, 34))
        name = "cloud-05.png"
        bank.save(OUTPUT / name)
        names.append(name)
    return names


def crop_bottom_asset(source: Path, top: int, output_name: str) -> str:
    image = Image.open(source).convert("RGBA")
    crop = image.crop((0, top, image.width, image.height))
    bbox = crop.getbbox()
    if bbox:
        crop = crop.crop(bbox)
    canvas = Image.new("RGBA", (128, 96), (0, 0, 0, 0))
    crop.thumbnail((112, 90), Image.Resampling.LANCZOS)
    canvas.alpha_composite(crop, ((128 - crop.width) // 2, 96 - crop.height))
    canvas.save(OUTPUT / output_name)
    return output_name


def save_vegetation_library() -> list[str]:
    names: list[str] = []
    grass_root = PUBLIC / "objects" / "grass"
    for index in range(1, 6):
        top = 55 if index == 1 else 45
        names.append(crop_bottom_asset(grass_root / f"grass-tall-{index:02d}.png", top, f"grass-{index:02d}.png"))
    for index in range(1, 6):
        top = 62 if index == 1 else 45
        names.append(crop_bottom_asset(grass_root / f"flower-grass-{index:02d}.png", top, f"flower-grass-{index:02d}.png"))
    return names


def save_mist_library(cloud_names: Iterable[str]) -> list[str]:
    names: list[str] = []
    for index, name in enumerate(list(cloud_names)[:3], start=1):
        cloud = Image.open(OUTPUT / name).convert("RGBA")
        alpha = cloud.getchannel("A").filter(ImageFilter.GaussianBlur(radius=5 + index * 2))
        mist = Image.new("RGBA", cloud.size, (224, 244, 248, 0))
        alpha = alpha.point(lambda value: int(value * (0.32 - index * 0.04)))
        mist.putalpha(alpha)
        output_name = f"mist-{index:02d}.png"
        mist.save(OUTPUT / output_name)
        names.append(output_name)
    return names


def main() -> None:
    cloud_names = save_cloud_library()
    vegetation_names = save_vegetation_library()
    mist_names = save_mist_library(cloud_names)
    manifest = {
        "version": "production-05",
        "clouds": cloud_names,
        "vegetation": vegetation_names,
        "mist": mist_names,
        "notes": "All assets are derived from approved KONO Sanctuary artwork.",
    }
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Generated {len(cloud_names)} clouds, {len(vegetation_names)} vegetation accents, and {len(mist_names)} mist wisps.")


if __name__ == "__main__":
    main()
