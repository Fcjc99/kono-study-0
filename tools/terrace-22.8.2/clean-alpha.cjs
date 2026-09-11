// User-authorized matte cleanup; preserve RGB artwork and soften only edge alpha.
const sharp=require('sharp'),path=require('node:path');
const dir=process.argv[2];
(async()=>{
 for(const [stage,name] of [[1,'stage1-generated.png'],[3,'stage3-generated.png'],[4,'stage4-generated.png'],[5,'stage5-alpha-attempt.png']]){
  const {data,info}=await sharp(path.join(dir,name)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  for(let i=0;i<data.length;i+=4){
   const a=data[i+3];
   if(a<16){data[i]=data[i+1]=data[i+2]=data[i+3]=0;}
   else data[i+3]=Math.round(Math.min(1,(a-16)/(245-16))*255);
  }
  await sharp(data,{raw:info}).png().toFile(path.join(dir,`stage-${stage}.png`));
 }
 console.log('Cleaned alpha edges for stages 1, 3, 4, 5; stage 2 reference unchanged.');
})().catch(e=>{console.error(e);process.exit(1)});
