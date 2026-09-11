from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/garden/evolution/pond'
OUT.mkdir(parents=True, exist_ok=True)
SCALE = 2


def upscale(img: Image.Image, scale: int = SCALE) -> Image.Image:
    return img.resize((img.width * scale, img.height * scale), Image.Resampling.NEAREST)


def save(img: Image.Image, name: str, scale: int = SCALE):
    upscale(img, scale).save(OUT / name)


def koi_base(body, patch, accent, eye=(20, 22, 28, 255), tail_frame=0):
    # 32x32 logical canvas, east-facing koi centered with transparent padding.
    img = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    outline = (71, 68, 54, 255)
    shadow = (76, 102, 112, 110)

    # soft submerged shadow pixels
    d.polygon([(7,17),(10,12),(21,11),(27,14),(27,18),(21,21),(10,20)], fill=shadow)

    # tail sway frames
    if tail_frame == 0:
        tail = [(8,16),(3,11),(5,16),(3,21)]
    else:
        tail = [(8,16),(4,10),(6,16),(4,22)]
    d.polygon(tail, fill=outline)
    d.polygon([(8,16), tail[1], tail[2], tail[3]], fill=accent)

    # body silhouette
    d.polygon([(7,14),(10,10),(18,9),(24,11),(28,14),(28,18),(24,21),(18,23),(10,22),(7,18)], fill=outline)
    d.polygon([(9,14),(11,11),(18,10),(23,12),(27,14),(27,18),(23,20),(18,22),(11,21),(9,18)], fill=body)

    # head highlight / mouth
    d.rectangle((25,14,27,17), fill=(244, 221, 176, 255))
    d.point((28,16), fill=outline)

    # fins
    d.polygon([(14,11),(16,7),(18,11)], fill=accent)
    d.polygon([(14,21),(16,25),(18,22)], fill=accent)

    # markings
    d.rectangle((12,12,15,15), fill=patch)
    d.rectangle((15,11,17,13), fill=patch)
    d.rectangle((20,17,23,20), fill=patch)
    d.rectangle((10,18,12,20), fill=accent)

    # spine highlight and eye
    d.line((11,12,22,12), fill=(255, 239, 198, 180), width=1)
    d.point((24,13), fill=eye)
    d.point((25,13), fill=(245, 235, 204, 255))
    return img

variants = {
    'orange-white': ((229, 119, 55, 255), (250, 234, 208, 255), (191, 76, 43, 255)),
    'red-white': ((245, 226, 199, 255), (201, 67, 63, 255), (236, 149, 84, 255)),
    'gold-black': ((220, 169, 59, 255), (78, 69, 54, 255), (244, 210, 111, 255)),
}

# Runtime direction indices: 0 east, 1 southeast, 2 south, 3 southwest,
# 4 west, 5 northwest, 6 north, 7 northeast.
# PIL positive angle rotates counter-clockwise, while screen Y increases downward.
rotation_degrees = {0: 0, 1: -45, 2: -90, 3: -135, 4: 180, 5: 135, 6: 90, 7: 45}
for name, (body, patch, accent) in variants.items():
    for tail in (0, 1):
        base = koi_base(body, patch, accent, tail_frame=tail)
        for direction, degrees in rotation_degrees.items():
            rotated = base.rotate(degrees, resample=Image.Resampling.NEAREST, expand=False, center=(16,16))
            save(rotated, f'koi-{name}-d{direction}-f{tail}.png')

# Lily pads
def lily(size=(20, 14), hue=0):
    img = Image.new('RGBA', (28, 24), (0,0,0,0)); d=ImageDraw.Draw(img)
    outline=(57,95,49,255)
    greens=[(91,145,65,255),(110,162,73,255),(76,128,59,255)]
    g=greens[hue%len(greens)]
    d.polygon([(5,12),(8,7),(15,5),(22,8),(24,13),(20,18),(12,19),(6,16)], fill=outline)
    d.polygon([(7,12),(9,8),(15,6),(21,9),(22,13),(19,16),(13,17),(8,15)], fill=g)
    d.polygon([(15,6),(14,12),(18,10)], fill=(0,0,0,0))
    d.line((14,12,19,15), fill=(55,105,50,255), width=1)
    d.point((9,10), fill=(150,190,91,255)); d.point((20,13), fill=(71,123,57,255))
    return img
