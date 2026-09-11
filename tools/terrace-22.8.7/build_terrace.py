"""Local gradient-domain terrace repair; Pillow and numpy only.

Source paintings and all pixels outside terrace repair/sprite masks are immutable.
Run: python build_terrace.py [project-root] [output-root]
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
import json, sys

ROOT=Path(sys.argv[1]) if len(sys.argv)>1 else Path('C:/Users/jeffr/Documents/ChatGPT/KONO/KONO-PRODUCTION-BUILD-22.7.40-POND-UI-STABILITY')
OUT=Path(sys.argv[2]) if len(sys.argv)>2 else Path(__file__).parent
OLD=ROOT/'public/garden/registered-22.8.6/islands/terrace-evolution'
INPUT=ROOT/'tools/terrace-22.8.3/inputs'
PHASES=['morning','afternoon','evening','night']
BOX=(940,340,1280,560)
X,Y,X1,Y1=BOX
def read(p): return np.array(Image.open(p).convert('RGBA'))
base={p:read(OLD/p/'stage-0.png') for p in PHASES}
ground=read(INPUT/'ground-afternoon.png')
H,W=ground.shape[:2]

def mask_for(phase):
 m=Image.new('L',(W,H));d=ImageDraw.Draw(m)
 # Actual old deck and front step, not a clearing rectangle.
 d.polygon([(993,409),(1045,394),(1083,380),(1144,404),(1183,431),(1211,450),(1234,463),(1222,477),(1235,484),(1224,503),(1197,520),(1156,535),(1142,549),(1093,547),(1087,536),(1050,534),(1011,519),(976,499),(956,480),(971,461),(991,447)],fill=255)
 d.line([(1007,376),(1007,445)],fill=255,width=12)
 d.line([(1165,387),(1165,456)],fill=255,width=12)
 d.line([(1007,385),(1040,404),(1080,417),(1120,418),(1165,395),(1195,435),(1238,456)],fill=255,width=13)
 if phase=='night':
  # Original night contains offset native posts/cord and a baked rectangular repair.
  d.line([(1025,354),(1025,408)],fill=255,width=14)
  d.line([(1186,365),(1186,418)],fill=255,width=14)
  d.line([(1025,359),(1070,383),(1122,400),(1186,370),(1213,416),(1260,444)],fill=255,width=13)
  d.rectangle((995,367,1020,445),fill=255)
  d.rectangle((1154,367,1181,458),fill=255)
  d.polygon([(1062,369),(1108,358),(1164,386),(1145,407),(1084,402),(1061,393)],fill=255)
  d.polygon([(978,459),(1102,390),(1254,454),(1242,491),(1165,532),(1128,541),(1010,501)],fill=255)
 m=np.array(m.filter(ImageFilter.MaxFilter(19)))>0
 # Bound repairs away from the skyline, rocks and frame. Same mask throughout phases.
 safe=Image.new('L',(W,H));d=ImageDraw.Draw(safe)
 if phase=='night':
  d.polygon([(945,340),(1070,340),(1100,348),(1130,358),(1150,359),(1165,370),(1180,370),(1200,386),(1215,391),(1230,397),(1240,408),(1250,410),(1260,426),(1276,439),(1276,558),(945,558)],fill=255)
 else:
  d.polygon([(945,340),(1042,340),(1080,355),(1120,369),(1160,380),(1200,400),(1240,422),(1276,446),(1276,558),(945,558)],fill=255)
 # Existing native side rocks are independent of the old terrace and must survive.
 d.polygon([(945,420),(965,418),(979,429),(982,448),(973,456),(949,454)],fill=0)
 d.polygon([(1232,451),(1245,445),(1257,452),(1261,476),(1240,480),(1231,468)],fill=0)
 m &= np.array(safe)>0
 m[:Y]=False;m[Y1:]=False;m[:,:X]=False;m[:,X1:]=False
 return m

def poisson(dst,src,mask):
 """Dirichlet Poisson solve by red/black SOR; preserve target outside mask exactly."""
 target=dst[Y:Y1,X:X1,:3].astype(np.float64)
 donor=src[Y:Y1,X:X1,:3].astype(np.float64)
 # Higher native-night hill occasionally extends into afternoon sky coordinates.
 # Use only donor grass gradients there; never import any donor sky colors.
 donor_sky=(donor[:,:,2]>donor[:,:,1]*.99)
 donor_sky=np.array(Image.fromarray((donor_sky*255).astype('uint8')).filter(ImageFilter.MaxFilter(15)))>0
 active=mask[Y:Y1,X:X1].copy();active[[0,-1],:]=False;active[:,[0,-1]]=False
 # Source gradients transfer only grass detail, with phase-local amplitude.
 a=ground[550:574,975:1235,:3].reshape(-1,3)
 b=dst[550:574,975:1235,:3].reshape(-1,3)
 gain=np.clip(np.median(b,axis=0)/np.maximum(np.median(a,axis=0),1),.15,1.3)
 donor*=gain
 lap=4*donor[1:-1,1:-1]-donor[:-2,1:-1]-donor[2:,1:-1]-donor[1:-1,:-2]-donor[1:-1,2:]
 # Harmonic continuation near the donor skyline avoids copying its shifted edge.
 lap[donor_sky[1:-1,1:-1]]=0
 v=target.copy()
 v[active]=donor[active]
 yy,xx=np.indices(active[1:-1,1:-1].shape)
 masks=[active[1:-1,1:-1]&((xx+yy)%2==c) for c in (0,1)]
 change=0
 for it in range(1800):
  change=0
  for m in masks:
   average=(v[:-2,1:-1]+v[2:,1:-1]+v[1:-1,:-2]+v[1:-1,2:]+lap)*.25
   delta=(average-v[1:-1,1:-1])*1.88
   change=max(change,float(np.abs(delta[m]).max()))
   v[1:-1,1:-1][m]+=delta[m]
  if change<.005:break
 result=dst.copy();result[Y:Y1,X:X1,:3][active]=np.clip(np.rint(v[active]),0,255).astype('uint8')
 return result,{'iterations':it+1,'last_update':change,'source_gradient_gain':gain.tolist()}

def grade_sprite(sprite,phase):
 a=base['afternoon'][434:498,1040:1140,:3].reshape(-1,3).astype(float)
 b=base[phase][434:498,1040:1140,:3].reshape(-1,3).astype(float)
 gain=np.ones(3) if phase=='afternoon' else np.clip(np.median(b,axis=0)/np.maximum(np.median(a,axis=0),1),.15,1.1)
 out=sprite.copy();out[:,:,:3]=np.clip(np.rint(sprite[:,:,:3]*gain),0,255)
 return out

def bare_deck():
 # Tight original-afternoon bare terrace, excluding native grass and sky.
 m=Image.new('L',(W,H));d=ImageDraw.Draw(m)
 d.polygon([(971,472),(1045,419),(1077,408),(1110,416),(1159,447),(1209,461),(1200,481),(1219,489),(1192,508),(1154,524),(1099,530),(1053,519),(1005,504)],fill=255)
 d.polygon([(1096,523),(1113,515),(1137,524),(1137,538),(1122,546),(1108,541),(1096,540)],fill=255)
 # Bare deck includes the canonical single string-light pair.
 d.line([(1007,375),(1007,444)],fill=255,width=9)
 d.line([(1165,385),(1165,456)],fill=255,width=9)
 d.line([(1010,387),(1042,405),(1080,416),(1120,418),(1163,395)],fill=255,width=3)
 for x,y in [(1029,408),(1057,416),(1080,420),(1101,423),(1110,422),(1122,422),(1140,417)]:d.ellipse((x-3,y-3,x+3,y+3),fill=255)
 out=base['afternoon'].copy();out[:,:,3]=np.array(m)
 return out

def remove_night_cap(result,stage):
 """Replace only the old post cap with adjacent native pixels along the hill slope."""
 m=Image.new('L',(W,H));d=ImageDraw.Draw(m)
 d.polygon([(1183,363),(1189,363),(1194,368),(1194,380),(1180,380),(1180,368)],fill=255)
 cap=np.array(m)>0
 # Never affect new terrace furniture painted over this area.
 if stage:
  sprite=read(INPUT/f'stage-{stage}.png');sy=552-sprite.shape[0]
  covered=np.zeros((H,W),bool);covered[sy:552,960:960+sprite.shape[1]]=sprite[:,:,3]>0
  cap &= ~covered
 yy,xx=np.where(cap)
 # Native hillside descends approximately one pixel per two columns here.
 # Sampling along that contour preserves the sharp sky/grass transition.
 source_y=np.rint(yy+(1201-xx)*.55).astype(int)
 result[yy,xx,:3]=base['night'][source_y,1201,:3]
 return result,cap

OUT.mkdir(parents=True,exist_ok=True)
report={'method':'native-boundary Poisson (red-black SOR), immutable native phase outside local repair and sprite','zone':BOX,'phases':{},'checks':[]}
selected=PHASES
if '--phase' in sys.argv:
 selected=[sys.argv[sys.argv.index('--phase')+1]]
 if (OUT/'boundary-checks.json').exists():
  report=json.loads((OUT/'boundary-checks.json').read_text())
  report['checks']=[c for c in report['checks'] if c['phase'] not in selected]
for phase in selected:
 mask=mask_for(phase)
 if '--cap-only' in sys.argv:
  clean=base[phase].copy();stats=report['phases'][phase]
 else:clean,stats=poisson(base[phase],ground,mask)
 Image.fromarray((mask*255).astype('uint8')).save(OUT/f'{phase}-repair-mask.png')
 report['phases'][phase]=stats
 for stage in range(6):
  result=base[phase].copy();allowed=mask.copy()
  if stage:
   sprite=grade_sprite(read(INPUT/f'stage-{stage}.png'),phase)
   sy=552-sprite.shape[0];sx=960
   canvas=Image.fromarray(clean);canvas.alpha_composite(Image.fromarray(sprite),(sx,sy));result=np.array(canvas)
   allowed[sy:552,sx:sx+sprite.shape[1]]|=sprite[:,:,3]>0
  elif phase=='night':
   sprite=grade_sprite(bare_deck(),phase)
   canvas=Image.fromarray(clean);canvas.alpha_composite(Image.fromarray(sprite));result=np.array(canvas)
   allowed|=sprite[:,:,3]>0
  else:allowed[:]=False
  if '--cap-only' in sys.argv:result=read(OUT/f'islands/terrace-evolution/{phase}/stage-{stage}.png')
  if phase=='night':
   result,cap=remove_night_cap(result,stage);allowed|=cap
  changed=np.any(result!=base[phase],axis=2)
  outside=int(np.count_nonzero(changed&~allowed))
  zone=np.zeros((H,W),bool);zone[Y:Y1,X:X1]=True
  outside_zone=int(np.count_nonzero(changed&~zone))
  assert outside==0 and outside_zone==0
  # Every skyline/frame pixel remains byte-identical to the registered original.
  assert np.array_equal(result[:340],base[phase][:340])
  dest=OUT/f'islands/terrace-evolution/{phase}/stage-{stage}.png';dest.parent.mkdir(parents=True,exist_ok=True);Image.fromarray(result).save(dest)
  report['checks'].append({'phase':phase,'stage':stage,'changed_pixels':int(changed.sum()),'outside_allowed_mask_changed_pixels':outside,'outside_terrace_zone_changed_pixels':outside_zone,'protected_sky_changed_pixels':int(np.any(result[:340]!=base[phase][:340],axis=2).sum())})
  if stage in (0,5):
   # Outer boundary is native. Compare one-pixel seam contrast across mask edge.
   rgb=result[:,:,:3].astype(float);orig=base[phase][:,:,:3].astype(float)
   edge=(mask[:,1:]!=mask[:,:-1])
   report['checks'][-1]['repair_boundary_mean_rgb_step']=float(np.abs(rgb[:,1:]-rgb[:,:-1])[edge].mean())
   report['checks'][-1]['native_same_boundary_mean_rgb_step']=float(np.abs(orig[:,1:]-orig[:,:-1])[edge].mean())
(OUT/'boundary-checks.json').write_text(json.dumps(report,indent=2))

sheet=Image.new('RGB',(1440,4*480),'white');d=ImageDraw.Draw(sheet)
for row,(phase,stage) in enumerate([('evening',5),('night',5),('night',0),('afternoon',1)]):
 for col,root in enumerate([OLD,OUT/'islands/terrace-evolution']):
  im=Image.open(root/phase/f'stage-{stage}.png').crop((930,330,1290,560)).resize((720,460),Image.Resampling.NEAREST)
  sheet.paste(im,(col*720,row*480+20));d.text((col*720+5,row*480+4),f'{phase} stage {stage}: '+('before' if col==0 else 'after'),fill='black')
sheet.save(OUT/'before-after-enlarged.png')
print(json.dumps({'maps':24,'all_outside_zone_changes':sum(c['outside_terrace_zone_changed_pixels'] for c in report['checks']),'solves':report['phases']}))
