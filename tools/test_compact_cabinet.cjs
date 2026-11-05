// Independent observation-only QA against the actual production TSX and Rapier.
// Deliberate award inputs are fixtures; there are no body relocations or credits.
// 6 groups: actual geometry, legal aims, feeders, exact tower remainder, dense
// interlock/backpressure, and physical ball route. GPU drawing alone is stubbed.
const assert=require('node:assert/strict');
const root=process.env.QA_ROOT||require('node:path').resolve(__dirname,'..');
const {start}=require(root+'/tools/production_runtime.cjs');
const R=require(root+'/node_modules/@dimforge/rapier3d-compat');
const compact=!process.env.QA_ROOT;
const json=JSON.stringify,near=(a,b,e=1e-4)=>Math.abs(a-b)<e;
function ledger(h){const c=h.review.cove.current,rt=h.rt,q=rt.queues,t=rt.towerMachine.status(),s=rt.tideMachine.status(),D=h.load('src/store/delivery.ts'),a=D.deliveryLedger(c.fieldAwards,rt.counts.rewardDelivered,rt.counts.rewardCollected,rt.counts.rewardLost);D.assertDeliveryConserved(a,D.pendingMedals(c,{hoppers:q.hoppers,tower:t.pending,bucket:q.bucket,tide:s.pending}),[...rt.pieces.values()].filter(p=>p.reward&&!p.ball&&!p.towerHeld&&!p.tideHeld&&!p.counted).length);assert.equal(c.hand,100-c.dropped+c.won);return a}
function colliders(h){const out=[];h.rt.world.forEachCollider(c=>out.push(c));return out}
function checkGeometry(h){
 const {rt}=h,M=h.load('src/store/motion.ts'),T=h.load('src/store/tower.ts'),D=h.load('src/store/dispense.ts');
 const deckWidth=rt.deck.geometry.parameters.width,deck=colliders(h).find(c=>!c.parent()&&near(c.translation().y,-.2)&&near(c.translation().z,rt.deck.position.z)&&c.shape.type===R.ShapeType.Cuboid);
 assert.ok(deck);assert.ok(near(deck.halfExtents().x*2,deckWidth));if(compact)assert.ok(deckWidth>=8.3&&deckWidth<=8.8,'approved 15–20% narrower actual bed');
 assert.ok(near(deck.halfExtents().z*2,M.CABINET.depth));assert.ok(near(rt.deck.position.z,M.CABINET.front-M.CABINET.depth/2));assert.equal(rt.pusherMesh.geometry.parameters.width,M.PUSHER_SHELF.width);assert.ok(near(rt.pusherBody.collider(0).halfExtents().x*2,M.PUSHER_SHELF.width));assert.ok(M.PUSHER_SHELF.width<deckWidth);
 assert.ok(near(rt.trayFloor.halfExtents().x*2,deckWidth));assert.ok(near(D.TRAY.halfWidth,rt.trayFloor.halfExtents().x-.1));
 const walls=colliders(h).filter(c=>!c.parent()&&near(c.translation().z,-6.15)&&near(c.translation().y,(M.PLINKO.top+M.PLINKO.bottom)/2)&&c.shape.type===R.ShapeType.Cuboid&&near(c.halfExtents().x,.1));assert.equal(walls.length,2);
 const boardInside=Math.min(...walls.map(c=>Math.abs(c.translation().x)-c.halfExtents().x));
 if(compact){
  const fixed=colliders(h).filter(c=>!c.parent()&&c.shape.type===R.ShapeType.Cuboid&&near(Math.abs(c.translation().x),M.CABINET.wallX)&&near(c.halfExtents().x,.1));assert.equal(fixed.length,6);
  for(const c of fixed){const at=c.translation(),half=c.halfExtents();let matching=false;rt.scene.traverse(m=>{if(m.isMesh&&m.geometry.type==='BoxGeometry'&&near(m.position.x,at.x)&&near(m.position.y,at.y)&&near(m.position.z,at.z)&&near(m.geometry.parameters.width,half.x*2)&&near(m.geometry.parameters.height,half.y*2)&&near(m.geometry.parameters.depth,half.z*2))matching=true});assert.ok(matching,'every narrow sidewall/gap curb has a matching visible shape')}
  // The right-side loaded carriage, not the obsolete broad center corridor,
  // is the physical construction route. Its own leaves/held stock are excluded.
  const own=new Set();rt.world.forEachRigidBody(body=>{if(rt.towerMachine.status().supports.some(at=>near(body.translation().x,at.x)&&near(body.translation().y,at.y)&&near(body.translation().z,at.z)))own.add(body.handle)});
  for(const side of [-1,1]){let fixture=false;const t=T.TOWER,dx=Math.abs(t.x-t.dockX);rt.world.intersectionsWithShape({x:(t.x+t.dockX)/2,y:t.buildTop-t.leafHalfHeight,z:t.z+side*t.leafHalfDepth},{x:0,y:0,z:0,w:1},new R.Cuboid(t.leafHalfWidth+dx/2,t.leafHalfHeight,t.leafHalfDepth),c=>{const body=c.parent();if(body&&(own.has(body.handle)||rt.pieces.has(body.handle)))return true;fixture=true;return false});assert.equal(fixture,false,'actual right-side loaded support route has no foreign fixture')}

 }
 const allStock=[...rt.pieces.values()],seed=allStock.filter(p=>!p.ball);assert.equal(allStock.filter(p=>p.ball).length,6);assert.equal(seed.filter(p=>p.towerHeld).length,128);for(const p of seed){const col=p.body.collider(0);assert.ok(near(col.shape.radius,.31));assert.equal(col.friction(),Math.fround(.16));assert.ok(Math.abs(p.body.translation().x)+.31<deckWidth/2,'starting medal outside actual deck')}
 for(const n of [1,2,3,5,6,7,20,30,40,119,120]){
  if(n>T.TOWER.batchMax)continue;const slots=Array.from({length:n},(_,i)=>T.towerCoinSlot(i,n));
  assert.equal(new Set(slots.map(p=>json(p))).size,n);
  for(let i=0;i<n;i++){const a=slots[i];assert.ok(Math.abs(a.x-T.TOWER.x)+.31<=T.TOWER.leafHalfWidth);assert.ok(Math.abs(a.z-T.TOWER.z)+.31<=T.TOWER.leafHalfDepth*2);for(let j=i+1;j<n;j++){const b=slots[j];if(Math.abs(a.y-b.y)<.11-1e-6)assert.ok(Math.hypot(a.x-b.x,a.z-b.z)>=.62-1e-6,'real cylinders overlap within a layer')}}
  if(compact&&n>=20){const base=slots.filter(p=>near(p.y,.055));assert.equal(base.length,T.TOWER.medalsPerLayer);assert.ok(base.every(p=>near(Math.hypot(p.x-T.TOWER.x,p.z-T.TOWER.z),T.TOWER.ringRadius)),'real normal-size medals surround an open ring center')}
 }
 console.log('PASS actual mesh/collider scale, stock bounds, physical same-size layered slots',json({deckWidth,shelfWidth:M.PUSHER_SHELF.width,boardInside,seed:seed.length,batch:T.TOWER.batchMax}));
 return {deckWidth,boardInside};
}
async function aims(){
 const outcomes=[];
 for(const phase of [0,45,90,135,180,225,270,315]){
  const h=await start(),{rt,review:v}=h,M=h.load('src/store/motion.ts');h.advance(phase);
  const before=new Set(rt.pieces.keys());let original=null,first=null,exit=null,maxX=0,maxAt=null,wallPen=0;
  const walls=colliders(h).filter(c=>!c.parent()&&near(c.translation().z,M.PLINKO.z)&&near(c.translation().y,(M.PLINKO.top+M.PLINKO.bottom)/2)&&c.shape.type===R.ShapeType.Cuboid&&near(c.halfExtents().x,.1));const inside=Math.min(...walls.map(c=>Math.abs(c.translation().x)-c.halfExtents().x));
  const a=v.aim.current;for(const code of ['ArrowLeft','ArrowRight','KeyA','KeyD'])h.win.dispatch('keydown',{code});assert.equal(v.aim.current,a,'manual keys cannot aim');v.dropOne();assert.equal(v.cove.current.dropped,1);
  for(let frame=0;frame<650;frame++){
   h.advance();ledger(h);
   if(!original){original=[...rt.pieces.values()].find(p=>!before.has(p.body.handle)&&p.board);if(original)first={...original.body.translation()}}
   if(original){const p=rt.pieces.get(original.body.handle);if(!p){exit??=frame;break}const at=p.body.translation();if(p.board&&p.capturedPocket===undefined){if(Math.abs(at.x)>maxX){maxX=Math.abs(at.x);maxAt={...at}}for(const wall of walls){const cp=wall.contactCollider(p.body.collider(0),.02);if(cp)wallPen=Math.max(wallPen,-cp.distance)}}if(!p.board||p.capturedPocket!==undefined){exit=frame;break}}
  }
  assert.ok(first&&exit!==null,'automatic phase '+phase+' reaches actual board exit');assert.ok(Math.abs(first.x)+.31<=inside+.006,'phase '+phase+' spawns inside wall');assert.ok(wallPen<.04,'phase '+phase+' penetrates wall '+json({wallPen,maxX,maxAt,inside}));outcomes.push({phase,x:+first.x.toFixed(4),exit,maxX,wallPen,maxAt});h.cleanup();
 }
 assert.ok(Math.min(...outcomes.map(o=>o.x))<-3&&Math.max(...outcomes.map(o=>o.x))>3);
 console.log('PASS both automatic sweep extremes and intermediate phases use real narrowed board',json(outcomes));
}
// Track the first36 FIFO medals from each authored hopper award. The six
// starting balls may earn later legitimate hopper awards; those must not be
// misattributed to these72 original bodies. Preserve real lower-field handoff.
async function feeder({feed=true,stopped=false,observe=false}={}){
 const h=await start(),{rt,review:v}=h,P=h.load('src/store/pusher.ts'),originalStock=new Set(rt.pieces.keys()),tracked=new Map(),deck=colliders(h).find(c=>!c.parent()&&near(c.translation().y,-.2)&&near(c.translation().z,rt.deck.position.z)&&c.shape.type===R.ShapeType.Cuboid);
 const field=[...rt.pieces.values()].filter(p=>!p.ball&&!p.towerHeld&&!p.tideHeld),rearIds=new Set(field.slice(-480,-288).map(p=>p.body.handle)),stockRecords=new Map(field.map(p=>[p.body.handle,{body:p.body,start:{...p.body.translation()},rear:rearIds.has(p.body.handle),lower:false,captured:false,maxAdvance:0,maxDisplacement:0}]));assert.equal(rearIds.size,192);
 if(stopped)rt.pusherBody.setNextKinematicTranslation=()=>{};
 if(feed)v.cove.current={...P.awardField(v.cove.current,72),rain:72};let maxSpeed=0;
 for(let frame=0;frame<4000;frame++){
  h.advance();ledger(h);
  // A coin may sit on an ordinary coin carpet without touching bare wood.
  // Independently prove its upward-facing support chain is rooted at the
  // lower deck, never the rear shelf, clear cover, reserve or a synthetic force.
  const lowerSupported=new Set(),supportQueue=[deck],lowerEdge=h.load('src/store/motion.ts').shelfFront(30);
  while(supportQueue.length){const support=supportQueue.pop();rt.world.contactPairsWith(support,other=>{const body=other.parent(),piece=body&&rt.pieces.get(body.handle);if(!piece||piece.ball||piece.counted||piece.towerHeld||piece.tideHeld||lowerSupported.has(body.handle))return;const at=body.translation();if(at.z<lowerEdge-.31||at.y>1.2)return;const cp=support.contactCollider(other,.015);if(!cp||cp.distance>.015||cp.normal1.y<=.4)return;lowerSupported.add(body.handle);supportQueue.push(other);});}
  for(const [id,r]of stockRecords){const p=rt.pieces.get(id);if(!p)continue;assert.equal(p.body,r.body);const at=p.body.translation(),c=p.body.collider(0);r.maxAdvance=Math.max(r.maxAdvance,at.z-r.start.z);r.maxDisplacement=Math.max(r.maxDisplacement,Math.hypot(at.x-r.start.x,at.z-r.start.z));const dc=deck.contactCollider(c,.015);if(at.z>h.load('src/store/motion.ts').shelfFront(30)&&dc&&dc.distance<=.015&&dc.normal1.y>.4)r.lower=true;if(p.counted&&rt.trayCatchers.some(t=>{const cp=t.contactCollider(c,.012);return cp&&cp.distance<=.012&&cp.normal1.y>.4}))r.captured=true;}
  for(const [id,p]of rt.pieces){if(!p.reward||p.ball||(!p.ramp&&!tracked.has(id)))continue;let r=tracked.get(id);if(!r){if([...tracked.values()].filter(r=>r.side===p.ramp).length>=36)continue;r={body:p.body,side:p.ramp,start:{...p.body.translation()},shelf:false,upper:false,deck:false,pile:false,field:false,supportedLower:false,maxZ:-Infinity};tracked.set(id,r)}assert.equal(p.body,r.body);const at=p.body.translation(),vel=p.body.linvel();assert.ok(Object.values(at).every(Number.isFinite));maxSpeed=Math.max(maxSpeed,Math.hypot(vel.x,vel.y,vel.z));r.maxZ=Math.max(r.maxZ,at.z);if(at.z>h.load('src/store/motion.ts').shelfFront(30)&&at.y<1.1)r.field=true;if(at.z>lowerEdge&&lowerSupported.has(id))r.supportedLower=true;
   const sc=rt.pusherBody.collider(0).contactCollider(p.body.collider(0),.015);if(sc&&sc.distance<=.015){r.shelf=true;if(sc.normal1.y>.4)r.upper=true;}const dc=deck.contactCollider(p.body.collider(0),.015);if(dc&&dc.distance<=.015&&dc.normal1.y>.4)r.deck=true;
   if(!r.pile)rt.world.contactPairsWith(p.body.collider(0),other=>{const body=other.parent();if(body&&originalStock.has(body.handle))r.pile=true});
  }
 }
 const result=[1,2].map(side=>{const rs=[...tracked.values()].filter(r=>r.side===side);return{side,created:rs.length,shelf:rs.filter(r=>r.shelf).length,upper:rs.filter(r=>r.upper).length,maxZ:Math.max(...rs.map(r=>r.maxZ)),deck:rs.filter(r=>r.deck).length,pile:rs.filter(r=>r.pile).length,field:rs.filter(r=>r.field).length,supportedLower:rs.filter(r=>r.supportedLower).length}});
 const rows=[...stockRecords.values()],rear=rows.filter(r=>r.rear),summarize=rs=>({n:rs.length,lower:rs.filter(r=>r.lower).length,captured:rs.filter(r=>r.captured).length,moved:rs.filter(r=>r.maxDisplacement>.1).length,meanAdvance:rs.reduce((n,r)=>n+r.maxAdvance,0)/rs.length,meanDisplacement:rs.reduce((n,r)=>n+r.maxDisplacement,0)/rs.length});const causal={feed,stopped,stock:summarize(rows),rear:summarize(rear),result,maxSpeed,ledger:ledger(h)};console.log('FEEDER OBSERVATION',json(causal));if(observe){h.cleanup();return causal;}assert.equal(tracked.size,72);for(const r of result){assert.equal(r.created,36);assert.ok(r.pile>=18,'real side '+r.side+' medals must contact seeded field');assert.ok(r.upper>=12,'real side '+r.side+' reaches the upper shelf through top-facing contact');assert.ok(r.deck>=1,'each side exercises real bare-deck contact; other lower-field medals may ride the supported dense carpet');assert.ok(r.field>=12,'at least one third of each original feeder batch reaches beyond the fully extended shelf')};assert.ok(maxSpeed<25);h.cleanup();
 const idle=await feeder({feed:false,observe:true}),stoppedControl=await feeder({feed:true,stopped:true,observe:true});
 // New medals can push older stock onward before they themselves cross the
 // lower lip. Require that causal response against BOTH physical controls.
 assert.ok(causal.rear.lower>=24&&causal.rear.captured>=48,'substantial original rear-ring stock crosses the lower bed and reaches the tray');
 assert.ok(causal.stock.captured>idle.stock.captured+50&&causal.stock.captured>stoppedControl.stock.captured+50,'authored feeder supply adds real stock capture beyond idle and stopped controls');
 assert.ok(causal.rear.meanAdvance>idle.rear.meanAdvance+1&&causal.rear.meanAdvance>stoppedControl.rear.meanAdvance+1,'rear stock transfers, not merely rides the 1.6-unit stroke');
 assert.equal(stoppedControl.rear.captured,0);assert.ok(stoppedControl.rear.meanAdvance<.02,'stopped shelf has no hidden forward drive');
 console.log('PASS actual left/right ramp → upper shelf → causal lower-field stock transfer',json({live:causal,idle,stopped:stoppedControl}));
}
// This earned-only remainder fixture deliberately starts with no bay reserve;
// default128-stock geometry and rights are exercised by the geometry group.
async function tower(){
 const h=await start(390,500,{initialStock:0}),{rt,review:v}=h,P=h.load('src/store/pusher.ts'),T=h.load('src/store/tower.ts'),tracked=new Map(),phases=new Set(),supports=[],obstructions=[];
 let fixedPenetration=0,maxSpeed=0,minAdvance=0,maxAdvance=0,toppled=false,originalRequest=null,recoveryAt=null,attempts=0;
 const initialSupports=rt.towerMachine.status().supports;rt.world.forEachRigidBody(b=>{if(b.isKinematic()&&initialSupports.some(p=>near(b.translation().x,p.x)&&near(b.translation().y,p.y)&&near(b.translation().z,p.z)))supports.push(b)});assert.equal(supports.length,2);
 const fixtures=colliders(h).filter(c=>!c.parent()||!rt.pieces.has(c.parent().handle)),count=T.TOWER.batchMax+1;v.cove.current=P.awardTower(v.cove.current,count,50,'bank');let frames=0;
 for(;frames<8500;frames++){
  // A substantial upright bundle may genuinely occupy the next lift sweep.
  // Establish that physical reason, then use only existing-hand legal DROP;
  // do not force, evict, refill, or relax the exact original batch-plus-one demand.
  if(recoveryAt!==null&&attempts<100&&(frames-recoveryAt)%40===0){v.dropOne();attempts++}
  h.advance();ledger(h);const state=rt.towerMachine.status();phases.add(state.stage);originalRequest??=state.requestId;
  for(const [id,p]of rt.pieces){let r=tracked.get(id);if(!r){if(!p.towerHeld||state.requestId!==originalRequest)continue;r={body:p.body,held:true,release:null};tracked.set(id,r)}assert.equal(p.body,r.body);if(!p.towerHeld){r.release??={...p.body.translation()};const at=p.body.translation(),q=p.body.rotation(),vel=p.body.linvel();maxSpeed=Math.max(maxSpeed,Math.hypot(vel.x,vel.y,vel.z));maxAdvance=Math.max(maxAdvance,at.z-r.release.z);minAdvance=Math.min(minAdvance,at.z-r.release.z);toppled||=1-2*(q.x*q.x+q.z*q.z)<.65}}
  if(frames%10===0)for(const support of supports)for(const c of fixtures){const body=c.parent();if(body&&supports.includes(body))continue;const contact=support.collider(0).contactCollider(c,.003);if(contact)fixedPenetration=Math.max(fixedPenetration,-contact.distance)}
  if(recoveryAt===null&&frames>=2499&&state.blocked&&state.pending>0){
   let blocked=false;const bottom=T.TOWER.releaseTop-.08,top=T.TOWER.buildTop+Math.ceil(state.batchSize/T.TOWER.medalsPerLayer)*T.TOWER.pitch;rt.world.intersectionsWithShape({x:T.TOWER.x/2,y:(top+bottom)/2,z:T.TOWER.z},{x:0,y:0,z:0,w:1},new R.Cuboid(Math.abs(T.TOWER.x)/2+1.2,(top-bottom)/2,.62),collider=>{const b=collider.parent(),p=b&&rt.pieces.get(b.handle);if(!p||p.towerHeld||p.counted||p.board)return true;obstructions.push({id:b.handle,at:b.translation(),original:tracked.has(b.handle)});blocked=true;return true});
   assert.equal(blocked,true,'a retained remainder must have real full-shape sweep obstruction');assert.ok(obstructions.some(p=>p.original),'the actual first bundle blocks its next lift, not an invented capacity pause');recoveryAt=frames+1;
  }
  if(tracked.size===count&&[...tracked.values()].every(r=>r.release)&&state.requestId!==originalRequest&&state.stage==='idle'&&frames>3200)break;
 }
 const state=rt.towerMachine.status();console.log('TOWER OBSERVATION',json({frames,drops:v.cove.current.dropped,originalCreated:tracked.size,originalReleased:[...tracked.values()].filter(r=>r.release).length,state}));assert.equal(tracked.size,count,'exact original broad batch plus remainder created: '+json(state));assert.ok([...tracked.values()].every(r=>r.held&&r.release),'all exact original tower bodies become ordinary field bodies, never replacements');assert.ok(state.released>=count);assert.notEqual(state.requestId,originalRequest,'original cradle returns after full request');assert.equal(state.stage,'idle','empty carriage fully parks after original request');assert.ok(maxAdvance>.65);assert.ok(toppled);assert.ok(maxSpeed<15);assert.ok(fixedPenetration<.015,'actual support penetrates fixed cabinet '+fixedPenetration);
 console.log('PASS actual broad tower retains and then delivers exact same-body remainder under ordinary legal play',json({count,frames,drops:v.cove.current.dropped,recoveryAt,obstructions,maxAdvance,minAdvance,maxSpeed,fixedPenetration,phases:[...phases],ledger:ledger(h)}));h.cleanup();
}


