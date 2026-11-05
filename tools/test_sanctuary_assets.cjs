// CPU geometry, not a GPU screenshot.
const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),path=require('path'),ts=require('typescript'),THREE=require('three')
function load(file){const moduleShim={exports:{}};const localRequire=name=>name.startsWith('.')?load(path.resolve(path.dirname(file),name+'.ts')):require(name);vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:moduleShim.exports,require:localRequire});return moduleShim.exports}
const moduleShim={exports:load(path.resolve(__dirname,'../src/components/sanctuaryAssets.ts'))},B=load(path.resolve(__dirname,'../src/components/referenceCabinet.ts'))
const A=moduleShim.exports,mat=new THREE.MeshStandardMaterial({color:'#efacc3',side:THREE.DoubleSide}),ray=new THREE.Raycaster(),objects=[]
for(let i=0;i<3;i++){
 const w=[1.25,1.05,1.25][i],g=B.createBoatTarget(w,i,mat,new THREE.Texture());g.updateMatrixWorld(true);objects.push(g)
 for(const x of [-w*.49,0,w*.49])for(const z of [-.055,0,.055]){
  ray.set(new THREE.Vector3(x,2,z),new THREE.Vector3(0,-1,0));assert.equal(ray.intersectObject(g,true).length,0,'vertical medal slab must pass through real opening')
 }
 assert.equal(g.children.filter(o=>o.geometry?.type==='BoxGeometry').length,0)
 const b=new THREE.Box3().setFromObject(g);assert.ok(b.max.y<.25,'no large arch hides incoming medals')
}
for(const s of [-1,1]){const g=A.createRampMouth(mat,mat,s);g.updateMatrixWorld(true);ray.set(new THREE.Vector3(-2,0,0),new THREE.Vector3(1,0,0));assert.equal(ray.intersectObject(g,true).length,0,'side hopper has a real open core')}
console.log('PASS: three real extruded boat-target shells; 27 vertical medal-slab rays clear; both hopper cores clear')
// Orthographic projection of actual mesh triangles; no invented image/concept art.
const cam=new THREE.PerspectiveCamera(30,3,0.1,30);cam.position.set(0,2.6,7);cam.lookAt(0,-.15,0);cam.updateMatrixWorld();
objects.forEach((g,i)=>g.position.x=(i-1)*2.1);objects.forEach(g=>g.updateMatrixWorld(true))
const polygons=[];objects.forEach(g=>g.traverse(o=>{if(!o.isMesh||o.geometry.type==='PlaneGeometry')return;const p=o.geometry.attributes.position,idx=o.geometry.index;for(let i=0;i<(idx?idx.count:p.count);i+=3){let pts=[],z=0;for(let j=0;j<3;j++){const v=new THREE.Vector3().fromBufferAttribute(p,idx?idx.getX(i+j):i+j).applyMatrix4(o.matrixWorld);z+=v.z;v.project(cam);pts.push(`${((v.x+1)*450).toFixed(1)},${((1-v.y)*150).toFixed(1)}`)}polygons.push({z,pts:pts.join(' '),color:o.geometry.type==='TubeGeometry'?'#e8bc6c':'#d994b1'})}}))
polygons.sort((a,b)=>a.z-b.z)
fs.mkdirSync('/tmp/sanctuary-qa',{recursive:true});fs.writeFileSync('/tmp/sanctuary-qa/actual-mouth-meshes.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="340"><rect width="900" height="340" fill="#f6f0e2"/><text x="20" y="25" font-family="sans-serif" font-size="15" fill="#524941">Actual THREE mesh projection · CPU geometry only, not a rendered game screenshot</text>${polygons.map(p=>`<polygon points="${p.pts}" fill="${p.color}"/>`).join('')}<text x="80" y="310" font-family="sans-serif" fill="#524941">Lantern boat</text><text x="410" y="310" font-family="sans-serif" fill="#524941">Star boat</text><text x="700" y="310" font-family="sans-serif" fill="#524941">Lighthouse boat</text></svg>`)
