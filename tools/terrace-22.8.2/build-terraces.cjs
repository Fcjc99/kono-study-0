// Offline asset integration, not artwork generation. Requires sharp via NODE_PATH.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sharp=require('sharp');
const root=process.argv[2], assets=process.argv[3], output=process.argv[4];
const W=1448,H=1086, zone={left:940,top:280,width:380,height:335};
const placement={
 afternoon:{left:960,bottom:552,clear:[950,364,1250,560],light:[1,1,1]},
 morning:{left:990,bottom:538,clear:[985,342,1295,542],light:[1,.96,.88]},
 evening:{left:982,bottom:568,clear:[975,370,1295,574],light:[.93,.75,.72]},
 night:{left:982,bottom:598,clear:[975,398,1295,610],light:[.42,.43,.64]},
};
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
async function rgba(p){return sharp(p).ensureAlpha().raw().toBuffer();}
async function main(){
 const lock=JSON.parse(fs.readFileSync(path.join(root,'STAGE0-LOCK-22.7.38.json')));
 const manifest={build:'22.8.2',method:'transparent terrace sprites on locally cleared ground; exact locked island outside terrace',zone,results:[]};
 const stages=fs.readdirSync(assets).filter(n=>/^stage-[1-5]\.png$/.test(n));
 for(const [phase,info] of Object.entries(lock.phases)){
  const basePath=path.join(root,info.runtime_path);
  if(hash(basePath)!==info.sha256)throw Error('Stage 0 lock changed');
  const base=await rgba(basePath), clean=Buffer.from(base);
  const ground=await rgba(path.join(assets,`ground-${phase}.png`));
  const {clear:[x0,y0,x1,y1],light:ratio}=placement[phase];
  // Remove the original terrace only. Feather the ground-patch boundary.
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
   const weight=Math.min(1,(x-x0)/7,(x1-1-x)/7,(y-y0)/7,(y1-1-y)/7),i=(y*W+x)*4;
   for(let c=0;c<3;c++)clean[i+c]=Math.round(base[i+c]*(1-weight)+ground[i+c]*weight);
  }
  for(const name of stages){
   const stage=Number(name[6]);
   const source=path.join(assets,name);
   const metadata=await sharp(source).metadata();
   if(!metadata.hasAlpha)throw Error(name+' must have real transparency');
   const sprite=await sharp(source).trim({background:'#00000000',threshold:5}).resize({width:290,kernel:'lanczos3'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
   const left=placement[phase].left,top=placement[phase].bottom-sprite.info.height;
   if(top<zone.top)throw Error('Sprite too tall for terrace: '+name);
   const tinted=Buffer.from(sprite.data);
   for(let i=0;i<tinted.length;i+=4){
    const lightCore=sprite.data[i]>245&&sprite.data[i+1]>180&&sprite.data[i+2]<190&&i/4/sprite.info.width<sprite.info.height*.6;
    for(let c=0;c<3;c++)tinted[i+c]=Math.min(255,Math.round(sprite.data[i+c]*(lightCore&&phase==='night'?.9:ratio[c])));
   }
   const result=await sharp(clean,{raw:{width:W,height:H,channels:4}}).composite([{input:tinted,raw:sprite.info,left,top}]).png().toBuffer();
   const outDir=path.join(output,phase);fs.mkdirSync(outDir,{recursive:true});
   const dest=path.join(outDir,name);fs.writeFileSync(dest,result);
   const check=await rgba(dest);let outside=0,changed=0;
   for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    let i=(y*W+x)*4;if(check.subarray(i,i+4).equals(base.subarray(i,i+4)))continue;
    changed++;if(x<zone.left||x>=zone.left+zone.width||y<zone.top||y>=zone.top+zone.height)outside++;
   }
   if(outside)throw Error('Changed pixels outside terrace '+phase+'/'+stage);
   manifest.results.push({phase,stage,changed,outsideTerraceChanged:outside,sha256:hash(dest),sprite:{left,top,width:sprite.info.width,height:sprite.info.height}});
  }
 }
 fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2));
 console.log(`PASS: ${manifest.results.length} maps, Stage 0 unchanged, zero changes outside registered terrace area.`);
}
main().catch(e=>{console.error(e);process.exit(1)});