async function ballRoute(){
 const h=await start(),{rt,review:v}=h,C=h.load('src/store/motion.ts').CABINET,stock=new Set(rt.pieces.keys()),newBallIds=new Set();let attempts=0;let ball=null,first=null,shelf=false,pile=false,field=false,maxAdvance=0;
 v.practiceState.current.enabled=true;v.command.current('ball');assert.equal(v.practiceState.current.addedBalls,1);assert.equal(v.cove.current.hand,100);assert.equal(v.cove.current.ballsAwarded,0,'Practice sample is not an earned ball award');
 for(let frame=0;frame<6200;frame++){
  // Practice promises a ball on the shelf, not an autonomous capture. Use
  // only existing/actually collected hand for ordinary legal player drops.
  if(frame>=600&&attempts<100&&(frame-600)%40===0&&v.cove.current.hand>0){const before=v.cove.current.dropped;v.dropOne();attempts+=v.cove.current.dropped-before;}
  h.advance();ledger(h);const live=[...rt.pieces.values()].filter(p=>p.ball&&!stock.has(p.body.handle));for(const p of live)newBallIds.add(p.body.handle);assert.ok(newBallIds.size<=1+v.cove.current.ballsAwarded,'one sample plus only genuinely earned later balls');if(!ball&&live.length){ball=live[0];first={...ball.body.translation()};assert.ok(near(ball.body.collider(0).shape.radius,.44));assert.ok(Math.abs(first.x-(-6.12+(C?.sideShift??0)))<.15&&Math.abs(first.z+5.25)<.03,'visible rail hands off at its actual narrowed final point')}
  if(ball&&rt.pieces.has(ball.body.handle)){assert.equal(rt.pieces.get(ball.body.handle),ball);const at=ball.body.translation();if(at.y<1.3&&at.z>h.load('src/store/motion.ts').shelfFront(30))field=true;maxAdvance=Math.max(maxAdvance,at.z-first.z);const cp=rt.pusherBody.collider(0).contactCollider(ball.body.collider(0),.015);if(cp&&cp.distance<=.015)shelf=true;if(!pile)rt.world.contactPairsWith(ball.body.collider(0),other=>{const body=other.parent();if(body&&stock.has(body.handle))pile=true})}
 }
 console.log('BALL OBSERVATION',json({first,shelf,pile,field,maxAdvance,captured:v.cove.current.ballsCaptured,last:ball&&rt.pieces.has(ball.body.handle)?ball.body.translation():null}));assert.ok(ball);assert.ok(shelf&&pile,'same original sample reaches actual upper shelf and stock');assert.ok(attempts>0&&attempts<=100,'ordinary available-hand play was exercised, with no refill');assert.ok(field||maxAdvance>.65,'ordinary play produces meaningful forward response of the exact sample ball');assert.equal(v.practiceState.current.addedBalls,1,'sample supply remains exactly one');assert.ok(v.cove.current.ballsCaptured<=7+v.cove.current.ballsAwarded,'six starting balls plus one sample and genuine later awards only');console.log('PASS exact sample ball reaches upper stock and responds to legal play; capture is not guaranteed',json({first,shelf,pile,field,maxAdvance,drops:attempts,pending:!!ball&&rt.pieces.has(ball.body.handle)&&!ball.counted,captured:v.cove.current.ballsCaptured}));h.cleanup();
}

