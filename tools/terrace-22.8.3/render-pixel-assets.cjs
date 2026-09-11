// Native-resolution art rendering: sample cottage wood, reduce microdetail,
// and use a shared 2-world-pixel grid. No runtime CSS filter or island tint.
const sharp=require('sharp'),fs=require('node:fs'),path=require('node:path');
const root=process.argv[2],out=process.argv[3];
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const base=path.join(root,'public/garden/evolution/lanterns/source/locked-stage0-22.7.38/afternoon.png');
 const sample=await sharp(base).extract({left:220,top:385,width:195,height:185}).resize(90,90).png({palette:true,colours:64,dither:0}).toBuffer();
 const raw=await sharp(sample).removeAlpha().raw().toBuffer();
 const unique=new Map();
 for(let i=0;i<raw.length;i+=3){const [r,g,b]=raw.subarray(i,i+3);if(r>g*1.06&&g>b*1.15&&r>65&&r<230)unique.set(`${r},${g},${b}`,[r,g,b]);}
 const palette=[...unique.values()];if(palette.length<8)throw Error('Missing cottage palette');
 for(let stage=1;stage<=5;stage++){
  const source=path.join(root,`tools/terrace-22.8.2/inputs/stage-${stage}.png`);
  const {data,info}=await sharp(source).trim({background:'#00000000',threshold:5}).resize({width:145,kernel:'lanczos3'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  for(let i=0;i<data.length;i+=4){
   if(data[i+3]<100){data[i]=data[i+1]=data[i+2]=data[i+3]=0;continue;}
   data[i+3]=255;
   let [r,g,b]=data.subarray(i,i+3), l=.3*r+.59*g+.11*b;
   // Lift near-black sticker outlines to the island's colored shadow range.
   const lifted=[r*.80+34,g*.80+31,b*.80+25];
   let target=lifted.map(v=>Math.round(l*.22+v*.78));
   const wood=r>g*1.10&&g>b*1.15&&r-g>18;
   if(wood){
    let best=palette[0],distance=Infinity;
    for(const p of palette){let d=0;for(let c=0;c<3;c++)d+=(p[c]-target[c])**2;if(d<distance){distance=d;best=p;}}
    target=best;
   }
   for(let c=0;c<3;c++)data[i+c]=target[c];
  }
  await sharp(data,{raw:info}).resize(info.width*2,info.height*2,{kernel:'nearest'}).png().toFile(path.join(out,`stage-${stage}.png`));
 }
 fs.writeFileSync(path.join(out,'palette.json'),JSON.stringify({grid:2,woodPalette:palette,source:base},null,2));
 console.log('Rendered five terrace assets on a shared 2px grid using cottage wood colors.');
})().catch(e=>{console.error(e);process.exit(1)});
