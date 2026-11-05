// Independent integration regression. Executes production TSX, DOM callbacks,
// Three geometry and the actual shared Rapier loop; GPU rendering is stubbed.
const assert=require('node:assert/strict'),{start}=require('./production_runtime.cjs')
const json=JSON.stringify;let passed=0
async function test(name,fn){await fn();passed++;console.log('PASS '+name)}
function nodes(n,result=[]){if(!n||typeof n!=='object')return result;if(Array.isArray(n)){n.forEach(x=>nodes(x,result));return result}result.push(n);nodes(n.props?.children,result);return result}
const pose=rt=>json({position:rt.camera.position.toArray(),quaternion:rt.camera.quaternion.toArray(),fov:rt.camera.fov,zoom:rt.camera.zoom})
function ledger(h){const c=h.review.cove.current,rt=h.rt,D=h.load('src/store/delivery.ts'),q=rt.queues,t=rt.towerMachine.status(),s=rt.tideMachine.status(),a=D.deliveryLedger(c.fieldAwards??0,rt.counts.rewardDelivered,rt.counts.rewardCollected,rt.counts.rewardLost);D.assertDeliveryConserved(a,D.pendingMedals(c,{hoppers:q.hoppers,tower:t.pending,bucket:q.bucket,tide:s.pending}),[...rt.pieces.values()].filter(p=>p.reward&&!p.ball&&!p.towerHeld&&!p.tideHeld&&!p.counted).length);assert.equal(c.hand,100-c.dropped+c.won);return a}
function snapshot(h){return json({c:h.review.cove.current,pieces:[...h.rt.pieces].map(([id,p])=>[id,p.body.translation(),p.body.rotation(),p.counted,p.towerHeld,p.tideHeld]),counts:h.rt.counts,queues:h.rt.queues,tide:h.rt.tideMachine.status(),tower:h.rt.towerMachine.status()})}
;(async()=>{
 const saved=json({version:1,pose:{target:[.2,2.8,-.5],distance:34,yaw:.05,pitch:.34,zoom:1.433,fov:42}})
 let h=await start(390,500,{savedCamera:saved}),v=h.review,rt=h.rt,P=h.load('src/store/pusher.ts'),C=h.load('src/components/cameraControl.ts')
 await test('actual lane controls cannot spend medals, choose from camera editing, or consume wrong requests',()=>{
  v.cove.current=P.awardTide(v.cove.current,25);h.advance(12);ledger(h);const id=rt.tideMachine.status().requestId,initialHand=v.cove.current.hand,initialAim=v.aim.current
  const panel=nodes(h.render()).find(n=>n.type?.name==='TideDeliveryPanel');assert.ok(panel);const group=nodes(panel.type(panel.props)).find(n=>n.props?.['aria-label']?.startsWith('Choose jackpot medal placement'));assert.ok(group);const buttons=nodes(group).filter(n=>n.type==='button');assert.equal(buttons.length,3)
  h.win.dispatch('keydown',{code:'Space',target:{matches:s=>s.includes('button')}});h.win.dispatch('keydown',{code:'ArrowRight',target:{matches:s=>s.includes('button')}});assert.equal(v.cove.current.hand,initialHand);assert.equal(v.aim.current,initialAim)
  v.selectTideLane(id+1,'left');assert.equal(rt.tideMachine.status().lane,null)
  v.editCamera();v.selectTideLane(id,'left');v.dropOne();v.beginFeed('keyboard');v.tapDrop();v.practiceState.current.enabled=true;v.command.current('jp');h.advance(5)
  assert.equal(rt.tideMachine.status().lane,null);assert.equal(v.cove.current.fieldAwards,25);assert.equal(v.cove.current.hand,100);assert.equal(v.aim.current,initialAim);assert.equal(v.feed.current.active,false)
  v.lockCamera();v.blockedRef.current=true;v.selectTideLane(id,'center');v.command.current('jp');assert.equal(rt.tideMachine.status().lane,null);assert.equal(v.cove.current.fieldAwards,25);v.blockedRef.current=false
  h.doc.hidden=true;v.selectTideLane(id,'center');v.command.current('jp');assert.equal(rt.tideMachine.status().lane,null);h.doc.hidden=false
  buttons[0].props.onClick();assert.equal(rt.tideMachine.status().lane,'left');v.selectTideLane(id,'right');assert.equal(rt.tideMachine.status().lane,'left');assert.equal(v.cove.current.hand,100);v.practiceState.current.enabled=false
 })
 await test('whole-route preview is reversible during active payout and never writes over custom saved view',()=>{
  rt.placeCamera();const original=pose(rt),stored=h.storage.getItem(C.CAMERA_STORAGE_KEY)
  v.previewWholeRoute();rt.placeCamera();assert.equal(v.routePreviewRef.current,true);assert.notEqual(pose(rt),original);assert.equal(h.storage.getItem(C.CAMERA_STORAGE_KEY),stored);assert.equal(json(C.readCameraPose(h.storage)),json(v.cameraPoseRef.current))
  v.editCamera();v.selectView(0);assert.equal(v.lookRef.current,false);assert.equal(h.storage.getItem(C.CAMERA_STORAGE_KEY),stored)
  h.host.clientWidth=800;h.host.clientHeight=380;rt.resize();h.advance(10);assert.equal(h.storage.getItem(C.CAMERA_STORAGE_KEY),stored)
  v.previewWholeRoute();rt.placeCamera();assert.equal(pose(rt),original);assert.equal(h.storage.getItem(C.CAMERA_STORAGE_KEY),stored);assert.equal(rt.camera.aspect,800/380)
  h.host.clientWidth=390;h.host.clientHeight=500;rt.resize()
 })
 await test('options, hidden tab, and resume interrupt a loaded physical gate without reroll, loss or catch-up',()=>{
  while(rt.tideMachine.status().held<4){h.advance();ledger(h)}
  const before=snapshot(h),frame=v.cove.current.frame
  h.doc.hidden=true;h.doc.dispatch('visibilitychange');h.advance(180);assert.equal(snapshot(h),before)
  h.doc.hidden=false;v.blockedRef.current=true;h.advance(180);assert.equal(snapshot(h),before)
  v.blockedRef.current=false;h.advance();assert.ok(v.cove.current.frame<=frame+1);ledger(h)
 })
 await test('production left/center/right waves conserve every source and contact the live pile or real forecover',()=>{
  const seen=new Set(),contacted=new Set(),coverContact=new Set(),landed=new Set(),releaseX=new Map(),requestOf=new Map();let total=25
  const track=()=>{const a=ledger(h);for(const [id,p]of rt.pieces){if(p.tideId===undefined)continue;if(!seen.has(id)){seen.add(id);requestOf.set(id,p.tideId);releaseX.set(id,p.body.translation().x)}if(p.body.translation().y<1.1)landed.add(id);rt.world.contactPairsWith(p.body.collider(0),other=>{const target=other.parent(),q=target&&rt.pieces.get(target.handle);if(!target&&other.shape.type===9)coverContact.add(p.tideId);if(q&&!q.reward&&!q.board&&!q.ball)contacted.add(p.tideId)})}for(const part of rt.tideMachine.status().gates){const mesh=rt.scene.getObjectByName('tide-'+part.lane+'-gate');assert.ok(mesh&&mesh.visible);assert.ok(['x','y','z'].every(axis=>Math.abs(mesh.position[axis]-part.position[axis])<1e-6));assert.equal(mesh.geometry.parameters.width,part.halfSize.x*2)}const actualRails=rt.scene.children.filter(m=>/^tide-.*-rail$/.test(m.name));const rails=rt.tideMachine.status().rails;assert.equal(actualRails.length,rails.length);rails.forEach((part,i)=>assert.ok(['x','y','z'].every(axis=>Math.abs(actualRails[i].position[axis]-part.position[axis])<1e-6),'every traveling rail matches its actual collider pose'));return a}
  for(const lane of ['left','center','right']){
   if(lane!=='left'){v.cove.current=P.awardTide(v.cove.current,25);total+=25;h.advance();const id=rt.tideMachine.status().requestId;v.selectTideLane(id,lane)}
   const id=rt.tideMachine.status().requestId
   for(let i=0;i<4000&&rt.tideMachine.status().stage!=='idle';i++){h.advance();track()}
   const s=rt.tideMachine.status(),a=track();assert.equal(s.stage,'idle',json(s));assert.ok(a.awarded>=total);assert.equal(a.delivered+a.pending,a.awarded,'independent ball rewards may still be feeding when Tide completes');assert.equal(s.lastCompleted.lane,lane);assert.equal(s.lastCompleted.released,25);assert.ok(lane==='right'?coverContact.has(id):contacted.has(id),lane==='right'?'right cargo contacts the real convex forecover':'cargo contacts initial live board medals')
   const each=[...requestOf.entries()].filter(([,requestId])=>requestId===id);assert.equal(each.length,25);for(const [handle]of each)assert.ok(Math.abs(releaseX.get(handle)-h.load('src/store/tide.ts').TIDE.lanes[lane])<1.3,'lane physically changes placement')
   console.log(`  production ${lane}: ${a.delivered} cumulative delivered; live ${a.live}; collected ${a.collected}; lost ${a.lost}`)
  }
  h.advance(180);track();assert.equal(seen.size,75);assert.equal(landed.size,75);assert.equal(rt.tideMachine.status().planned,75)
 })
 await test('actual tray contact accounts a released Tide medal once and never credits the held reservoir',()=>{
  const p=[...rt.pieces.values()].find(p=>p.tideId!==undefined&&!p.counted),before=rt.counts.rewardCollected,hand=v.cove.current.hand
  // Deterministic terminal-path fixture: relocate an already-delivered original
  // body to the real tray approach, then let production gravity/contact settle.
  // This verifies settlement provenance, not natural whole-board transit.
  p.body.setTranslation({x:0,y:-.3,z:h.load('src/store/dispense.ts').TRAY.center},true);p.body.setLinvel({x:0,y:0,z:0},true);p.body.setAngvel({x:0,y:0,z:0},true)
  h.advance(100);ledger(h);assert.equal(rt.counts.rewardCollected,before+1);assert.equal(v.cove.current.hand,hand+1);h.advance(130);ledger(h);assert.equal(rt.counts.rewardCollected,before+1)
 })
 await test('successive earned JPs preserve choice ownership while later ball challenges present independently',()=>{
  v.cove.current={...v.cove.current,jackpot:31,chance:{pocket:0,at:v.cove.current.frame-P.CHANCE_FRAMES},dishQueue:2};h.advance();const first=rt.tideMachine.status().requestId;assert.equal(rt.tideMachine.status().total,31)
  v.selectTideLane(first,'center');assert.equal(rt.tideMachine.status().lane,'center','choice is reachable during independent result dwell')
  h.advance(P.RESULT_FRAMES+2);assert.ok(v.cove.current.dish,'next challenge presents without waiting for Tide delivery');assert.equal(v.cove.current.dishQueue,1);v.selectTideLane(first,'center');assert.equal(rt.tideMachine.status().lane,'center')
  // An independently already-committed next award queues, never retargets first.
  v.cove.current=P.awardTide(v.cove.current,17);h.advance();const next=first+1;v.selectTideLane(next,'right');assert.equal(rt.tideMachine.status().requestId,first);assert.equal(rt.tideMachine.status().lane,'center')
  for(let i=0;i<5000&&rt.tideMachine.status().requestId===first;i++){h.advance();ledger(h)}
  if(rt.tideMachine.status().requestId!==next){const stalled=rt.tideMachine.status();assert.equal(stalled.blocked,true);assert.ok(stalled.pending>0);ledger(h);v.beginFeed('keyboard');for(let i=0;i<12000&&rt.tideMachine.status().requestId===first;i++){h.advance();ledger(h)}v.stopFeed();console.log('  sequential physical backpressure recovered through ordinary DROP input')}
  assert.equal(rt.tideMachine.status().requestId,next,json(rt.tideMachine.status()));assert.equal(rt.tideMachine.status().stage,'choosing');assert.equal(rt.tideMachine.status().lane,null);assert.ok(v.cove.current.dishQueue<=1,'later presentations no longer wait behind physical delivery');v.selectTideLane(first,'left');assert.equal(rt.tideMachine.status().lane,null)
  v.selectTideLane(next,'right');for(let i=0;i<4000&&rt.tideMachine.status().stage!=='idle';i++){h.advance();ledger(h)}
  if(rt.tideMachine.status().stage!=='idle'){
   assert.equal(rt.tideMachine.status().blocked,true);v.beginFeed('keyboard');let stationary=0
   for(let i=0;i<12000&&rt.tideMachine.status().stage!=='idle';i++){if(!v.feed.current.active&&v.cove.current.hand>0)v.beginFeed('keyboard');h.advance();ledger(h);const t=rt.tideMachine.status();stationary=rt.towerMachine.status().stage==='idle'&&t.stage==='waiting'&&t.blocked?stationary+1:0;if(stationary>=120)break}v.stopFeed()
  }
  const final=rt.tideMachine.status();assert.equal(final.planned,123)
  if(final.stage==='idle'){assert.equal(final.lastCompleted.total,17);assert.equal(final.released,123)}else{
   // This deliberately crowded fixture may retain an owed award. Establish the
   // independent physical reason, not merely a controller's blocked flag.
   const blockers=[],T=h.load('src/store/tide.ts'),actualRoom=900-[...rt.pieces.values()].filter(p=>!p.ball).length
   const loadBlocked=T.tideLoadBlocked(rt.world,'right',body=>{const p=rt.pieces.get(body.handle);if(!p||p.tideHeld||p.counted)return false;blockers.push({at:body.translation(),rotation:body.rotation(),ball:p.ball,reward:p.reward,tideId:p.tideId});return true})
   assert.equal(rt.towerMachine.status().stage,'idle','no circular machinery ownership');assert.ok(actualRoom<=0||loadBlocked,'must independently identify real room/shape backpressure');assert.equal(final.requestId,next);assert.equal(final.lane,'right');assert.equal(final.queued,17);assert.equal(final.held,0);assert.equal(final.released,106);assert.equal(final.lastCompleted.id,first);assert.equal(final.lastCompleted.released,31);ledger(h)
   console.log('  retained second award has verified physical backpressure:',json({actualRoom,loadBlocked,blockers,owed:final.pending,hand:v.cove.current.hand,inputs:rt.queues.input}))
  }

 })
 const stored=h.storage.getItem(C.CAMERA_STORAGE_KEY);h.cleanup();h=await start(820,380,{keepStorage:true});v=h.review;rt=h.rt
 await test('fresh reload keeps only the saved camera; it does not replay or pretend to restore a partial payout',()=>{
  assert.equal(h.storage.getItem(C.CAMERA_STORAGE_KEY),stored);assert.equal(v.cove.current.hand,100);assert.equal(v.cove.current.fieldAwards,0);assert.equal(rt.tideMachine.status().planned,0);assert.equal(v.routePreviewRef.current,false);assert.equal(v.lookRef.current,false)
 })
 await test('actual 900-medal budget applies backpressure and resumes without evicting live field bodies',()=>{
  P=h.load('src/store/pusher.ts');const fillers=[],initial=new Set(rt.pieces.keys());while([...rt.pieces.values()].filter(p=>!p.ball).length<900){const body=rt.addCoin(100,10,100,false,0,false,true);body.setEnabled(false);fillers.push(body)}
  v.cove.current=P.awardTide(v.cove.current,20);h.advance(12);v.selectTideLane(rt.tideMachine.status().requestId,'left');h.advance(150);const s=rt.tideMachine.status();assert.equal(s.blocked,true);assert.equal(s.pending,20);assert.equal(s.held,0);assert.equal(s.released,0);assert.equal([...rt.pieces.values()].filter(p=>!p.ball).length,900);for(const id of initial)assert.ok(rt.pieces.has(id));ledger(h)
  // Only the test removes its disabled budget fillers. Production never evicts
  // existing board medals to pay an award.
  for(const body of fillers){rt.pieces.delete(body.handle);rt.world.removeRigidBody(body)}
  const funded=new Map();for(let i=0;i<2500&&rt.tideMachine.status().stage!=='idle';i++){h.advance();for(const [id,p] of rt.pieces)if(p.tideHeld||p.tideId===1){if(funded.has(id))assert.equal(funded.get(id),p);else funded.set(id,p)}ledger(h)}assert.equal(rt.tideMachine.status().stage,'idle');assert.equal(rt.tideMachine.status().released,20);assert.equal(funded.size,20,'every originally blocked award becomes one real body; retired stock is not required to remain alive')
 })
 h.cleanup();h=await start(390,500,{keepStorage:true});v=h.review;rt=h.rt;P=h.load('src/store/pusher.ts')
 await test('an ordinary medal resting inside a closed reservoir clears physically before the next award loads',()=>{
  const before=rt.counts.rewardDelivered,body=rt.addCoin(h.load('src/store/tide.ts').TIDE.lanes.right,h.load('src/store/tide.ts').TIDE.top+.055+.025,h.load('src/store/tide.ts').tideLaneZ('right'),false,0,false,true,true),handle=body.handle
  // Flat ordinary medal settles on the real closed floor, not an unstable rail-edge pose.
  v.cove.current=P.awardField(v.cove.current,1);h.advance(180);const rest={...body.translation()};assert.ok(rest.y>1.4,'fixture really rests on the closed reservoir floor');assert.ok(rt.counts.rewardDelivered>=before+1);ledger(h)
  v.cove.current=P.awardTide(v.cove.current,20);h.advance(12);const id=rt.tideMachine.status().requestId;v.selectTideLane(id,'right')
  let sawClear=false,foreignCounted=false,leftReservoir=false;for(let i=0;i<2500&&rt.tideMachine.status().stage!=='idle';i++){h.advance();ledger(h);const original=rt.pieces.get(handle);if(original){assert.equal(original.body,body);assert.equal(original.tideId,undefined,'foreign body must never be relabeled as a newly delivered Tide medal');foreignCounted||=!!original.counted;leftReservoir||=body.translation().y<1.1}if(rt.tideMachine.status().clearing){sawClear=true;assert.equal(rt.tideMachine.status().held,0);assert.equal(rt.tideMachine.status().requestReleased,0)}}
  const s=rt.tideMachine.status();assert.equal(sawClear,true);assert.equal(s.stage,'idle',json(s));assert.equal(s.lastCompleted.total,20);assert.equal(s.lastCompleted.released,20);assert.ok(rt.counts.rewardDelivered>=before+21);ledger(h);assert.ok(rt.pieces.has(handle)||foreignCounted,'original survives until its genuine terminal settlement');assert.ok(leftReservoir,'same foreign cargo actually falls below its gate to the shared field')
 })
 h.cleanup();h=await start(390,500,{keepStorage:true});v=h.review;rt=h.rt
 await test('default Practice 100 executes the complete real release without faking an earned JP or collection',()=>{
  v.practiceState.current.enabled=true;v.command.current('jp');h.advance(12);assert.equal(v.practiceState.current.used,true);assert.equal(v.practiceState.current.enabled,false);assert.equal(v.cove.current.jpWins,0);assert.equal(v.cove.current.jackpot,100);assert.equal(rt.tideMachine.status().practice,true)
  v.selectTideLane(rt.tideMachine.status().requestId,'center');for(let i=0;i<6000&&rt.tideMachine.status().stage!=='idle';i++){h.advance();ledger(h)}
  if(rt.tideMachine.status().stage!=='idle'){const paused=rt.tideMachine.status();assert.equal(paused.blocked,true);assert.ok(paused.pending>0);assert.equal(v.cove.current.jpWins,0);console.log(`  Practice 100 safely waiting: ${paused.released} delivered / ${paused.pending} owed`);v.beginFeed('keyboard');for(let i=0;i<12000&&rt.tideMachine.status().stage!=='idle';i++){h.advance();ledger(h)}v.stopFeed()}
  const s=rt.tideMachine.status();assert.equal(s.stage,'idle',json(s));const a=ledger(h);assert.equal(s.planned,100);assert.equal(s.released,100);assert.equal(s.pending,0);assert.equal(s.lastCompleted.practice,true);assert.ok(a.awarded>=100);assert.ok(a.delivered>=100);assert.equal(v.cove.current.jpWins,0);assert.equal(v.cove.current.hand,100-v.cove.current.dropped+v.cove.current.won);console.log(`  Practice 100 complete: ${v.cove.current.dropped} real drops; ${a.collected} total reward medals collected`)
 })
 h.cleanup();console.log(`${passed}/${passed} independent production Sanctuary checks passed (CPU scene/Rapier/events; not GPU).`)
})().catch(e=>{console.error('FAIL',e);process.exit(1)})