for i in range(3): save(lily(hue=i), f'lily-pad-{i+1}.png')

# Lotus flower
img=Image.new('RGBA',(28,28),(0,0,0,0)); d=ImageDraw.Draw(img)
outline=(119,74,83,255); petal=(244,171,185,255); light=(255,218,222,255); center=(238,190,75,255)
for poly in [[(14,4),(11,12),(14,15),(17,12)],[(6,10),(11,12),(14,17),(9,18)],[(22,10),(17,12),(14,17),(19,18)],[(8,18),(14,15),(14,23)],[(20,18),(14,15),(14,23)]]:
    d.polygon(poly, fill=outline)
for poly in [[(14,5),(12,12),(14,14),(16,12)],[(7,11),(11,13),(13,16),(9,17)],[(21,11),(17,13),(15,16),(19,17)],[(10,18),(14,16),(14,21)],[(18,18),(14,16),(14,21)]]:
    d.polygon(poly, fill=petal)
d.rectangle((13,13,15,15), fill=light); d.point((14,15), fill=center)
save(img,'lotus-pink.png')

# Reed cluster
img=Image.new('RGBA',(36,44),(0,0,0,0)); d=ImageDraw.Draw(img)
for x,h,bend in [(7,29,-2),(12,36,1),(17,32,2),(23,39,-1),(28,27,1)]:
    y0=40; y1=40-h
    d.line((x,y0,x+bend,y1), fill=(62,104,55,255), width=2)
    d.line((x+1,y0,x+bend+1,y1), fill=(106,146,68,255), width=1)
    if h>33:
        d.rectangle((x+bend-1,y1-3,x+bend+2,y1+2), fill=(125,96,55,255))
# grass base
for x in range(4,32,4): d.line((x,41,x-2,34), fill=(82,126,55,255), width=1)
save(img,'reeds-cluster.png')

# Mossy stone edge cluster
img=Image.new('RGBA',(48,24),(0,0,0,0)); d=ImageDraw.Draw(img)
stones=[(3,9,13,18),(12,6,24,18),(24,10,34,19),(33,7,45,18)]
for idx,box in enumerate(stones):
    d.rounded_rectangle(box, radius=3, fill=(118,116,104,255), outline=(82,82,76,255))
    x0,y0,x1,y1=box
    d.rectangle((x0+2,y0+1,x1-3,y0+3), fill=(168,159,135,255))
    if idx%2==0: d.rectangle((x0+1,y0+5,x0+4,y0+7), fill=(91,131,61,255))
save(img,'moss-stones.png')

# Pixel ripples
def ripple(w,h,segments):
    img=Image.new('RGBA',(w,h),(0,0,0,0)); d=ImageDraw.Draw(img)
    c1=(208,240,241,180); c2=(153,211,225,160)
    bbox=(2,3,w-3,h-4)
    # use arcs with gaps for handmade pixel ring
    d.arc(bbox, 190, 340, fill=c1, width=1)
    d.arc(bbox, 15, 160, fill=c2, width=1)
    inner=(6,6,w-7,h-7)
    d.arc(inner, 200, 320, fill=c2, width=1)
    return img
save(ripple(32,16,4),'ripple-small.png')
save(ripple(46,22,6),'ripple-large.png')

# Water sparkle
img=Image.new('RGBA',(16,16),(0,0,0,0)); d=ImageDraw.Draw(img)
d.rectangle((7,2,8,13), fill=(237,252,246,210)); d.rectangle((2,7,13,8), fill=(237,252,246,210))
d.rectangle((6,6,9,9), fill=(255,255,255,245)); d.point((4,4), fill=(213,244,239,175)); d.point((11,3), fill=(213,244,239,145))
save(img,'water-sparkle.png')

# Tiny shoreline flowers for the final stage
img=Image.new('RGBA',(32,20),(0,0,0,0)); d=ImageDraw.Draw(img)
for x,y,c in [(6,13,(244,176,189,255)),(13,10,(255,222,154,255)),(20,14,(235,195,221,255)),(26,11,(250,205,211,255))]:
    d.line((x,18,x,y+2),fill=(71,118,56,255),width=1)
    d.point((x,y),fill=c); d.point((x-1,y+1),fill=c); d.point((x+1,y+1),fill=c); d.point((x,y+2),fill=(248,224,143,255))
save(img,'shore-flowers.png')

print(f'generated pond pixel assets in {OUT}')
