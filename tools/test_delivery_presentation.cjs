// Actual production React tree, Three scene and Rapier gate transforms.
// WebGL drawing is stubbed: these are no-overlay/state/geometry checks, not pixels.
const assert=require('node:assert/strict'),THREE=require('three'),{start}=require('./production_runtime.cjs')
let passed=0
const test=(name,fn)=>{fn();passed++;console.log('PASS '+name)}
function nodes(n,result=[]){if(!n||typeof n!=='object')return result;if(Array.isArray(n)){n.forEach(x=>nodes(x,result));return result}result.push(n);nodes(n.props?.children,result);return result}
function text(n){if(n==null||typeof n==='boolean')return '';if(typeof n==='string'||typeof n==='number')return String(n);return Array.isArray(n)?n.map(text).join(''):text(n.props?.children)}
const find=(tree,name)=>nodes(tree).find(n=>n.props?.className===name)
const assertNoFieldCards=tree=>{const stage=find(tree,'cove-stage');assert.ok(stage);assert.equal(nodes(stage).some(n=>/cove-event|cove-jp-win|cove-tower-progress/.test(n.props?.className||'')),false)}
// The production harness is shallow; explicitly render the extracted read-only HUD.
const consoleTree=tree=>{const node=nodes(tree).find(n=>n.type?.name==='BonusConsole');assert.ok(node);return node.type(node.props)}
const camera=rt=>JSON.stringify({position:rt.camera.position.toArray(),quaternion:rt.camera.quaternion.toArray(),zoom:rt.camera.zoom,fov:rt.camera.fov})
;(async()=>{
 let h=await start(390,550),v=h.review,rt=h.rt,P=h.load('src/store/pusher.ts')
 test('ordinary bonus event stays inside the existing dashboard, leaving the physical stage clear',()=>{
  h.advance();const pose=camera(rt)
  v.cove.current={...v.cove.current,wheels:[{seg:1,at:v.cove.current.frame-P.WHEEL_FRAMES},null,null]};h.advance(12)
  const tree=h.render(),dashboard=find(tree,'cove-dashboard'),progress=consoleTree(tree),event=find(progress,'sanctuary-tower-event')
  assert.ok(event);assert.match(text(event),/tower grows \+2 layers/);assert.equal(event.props.role,'status');assertNoFieldCards(tree)
  assert.equal(nodes(dashboard).filter(n=>n.type?.name==='WheelDial').length,3);assert.equal(camera(rt),pose)
 })
 test('tray total is prominent while the reward-origin subset stays separately and truthfully labeled',()=>{
  // Readout-only fixture: independent physics suites establish both ledgers.
  // This checks presentation of different totals, not a fabricated collection.
  const index=h.slots.findIndex(s=>s&&typeof s==='object'&&'awarded' in s&&'tray' in s&&'ballWaiting' in s);assert.ok(index>=0)
  const original=h.slots[index],hand=v.cove.current.hand;h.slots[index]={...original,awarded:165,pending:45,collected:3,tray:27}
  const tree=h.render(),progress=consoleTree(tree),readout=find(progress,'sanctuary-tray'),ledger=find(progress,'sanctuary-ledger')
  assert.ok(readout);assert.match(text(readout),/27 tray collected/);assert.match(text(readout),/45 rewards delivering/);assert.match(text(ledger),/Awarded165/);assert.match(text(ledger),/Rewards collected3/);assert.match(text(ledger),/Starting stock is not an award/);assert.equal(v.cove.current.hand,hand);assertNoFieldCards(tree);h.slots[index]=original
 })
 h.cleanup();h=await start(390,550);v=h.review;rt=h.rt
 test('tower award and same-body handoff count share one compact status, never a plus-zero win card',()=>{
  v.practiceState.current.enabled=true;v.command.current('tower');h.advance(12)
  const tree=h.render(),progress=consoleTree(tree),status=find(progress,'sanctuary-tower-event')
  assert.ok(status);assert.match(text(status),/Practice tower · 20 awarded/);assert.match(text(status),/0 delivered/);assert.match(text(status),/medals remaining/);assert.doesNotMatch(text(status),/\+0|DELIVERED FROM TOWER/);assertNoFieldCards(tree)
  const count=nodes(status).find(n=>n.type==='strong');assert.ok(count?.props.ref);const painted={textContent:''};count.props.ref.current=painted
  const hand=v.cove.current.hand,won=v.cove.current.won
  for(let i=0;i<1800&&rt.towerMachine.status().released===0;i++)h.advance()
  const released=rt.towerMachine.status().released;assert.ok(released>0,'real tower bodies release');assert.equal(Number(painted.textContent),released)
  assert.equal(v.cove.current.hand-hand,v.cove.current.won-won,'release itself never adds hand credit');assertNoFieldCards(h.render())
 })
 h.cleanup();h=await start(390,550);v=h.review;rt=h.rt;P=h.load('src/store/pusher.ts');const T=h.load('src/store/tide.ts')
 test('three real sliding floors show exposed cargo and an edge locked to the actual body transform',()=>{
  h.advance();rt.scene.updateMatrixWorld(true)
  const floorIds=[]
  for(const part of rt.tideMachine.status().gates){
   const mesh=rt.scene.getObjectByName('tide-'+part.lane+'-gate'),edge=rt.scene.getObjectByName('tide-'+part.lane+'-gate-edge')
   assert.ok(mesh?.visible&&edge?.visible);assert.equal(edge.parent,mesh);floorIds.push(mesh.uuid)
   assert.equal(mesh.geometry.parameters.width,part.halfSize.x*2);assert.equal(mesh.geometry.parameters.depth,part.halfSize.z*2);assert.equal(mesh.material.transparent,false)
   assert.equal(rt.scene.getObjectByName('tide-'+part.lane+'-route').visible,false)
  }
  const rails=[];rt.scene.traverse(o=>{if(/^tide-.*-rail$/.test(o.name))rails.push(o)})
  assert.equal(rails.length,T.tideRails().length);assert.ok(rails.every(o=>o.visible&&o.material.transparent&&o.material.opacity<=.1))
  v.cove.current=P.awardTide(v.cove.current,12);h.advance(12);v.selectTideLane(rt.tideMachine.status().requestId,'center')
  let moved=false
  for(let i=0;i<1000&&!moved;i++){
   h.advance();rt.scene.updateMatrixWorld(true)
   rt.tideMachine.status().gates.forEach((part,index)=>{
    const mesh=rt.scene.getObjectByName('tide-'+part.lane+'-gate'),edge=rt.scene.getObjectByName('tide-'+part.lane+'-gate-edge')
    assert.equal(mesh.uuid,floorIds[index]);for(const axis of ['x','y','z'])assert.ok(Math.abs(mesh.position[axis]-part.position[axis])<1e-6)
    const at=edge.getWorldPosition(new THREE.Vector3());assert.ok(Math.abs(at.z-(part.position.z+edge.position.z))<1e-6,'leading edge cannot animate independently')
    assert.equal(rt.scene.getObjectByName('tide-'+part.lane+'-route').visible,part.lane==='center')
    if(part.lane==='center'&&Math.abs(part.position.z-T.TIDE.z)>.1)moved=true
   })
  }
  assert.ok(moved,'real selected floor opened');assert.equal(rt.tideMachine.status().lane,'center')
 })
 test('pausing a moving gate freezes its mesh and edge instead of continuing a decorative release',()=>{
  const before=JSON.stringify(rt.tideMachine.status()),mesh=rt.scene.getObjectByName('tide-center-gate'),edge=rt.scene.getObjectByName('tide-center-gate-edge'),transform=JSON.stringify({floor:mesh.position.toArray(),edge:edge.getWorldPosition(new THREE.Vector3()).toArray()}),pose=camera(rt)
  h.doc.hidden=true;h.advance(180);rt.scene.updateMatrixWorld(true)
  assert.equal(JSON.stringify(rt.tideMachine.status()),before);assert.equal(JSON.stringify({floor:mesh.position.toArray(),edge:edge.getWorldPosition(new THREE.Vector3()).toArray()}),transform);assert.equal(camera(rt),pose)
  h.doc.hidden=false;h.advance();assertNoFieldCards(h.render())
 })
 h.cleanup();console.log(`${passed}/${passed} delivery presentation checks passed (production React/Three/Rapier; no GPU claim).`)
})().catch(e=>{console.error('FAIL',e);process.exit(1)})
