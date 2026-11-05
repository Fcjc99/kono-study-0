// Contact-only feeder → shortened shelf → wooden bed regressions, no GPU.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript')
const R=require('@dimforge/rapier3d-compat')
function load(file){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,Math,Number,Array,Infinity});return module.exports}
const {CABINET:K,FIELD_MOTION:M,PUSHER_SHELF:S,BOARD_BACKSTOP:B,shelfFront,shelfCenter,fieldStock}=load('src/store/motion.ts'),{COIN_MOTION:C,TRAY}=load('src/store/dispense.ts')
let passed=0
function test(name,fn){fn();passed++;console.log('PASS '+name)}
function run({stopped=false,route='board',seed=false,phase=0}={}){
 const depth=S.depth,frontAt=f=>shelfFront(14)+1.6*(.5-.5*Math.cos(((stopped?0:f)+phase)/70))
 const w=new R.World(M.gravity);w.timestep=M.timestep;w.integrationParameters.numSolverIterations=M.solverIterations
 const fixed=(hx,hy,hz,x,y,z,friction=.5)=>w.createCollider(R.ColliderDesc.cuboid(hx,hy,hz).setTranslation(x,y,z).setFriction(friction).setFrictionCombineRule(friction<.1?R.CoefficientCombineRule.Min:R.CoefficientCombineRule.Average))
 const deck=fixed(K.halfWidth,.2,K.depth/2,0,-.2,K.front-K.depth/2,M.deckFriction),shelf=w.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(0,.3,frontAt(0)-depth/2))
 const face=w.createCollider(R.ColliderDesc.cuboid(S.width/2,.3,depth/2).setFriction(M.shelfFriction),shelf)
 fixed(S.width/2,.5,.15,0,1.36,-6.55);fixed(K.halfWidth,1.5,.2,0,1.1,K.front-K.depth-.2)
 for(const [bottom,top]of[[B.bottom,B.seam],[B.seam,B.top]])fixed(B.width/2,(top-bottom)/2,B.depth/2,0,(top+bottom)/2,B.z)
 for(const s of [-1,1]){const g0=-5.25-.52-.08,g1=-5.25+.52+.08;fixed(.1,1.2,(g0-(K.front-K.depth+.4))/2,s*K.wallX,1,(g0+K.front-K.depth+.4)/2);fixed(.1,1.2,(K.front-g1)/2,s*K.wallX,1,(K.front+g1)/2);fixed(.1,.625,(g1-g0)/2,s*K.wallX,.425,-5.25)}
 fixed(K.halfWidth,.15,(TRAY.front-TRAY.back)/2,0,TRAY.top-.15,(TRAY.front+TRAY.back)/2,.9)
 const pieces=[],fed=[],byHandle=new Map()
 function coin(x,y,z,tracked=false,q={x:0,y:0,z:0,w:1}){
  const body=w.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(x,y,z).setRotation(q).setLinearDamping(C.linearDamping).setAngularDamping(C.angularDamping).setCcdEnabled(true))
  const collider=w.createCollider(R.ColliderDesc.cylinder(.055,.31).setDensity(1.4).setFriction(C.friction).setRestitution(C.restitution),body)
  const piece={body,collider,born:0,shelf:false,bedAt:null,startZ:z,maxAdvance:0};pieces.push(piece);byHandle.set(body.handle,piece);if(tracked)fed.push(piece);return piece
 }
 if(seed){let state=17;const random=()=>((state=state*16807%2147483647)/2147483647);for(const p of fieldStock(.31,shelfFront(30),K.front,random,true,frontAt(0)-depth/2))coin(p.x,p.y,p.z)}
 // Both actual side troughs plus the right tipping tray; same solid dimensions,
 // materials and feeder velocity as the production cabinet, not an exit teleport.
 const ramps=[-1,1].map(s=>{
  const dx=6.6-5.12,dy=2.6-1.58,len=Math.hypot(dx,dy),angle=Math.atan2(dy,dx),q={x:0,y:0,z:Math.sin(s*angle/2),w:Math.cos(angle/2)}
  const mid={x:s*((6.6+5.12)/2-K.sideShift),y:(2.6+1.58)/2,z:-5.25},n={x:-s*Math.sin(angle),y:Math.cos(angle)}
  function part(hx,hy,hz,off,z,friction){w.createCollider(R.ColliderDesc.cuboid(hx,hy,hz).setTranslation(mid.x+n.x*off,mid.y+n.y*off,mid.z+z).setRotation(q).setFriction(friction).setFrictionCombineRule(R.CoefficientCombineRule.Min).setRestitution(.05))}
  part(len/2,.04,.52,-.04,0,.08);part(len/2,.16,.03,.12,-.49,.02);part(len/2,.16,.03,.12,.49,.02);fixed(.04,.3,.52,s*(6.65-K.sideShift),2.85,-5.25)
  return {s,q,dir:{x:-s*dx/len,y:-dy/len},out:{x:s*(6.6-.28-K.sideShift),y:1.58+(6.6-.28-5.12)/dx*dy+.16,z:-5.25}}
 })
 for(let i=0;i<180;i++)w.step()
 let maxSpeed=0,tip=-1,wait=0
 for(let f=0;f<2400;f++){
  if(f<1440&&f%40===0){const i=f/40;let p
   if(route==='board'){p=coin(-K.aimHalfWidth+i%9*(K.aimHalfWidth/4),1.5,-6.15,true,{x:Math.SQRT1_2,y:0,z:0,w:Math.SQRT1_2});p.body.setLinvel({x:0,y:-1,z:.6},true)}
   else{const r=ramps[route==='left'?0:1];p=coin(r.out.x,r.out.y,r.out.z,true,r.q);p.body.setLinvel({x:r.dir.x*2.1,y:r.dir.y*2.1,z:0},true)}
   p.born=f
  }
  shelf.setNextKinematicTranslation({x:0,y:.3,z:frontAt(f)-depth/2});w.step()
  if(f%10===0){
   const seen=new Set(),queue=[]
   w.contactPairsWith(face,other=>{const b=other.parent(),piece=b&&byHandle.get(b.handle),cp=face.contactCollider(other,.015);if(piece&&cp&&cp.distance<=.015&&cp.normal1.y>.4){seen.add(b.handle);queue.push(piece)}})
   while(queue.length){const p=queue.pop();p.upperSupported=true;w.contactPairsWith(p.collider,other=>{const b=other.parent(),next=b&&byHandle.get(b.handle);if(!next||seen.has(b.handle))return;const cp=p.collider.contactCollider(other,.015);if(cp&&cp.distance<=.015){seen.add(b.handle);queue.push(next)}})}
  }
  for(const p of fed){const at=p.body.translation(),v=p.body.linvel();assert.ok([at.x,at.y,at.z,v.x,v.y,v.z].every(Number.isFinite));if(at.y>TRAY.lossY)maxSpeed=Math.max(maxSpeed,Math.hypot(v.x,v.y,v.z))
   const sc=face.contactCollider(p.collider,.015);if(sc&&sc.distance<=.015&&sc.normal1.y>.4)p.shelf=true;p.maxAdvance=Math.max(p.maxAdvance,at.z-p.startZ)
   const dc=deck.contactCollider(p.collider,.015);if(p.bedAt===null&&at.z>frontAt(f)+.15&&dc&&dc.distance<=.015&&dc.normal1.y>.4)p.bedAt=f
  }
 }
 let unsupportedSleeping=0
 for(const p of fed)if(p.body.isSleeping()){
  let contact=false;w.contactPairsWith(p.collider,c=>{const cp=p.collider.contactCollider(c,.02);if(cp&&cp.distance<=.02)contact=true})
  if(!contact)unsupportedSleeping++
 }
 const landed=fed.filter(p=>p.bedAt!==null),delays=landed.map(p=>p.bedAt-p.born).sort((a,b)=>a-b)
 const result={created:fed.length,upperContacts:fed.filter(p=>p.shelf).length,supported:fed.filter(p=>p.upperSupported).length,meanAdvance:fed.reduce((n,p)=>n+p.maxAdvance,0)/fed.length,landed:landed.length,afterShelf:landed.filter(p=>p.shelf).length,median:delays[Math.floor(delays.length/2)],maxSpeed,unsupportedSleeping}
 w.free();return result
}
// This isolated route fixture deliberately omits reserve machinery and prize
// balls; the seeded variant uses actual reference field rings and loose stock.
;(async()=>{await R.init()
 test('render and collider use the same compact shelf dimensions and real stroke',()=>{
  for(let field=14;field<=30;field+=.1)assert.ok(shelfFront(field)-S.depth<=B.z-B.depth/2-.039999,'rear shelf remains under the entire apron across its full stroke');assert.ok(shelfFront(14)-S.depth-(K.front-K.depth)>.19,'retracted shelf clears physical rear wall');assert.ok(B.bottom-S.height>0&&B.bottom-S.height<.011,'only sub-medal mechanical clearance beneath apron');assert.equal(S.width,K.width-.4)
  assert.ok(Math.abs(shelfFront(30)-shelfFront(14)-1.6)<1e-9)
  assert.ok(Math.abs(shelfCenter(14)-(shelfFront(14)-S.depth/2))<1e-9)
  const source=fs.readFileSync(path.join(__dirname,'../src/components/MedalCove.tsx'),'utf8')
  assert.match(source,/BoxGeometry\(PUSHER_SHELF.width,PUSHER_SHELF.height,PUSHER_SHELF.depth\)/)
  assert.match(source,/cuboid\(PUSHER_SHELF.width\/2,PUSHER_SHELF.height\/2,PUSHER_SHELF.depth\/2\)/)
  assert.match(source,/shelfCenter\(c.pusher\)/)
  assert.doesNotMatch(source,/const seeBody=/,'removed right seesaw is not secretly retained')
  assert.equal(M.gravity.x,0);assert.equal(M.gravity.z,0)
 })
 for(const route of ['board','left','right'])for(const seed of [false,true]){
  const moving=run({route,seed}),stopped=run({route,seed,stopped:true})
  console.log('ROUTE',JSON.stringify({route,seed,moving,stopped}))
  test(route+' '+(seed?'reference-stock':'clear')+' same-body upper support and carry',()=>{
   assert.equal(moving.created,36);assert.equal(stopped.created,36)
   assert.ok(moving.upperContacts>=moving.created/2,'at least half directly touch the upper plate top')
   assert.equal(moving.supported,moving.created,'every same feed body reaches the real plate support contact graph')
   assert.ok(moving.meanAdvance>stopped.meanAdvance+.5,'actual plate carries supplied bodies more than stopped gravity control')
   assert.ok(moving.maxSpeed<12);assert.equal(moving.unsupportedSleeping,0)
  })
 }
 console.log(`${passed}/${passed} compact-shelf route checks passed.`)
})().catch(e=>{console.error('FAIL',e);process.exit(1)})