async function tideInterlock(){
 const h=await start(390,500,{initialStock:0}),{rt,review:v}=h,P=h.load('src/store/pusher.ts'),T=h.load('src/store/tower.ts'),S=h.load('src/store/tide.ts');
 // Earned-only stress fixture omits the initial bay reserve; default stock is tested above.
 const withDrops=true,towerCount=T.TOWER.batchMax+1,tideCount=25,states=new Set(),bodies=new Map(),byLane=new Map(),initial=rt.tideMachine.status();
 for(const part of [...initial.gates,...initial.rails]){
  const found=colliders(h).find(c=>c.parent()&&c.shape.type===R.ShapeType.Cuboid&&near(c.translation().x,part.position.x)&&near(c.translation().y,part.position.y)&&near(c.translation().z,part.position.z)&&near(c.halfExtents().x,part.halfSize.x)&&near(c.halfExtents().y,part.halfSize.y)&&near(c.halfExtents().z,part.halfSize.z));assert.ok(found,'actual '+part.lane+' '+part.kind+' collider');bodies.set(found.handle,{collider:found,lane:part.lane,kind:part.kind});if(!byLane.has(part.lane))byLane.set(part.lane,new Set());byLane.get(part.lane).add(found.handle);
 }
 assert.equal(bodies.size,15);const fixtures=colliders(h).filter(c=>!c.parent()||!rt.pieces.has(c.parent().handle)),towerIds=new Set();
 v.cove.current=P.awardTide(P.awardTower(v.cove.current,towerCount,50,'bank'),tideCount);h.advance(12);const tideId=rt.tideMachine.status().requestId;v.selectTideLane(tideId,'center');let fixedPenetration=0,worst=null,frames=0;
 for(;frames<(withDrops?12000:8500);frames++){
  if(withDrops&&frames>=2500&&frames<6500&&(frames-2500)%40===0){v.dropOne()}
  h.advance();ledger(h);const tower=rt.towerMachine.status(),tide=rt.tideMachine.status();states.add(tower.stage+'/'+tide.stage);for(const [id,p]of rt.pieces)if(p.towerHeld)towerIds.add(id);
  if(!['idle','choosing','waiting'].includes(tide.stage))assert.equal(tower.stage,'idle','moving Tide owns construction exclusion');
  for(const part of [...tide.gates,...tide.rails]){const meshes=[];rt.scene.traverse(o=>{if(o.name==='tide-'+part.lane+'-'+part.kind)meshes.push(o)});assert.ok(meshes.some(m=>near(m.position.x,part.position.x)&&near(m.position.y,part.position.y)&&near(m.position.z,part.position.z)&&near(m.geometry.parameters.width,part.halfSize.x*2)&&near(m.geometry.parameters.depth,part.halfSize.z*2)),'rendered '+part.lane+' '+part.kind+' exactly follows real shape')}
  if(frames%10===0)for(const own of bodies.values())for(const other of fixtures){if(byLane.get(own.lane).has(other.handle))continue;const body=other.parent();if(body&&rt.pieces.has(body.handle))continue;const cp=own.collider.contactCollider(other,.002);if(cp&&-cp.distance>fixedPenetration){fixedPenetration=-cp.distance;worst={lane:own.lane,kind:own.kind,at:own.collider.translation(),other:other.translation(),otherHalf:other.shape.type===R.ShapeType.Cuboid?other.halfExtents():null}}}
  if(tower.released>=towerCount&&tide.lastCompleted?.id===tideId)break;
 }

 const tower=rt.towerMachine.status(),tide=rt.tideMachine.status(),blockers=[];
 assert.ok(tower.released>=towerCount,'the entire first FIFO tower must release under legal play: '+json(tower));assert.ok(fixedPenetration<.015,'real Tide hardware penetrates fixed machine: '+json({fixedPenetration,worst}));
 if(tide.lastCompleted?.id===tideId){
  assert.equal(tide.lastCompleted.released,tideCount);const center=tide.gates.find(p=>p.lane==='center');assert.ok(near(center.position.x,S.TIDE.centerParkX));assert.ok(near(center.position.z,S.tideLaneZ('center')+S.TIDE.opening));
 }else{
  assert.equal(tide.requestId,tideId);assert.equal(tide.lane,'center');assert.equal(tide.pending+tide.requestReleased,tideCount);assert.equal(tide.blocked,true);assert.equal(tower.stage,'idle','no circular mechanism ownership');
  if(tide.stage==='deploying'||tide.stage==='parking'){
   const parking=tide.stage==='parking',x=tide.gates.find(p=>p.lane==='center').position.x,smooth=t=>t*t*(3-2*t),atAge=age=>parking?S.TIDE.lanes.center+(S.TIDE.centerParkX-S.TIDE.lanes.center)*smooth(age/S.TIDE.travelFrames):S.TIDE.centerParkX+(S.TIDE.lanes.center-S.TIDE.centerParkX)*smooth(age/S.TIDE.travelFrames);let age=0;for(let i=1;i<=S.TIDE.travelFrames;i++)if(Math.abs(atAge(i)-x)<Math.abs(atAge(age)-x))age=i;const dx=atAge(Math.min(age+1,S.TIDE.travelFrames))-x;
   for(const part of [...tide.gates,...tide.rails].filter(p=>p.lane==='center')){
    const from=part.position,half=part.halfSize,shape=new R.Cuboid(half.x+Math.abs(dx)/2,half.y,half.z);
    rt.world.intersectionsWithShape({x:from.x+dx/2,y:from.y,z:from.z},{x:0,y:0,z:0,w:1},shape,c=>{if(c.isSensor()||byLane.get('center').has(c.handle))return true;const b=c.parent(),p=b&&rt.pieces.get(b.handle);blockers.push({part:part.kind,body:b?.handle??null,at:c.translation(),piece:!!p,towerOrigin:!!b&&towerIds.has(b.handle),ball:!!p?.ball});return true});
   }
  }else if(tide.stage==='waiting')S.tideLoadBlocked(rt.world,'center',b=>{const p=rt.pieces.get(b.handle);if(!p||p.tideHeld||p.counted)return false;blockers.push({part:'loading',body:b.handle,at:b.translation(),piece:true,towerOrigin:towerIds.has(b.handle),ball:p.ball});return true});
  assert.ok(blockers.length,'a still-owed stress award must have independently measured actual next-sweep obstruction, not merely blocked status: '+json({tower,tide}));assert.ok(blockers.every(b=>b.piece),'no fixed geometry may permanently block the real traveler: '+json(blockers));
 }
 console.log('PASS concurrent physical tower/Tide interlock keeps exact pending rights at verified real backpressure or completes via actual bodies',json({frames,drops:v.cove.current.dropped,towerReleased:tower.released,tideReleased:tide.requestReleased||tide.lastCompleted?.released||0,tidePending:tide.pending,tideStage:tide.stage,fixedPenetration,blockers,states:[...states],ledger:ledger(h)}));h.cleanup();

}

(async()=>{
 const selection=process.argv[2]||'all';let passed=0;
 if(selection==='all'||selection==='geometry'){const h=await start();checkGeometry(h);h.cleanup();passed++}
 if(selection==='all'||selection==='aims'){await aims();passed++}
 if(selection==='all'||selection==='feeder'){await feeder();passed++}
 if(selection.startsWith('feeder-data')){await feeder({feed:selection!=='feeder-data-idle',stopped:selection==='feeder-data-stopped',observe:true});passed++}
 if(selection==='all'||selection==='tower'){await tower();passed++}
 if(selection==='all'||selection==='tide'){await tideInterlock();passed++}
 if(selection==='all'||selection==='ball'){await ballRoute();passed++}
 console.log(`${passed}/${passed} independent compact-cabinet production groups passed (CPU/Rapier, not GPU pixels).`)
})().catch(e=>{console.error('FAIL independent compact probe',e);process.exit(1)});
