const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),sharp=require('sharp');
const root=process.argv[2],hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'registration.json'))),cache=new Map();
 async function raw(rel){if(!cache.has(rel))cache.set(rel,await sharp(path.join(root,rel)).ensureAlpha().raw().toBuffer());return cache.get(rel);}
 for(const item of manifest.assets){
  assert.equal(hash(fs.readFileSync(path.join(root,item.path))),item.sha256,item.path);
  const actual=await raw(item.path),source=await raw(item.canonical),phase=item.path.match(/morning|afternoon|evening|night/)[0],[gain,bias]=manifest.grades[phase];
  assert.equal(actual.length,source.length);
  for(let i=0;i<actual.length;i++){const c=i%4,expected=c===3?source[i]:Math.max(0,Math.min(255,Math.round(source[i]*gain[c]+bias[c])));if(actual[i]!==expected)throw Error(`Geometry/lighting mismatch ${item.path} byte ${i}`);}
 }
 const base=await raw('islands/terrace-evolution/afternoon/stage-0.png'),seen=new Set();
 for(let stage=1;stage<=5;stage++){
  const image=await raw(`islands/terrace-evolution/afternoon/stage-${stage}.png`);assert(!seen.has(hash(image)));seen.add(hash(image));
  for(let y=0;y<1086;y++)for(let x=0;x<1448;x++){if(x>=940&&x<1270&&y>=280&&y<565)continue;const i=(y*1448+x)*4;for(let c=0;c<4;c++)assert.equal(image[i+c],base[i+c],`Stage ${stage} changed terrain ${x},${y}`);}
 }
 console.log(`PASS: ${manifest.assets.length} assets; every phase is an exact pointwise grade, unchanged alpha/geometry; all five terrace upgrades confined to shared footprint.`);
}
main().catch(e=>{console.error(e);process.exit(1)});
