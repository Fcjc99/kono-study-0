from pathlib import Path
from PIL import Image
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
P=["morning","afternoon","evening","night"]
e=[]
for ph in P:
  for st in range(6):
    p=ROOT/f"public/garden/islands/terrace-evolution/{ph}/stage-{st}.png"
    if not p.exists() or Image.open(p).size!=(1448,1086): e.append(f"bad map {p}")
    a=np.array(Image.open(ROOT/f"public/garden/evolution/lanterns/phases/{ph}/terrace-stage-{st}.png").convert("RGBA")); al=a[:,:,3]
    if np.any((al!=0)&(al!=255)): e.append(f"partial alpha {ph} {st}")
    if np.any(a[al==0,:3]!=0): e.append(f"rgb bleed {ph} {st}")
cov=np.array(Image.open(ROOT/"public/garden/evolution/home/source/stage0-house-coverage-mask.png").convert("L"))>0
for ph in P:
  a=np.array(Image.open(ROOT/f"public/garden/evolution/home/{ph}-stage-5.png").convert("RGBA"))[:,:,3]>0
  n=int((cov&~a).sum())
  if n:e.append(f"house uncovered {ph}: {n}")
t=(ROOT/"src/game/systems/HomeEvolutionSystem.ts").read_text()
if "4: [288, 61]" not in t or "5: [312, 16]" not in t:e.append("smoke anchors")
if e:
 print("FAIL"); [print("-",x) for x in e]; raise SystemExit(1)
print("PASS — 22.7.13 house/terrace quality sweep")
