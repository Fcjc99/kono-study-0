"""Remove observed opaque old-roof remnants, preserving surviving RGB exactly.

Only writes beneath this script's home-clean directory. Source files are untouched.
The removal mask is authored once from afternoon and reused byte-for-byte for all
four phases. All polygons are local to observed roof-edge contamination.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np, json, hashlib

ROOT=Path('C:/Users/jeffr/Documents/ChatGPT/KONO/KONO-PRODUCTION-BUILD-22.7.40-POND-UI-STABILITY/public/garden/evolution/home')
OUT=Path(__file__).parent/'home-clean'
OUT.mkdir(exist_ok=True)
PHASES=('morning','afternoon','evening','night')
# Native 500 x 450 coordinates. Each polyline follows the actual roof-cap edge.
# The region above it is discarded only between its explicit endpoints.
ROOF_EDGES={
 1:[(160,57),(166,58),(176,61),(183,65),(192,67),(200,70),(207,73),(216,76),(222,80),(232,82),(240,85),(247,88),(254,91),(258,93)],
 2:[(186,52),(193,54),(200,58),(208,62),(218,67),(225,70),(234,74),(242,78),(253,81),(259,83),(265,86)],
 3:[(108,144),(115,133),(121,122),(128,113),(135,104),(141,94),(148,85),(153,76),(159,66),(166,61),(174,64),(183,67),(191,71),(199,75),(207,79),(216,83),(224,87),(232,91),(241,95),(249,99),(258,103),(267,107),(272,109)],
 4:[(158,47),(165,50),(174,53),(183,57),(192,60),(201,65),(209,68),(217,72),(226,76),(234,80),(244,83),(253,87),(258,89)],
 5:[(121,53),(127,45),(134,35),(139,26),(144,17),(149,10)],
}
EXTRA_EDGES={5:[(164,9),(170,12),(176,15),(182,16),(188,18),(194,20)]}

def above_mask(points,size):
 mask=Image.new('L',size,0)
 ImageDraw.Draw(mask).polygon([(points[0][0],0),(points[-1][0],0)]+list(reversed(points)),fill=255)
 return np.array(mask)>0

def rgb_digest(a): return hashlib.sha256(a.tobytes()).hexdigest()

manifest={'description':'Targeted opaque roof-remnant alpha cleanup. Retained RGB is unchanged. All phases share the same removal mask.','stages':{}}
for stage in range(1,6):
 master=np.array(Image.open(ROOT/f'afternoon-stage-{stage}.png').convert('RGBA'))
 remove=above_mask(ROOF_EDGES[stage],(500,450))
 if stage==5:
  # Stage 5 has a thin neutral gray fringe, not the large brown remnant.
  # Retain the warm thatch cap where the conservative envelope overlaps it.
  rgb=master[:,:,:3].astype(np.int16)
  remove&=(rgb[:,:,2]>rgb[:,:,0]*.65)&(rgb[:,:,2]>rgb[:,:,1]*.6)
 if stage in EXTRA_EDGES:remove|=above_mask(EXTRA_EDGES[stage],(500,450))
 # Keep genuine roofline foliage when it overlaps the end of a traced band.
 # Derived from the afternoon master so lighting never changes the mask.
 rgb=master[:,:,:3].astype(np.int16)
 leaf=(rgb[:,:,1]>rgb[:,:,0]*1.02)&(rgb[:,:,1]>rgb[:,:,2]*1.45)
 remove&=~leaf
 faint=(master[:,:,3]>0)&(master[:,:,3]<=8)
 remove|=faint
 Image.fromarray((remove*255).astype('uint8')).save(OUT/f'stage-{stage}-removal-mask.png')
 info={'removedOpaquePixels':int((remove&(master[:,:,3]>0)).sum()),'faintAlphaPixels':int(faint.sum()),'roofEdge':ROOF_EDGES[stage],'extraEdge':EXTRA_EDGES.get(stage),'assets':[]}
 alphas=[]
 for phase in PHASES:
  original=np.array(Image.open(ROOT/f'{phase}-stage-{stage}.png').convert('RGBA'))
  assert np.array_equal(original[:,:,3],master[:,:,3]),f'Source phase alpha differs: {phase} {stage}'
  cleaned=original.copy();cleaned[remove]=0
  retained=cleaned[:,:,3]>0
  assert np.array_equal(cleaned[retained],original[retained]),'Retained RGB/alpha changed'
  assert not np.any((cleaned[:,:,3]>0)&(original[:,:,3]==0)),'Added artwork'
  Image.fromarray(cleaned).save(OUT/f'{phase}-stage-{stage}.png')
  alphas.append(cleaned[:,:,3])
  info['assets'].append({'path':f'{phase}-stage-{stage}.png','sourceSha256':hashlib.sha256((ROOT/f'{phase}-stage-{stage}.png').read_bytes()).hexdigest(),'retainedPixelsUnchanged':True,'alphaSha256':rgb_digest(cleaned[:,:,3])})
 assert all(np.array_equal(a,alphas[0]) for a in alphas),'Phase silhouettes differ'
 manifest['stages'][stage]=info

(OUT/'cleanup-manifest.json').write_text(json.dumps(manifest,indent=2))
# Full silhouettes on a solid contrasting background, plus nearest-neighbor roof crops.
sheet=Image.new('RGB',(1000,5*480),'#91cccc');d=ImageDraw.Draw(sheet)
detail=Image.new('RGB',(1200,5*340),'#91cccc');dd=ImageDraw.Draw(detail)
for stage in range(1,6):
 for col,folder in enumerate((ROOT,OUT)):
  im=Image.open(folder/f'afternoon-stage-{stage}.png').convert('RGBA')
  label=f'Stage {stage} - '+('before' if col==0 else 'after')
  x=col*500;y=(stage-1)*480
  sheet.paste(im,(x,y+25),im);d.text((x+10,y+8),label,fill='#162e33')
  crop=im.crop((100,0,300,105)).resize((600,315),Image.Resampling.NEAREST)
  detail.paste(crop,(col*600,(stage-1)*340+25),crop)
  dd.text((col*600+10,(stage-1)*340+8),label,fill='#162e33')
sheet.save(OUT/'before-after-full.png')
detail.save(OUT/'before-after-roofs.png')
print(json.dumps({k: {'removed':v['removedOpaquePixels'],'faint':v['faintAlphaPixels']} for k,v in manifest['stages'].items()},indent=2))
print('Verified: 20 output PNGs; 4 identical phase alphas per stage; all retained RGB unchanged; no source modifications.')
