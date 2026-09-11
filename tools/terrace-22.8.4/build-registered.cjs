// Reproducible registration: one afternoon geometry, pointwise phase grading only.
// No generation, warping, resizing, or phase-specific anchors in this pipeline.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const sharp = require('sharp');
const root = process.argv[2], out = process.argv[3];
const W=1448,H=1086;
const grades = { afternoon:[[1,1,1],[0,0,0]], morning:[[.99,.95,.87],[4,1,0]], evening:[[.88,.68,.67],[10,2,8]], night:[[.28,.36,.57],[3,6,14]] };
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function raw(p){return sharp(p).ensureAlpha().raw().toBuffer({resolveWithObject:true});}
function grade(data,phase){const result=Buffer.from(data),[gain,bias]=grades[phase];for(let i=0;i<data.length;i+=4)for(let c=0;c<3;c++)result[i+c]=Math.max(0,Math.min(255,Math.round(data[i+c]*gain[c]+bias[c])));return result;}
async function main(){
 const manifest={build:'22.8.4',canonicalPhase:'afternoon',grades,terrace:{left:960,bottom:552,clear:[940,350,1270,565]},assets:[]};
 const write=async(data,info,rel,canonical)=>{const dest=path.join(out,rel);fs.mkdirSync(path.dirname(dest),{recursive:true});const png=await sharp(data,{raw:info}).png().toBuffer();fs.writeFileSync(dest,png);manifest.assets.push({path:rel,canonical,sha256:hash(png),width:info.width,height:info.height,alphaSha256:hash(Buffer.from(data.filter((_,i)=>i%4===3)))});};
 const base=await raw(path.join(root,'public/garden/islands/terrace-evolution/afternoon/stage-0.png'));
 const clean=Buffer.from(base.data),ground=await raw(path.join(root,'tools/terrace-22.8.3/inputs/ground-afternoon.png'));
 const [x0,y0,x1,y1]=manifest.terrace.clear;
 for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const weight=Math.min(1,(x-x0)/8,(x1-1-x)/8,(y-y0)/8,(y1-1-y)/8),i=(y*W+x)*4;for(let c=0;c<3;c++)clean[i+c]=Math.round(base.data[i+c]*(1-weight)+ground.data[i+c]*weight);}
 for(let stage=0;stage<=5;stage++){
  let data=base.data;
  if(stage){const sprite=await raw(path.join(root,`tools/terrace-22.8.3/inputs/stage-${stage}.png`));
   for(let i=3;i<sprite.data.length;i+=4)if(sprite.data[i]!==0&&sprite.data[i]!==255)throw Error('Terrace silhouette has translucent fringe');
   data=await sharp(clean,{raw:base.info}).composite([{input:sprite.data,raw:sprite.info,left:960,top:552-sprite.info.height}]).raw().toBuffer();
  }
  for(const phase of Object.keys(grades))await write(grade(data,phase),base.info,`islands/terrace-evolution/${phase}/stage-${stage}.png`,`islands/terrace-evolution/afternoon/stage-${stage}.png`);
 }
 const groups=[];
 for(const family of ['home','cherry-tree'])for(let stage=0;stage<=5;stage++)groups.push(`evolution/${family}/afternoon-stage-${stage}.png`);
 groups.push('evolution/home/decor/vegetable-garden-stage5-afternoon.png');
 for(const state of ['idle','cast'])groups.push(`evolution/bridge-fishing/phases/afternoon/bridge-fishing-${state}.png`);
 for(const layer of ['ocean','pond','waterfall','foam'])for(let frame=0;frame<12;frame++)groups.push(`production-water/afternoon-${layer}-${frame}.png`);
 for(const rel of groups){const source=await raw(path.join(root,'public/garden',rel));for(const phase of Object.keys(grades))await write(grade(source.data,phase),source.info,rel.replace('afternoon',phase),rel);}
 fs.writeFileSync(path.join(out,'registration.json'),JSON.stringify(manifest,null,2));
 console.log(`Built ${manifest.assets.length} registered assets. Original inputs unchanged.`);
}
main().catch(e=>{console.error(e);process.exit(1)});
