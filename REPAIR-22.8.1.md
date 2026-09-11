# Sanctuary registration repair

Stage 0 remains byte-for-byte locked. Stages 1–5 reuse the original 22.7.40 terrace artwork, composited only inside the existing terrace ownership mask at world offset (900, 250). All other terrain pixels are identical to the corresponding locked phase map. The proposed new terrace designs are not integrated in this repair.

Reset/profile changes cancel queued evolution and reapply every feature. Tree phase switches cancel pending growth tweens. Landmark hit areas and home evolution labels were corrected. The development-only `?sanctuaryQA=1` route uses isolated synthetic progress and does not modify saved assignments.

Run `npm run build`, `npm run validate:syntax`, and `python tools/validate_sanctuary_registration.py` (Pillow required). The old 22.8.0 generation script is disabled because resizing a close-up to island dimensions does not preserve world registration.
