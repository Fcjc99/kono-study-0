from pathlib import Path
from PIL import Image, ImageDraw
import random

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/garden/evolution/tree'
OUT.mkdir(parents=True, exist_ok=True)
random.seed(13)

S = 2
W, H = 128, 160

def pix(draw, xy, fill):
    draw.rectangle(xy, fill=fill)

def ellipse(draw, box, fill, outline=None, width=1):
    draw.ellipse(box, fill=fill, outline=outline, width=width)

def polygon(draw, pts, fill):
    draw.polygon(pts, fill=fill)

def stage_image(stage: int) -> Image.Image:
    im = Image.new('RGBA', (W, H), (0,0,0,0))
    d = ImageDraw.Draw(im)
    # soft grounded shadow
    if stage > 0:
        ellipse(d, (38, 137, 92, 148), (60, 46, 42, 45))

    if stage == 0:
        pass
    elif stage == 1:
        pix(d, (63, 128, 66, 141), (92, 89, 43, 255))
        polygon(d, [(64,132),(55,126),(58,120),(64,126)], (96, 145, 67, 255))
        polygon(d, [(65,130),(75,124),(73,118),(66,125)], (118, 164, 75, 255))
        pix(d, (63,126,66,132), (69, 108, 46, 255))
    elif stage == 2:
        pix(d, (61, 103, 67, 141), (113, 73, 48, 255))
        pix(d, (62, 103, 65, 141), (161, 104, 63, 255))
        polygon(d, [(63,113),(49,102),(51,96),(64,107)], (72, 122, 58, 255))
        polygon(d, [(65,111),(79,101),(77,94),(64,106)], (90, 145, 65, 255))
        ellipse(d, (44,88,61,105), (101,160,72,255))
        ellipse(d, (68,87,84,103), (118,175,79,255))
        ellipse(d, (55,81,74,100), (110,170,76,255))
    else:
        trunk_w = {3:8,4:11,5:13}[stage]
        trunk_top = {3:69,4:48,5:36}[stage]
        trunk_left = 64 - trunk_w//2
        pix(d, (trunk_left, trunk_top, trunk_left+trunk_w, 141), (102,63,49,255))
        pix(d, (trunk_left+2, trunk_top, trunk_left+trunk_w-2, 141), (157,95,64,255))
        # branch skeleton
        branches = [
            [(64,92),(45,77),(48,72),(65,86)],
            [(65,84),(86,68),(84,63),(63,79)],
            [(63,73),(50,58),(53,54),(67,69)],
            [(67,64),(79,51),(77,47),(64,60)],
        ]
        for pts in branches[: stage-1]:
            polygon(d, pts, (111,66,50,255))
            shifted=[(x+1,y-1) for x,y in pts]
            polygon(d, shifted, (153,91,61,200))

        canopy_specs = {
            3: [(64,60,28,22),(45,72,18,15),(82,70,19,15),(61,82,25,17)],
            4: [(64,47,34,26),(41,61,24,20),(88,60,25,20),(59,73,35,24),(31,76,18,15),(96,76,19,15)],
            5: [(64,38,39,29),(36,52,27,22),(92,53,28,22),(61,65,42,29),(28,70,22,18),(99,72,23,19),(49,84,31,20),(78,84,32,20)],
        }
        green = {3:(94,145,70,255),4:(82,135,68,255),5:(76,126,66,255)}[stage]
        green_hi = {3:(126,175,84,255),4:(116,164,80,255),5:(108,155,78,255)}[stage]
        blossom = {3:(247,181,198,255),4:(248,163,188,255),5:(249,145,181,255)}[stage]
        blossom_hi = (255,216,225,255)
        for cx,cy,rx,ry in canopy_specs[stage]:
            ellipse(d,(cx-rx,cy-ry,cx+rx,cy+ry),green)
            ellipse(d,(cx-rx+3,cy-ry+2,cx+rx-5,cy+ry-5),green_hi)
        blossom_count={3:16,4:34,5:62}[stage]
        for i in range(blossom_count):
            angle=random.random()*6.283
            radius=random.random()*({3:26,4:39,5:48}[stage])
            cx=64+int(radius*0.95*__import__('math').cos(angle))
            cy={3:68,4:60,5:55}[stage]+int(radius*0.55*__import__('math').sin(angle))
            r=1 if i%3 else 2
            ellipse(d,(cx-r,cy-r,cx+r,cy+r), blossom_hi if i%4==0 else blossom)
        # highlights and bark base
        pix(d,(trunk_left-2,138,trunk_left+trunk_w+2,143),(77,53,43,220))

    return im.resize((W*S,H*S), Image.Resampling.NEAREST)

for stage in range(6):
    image=stage_image(stage)
    image.save(OUT/f'tree-stage-{stage}.png', optimize=True)
print('generated', len(list(OUT.glob('tree-stage-*.png'))), 'tree stages')
