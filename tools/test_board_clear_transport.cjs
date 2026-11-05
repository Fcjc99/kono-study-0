// The actual production cabinet geometry and Rapier bodies, with GPU painting
// stubbed. Synthetic 900-eligible stress starts with no held bay supply; default
// 128-held stock protection is checked independently by the lifecycle suite.
const assert=require('node:assert/strict'),{start}=require('./production_runtime.cjs'),R=require('@dimforge/rapier3d-compat');
;(async()=>{const s=await start(390,500,{initialStock:0}),{rt}=s,B=s.load('src/store/boardClear.ts'),C=s.load('src/store/motion.ts').CABINET,columns=Math.floor((C.width-1)/.64),x0=-(columns-1)*.64/2;
const shape=new R.Cylinder(.055,.31),rotation={x:0,y:0,z:0,w:1};let skipped=0;
const free=at=>{let clear=true;rt.world.forEachCollider(c=>{if(c.isSensor())return;const contact=c.contactShape(shape,at,rotation,.001);if(contact&&contact.distance<-.001)clear=false});return clear};
for(let i=0;[...rt.pieces.values()].filter(p=>!p.ball).length<895;i++){
 assert.ok(i<50000,'900-body fixture has finite valid space');const at={x:x0+(i%columns)*.64,y:.5+Math.floor(i/(columns*15))*.13,z:-4+Math.floor(i/columns)%15*.64};if(!free(at)){skipped++;continue}rt.addCoin(at.x,at.y,at.z,false,0,false,true)
}
const ball=rt.addCoin(0,5,0,true);rt.world.forEachCollider(c=>{if(c.handle===ball.collider(0).handle||c.isSensor())return;const contact=c.contactCollider(ball.collider(0),.001);assert.ok(!contact||contact.distance>=-.001,'fixture ball begins above, not inside, the new starting towers')});for(let f=0;f<180;f++)rt.world.step();const preservedBalls=[...rt.pieces.values()].filter(p=>p.ball),ballPositions=preservedBalls.map(p=>({...p.body.translation()}));preservedBalls.forEach(p=>p.body.setBodyType(1,true));
// Manual fixture warmup bypasses production settlement. Remove only coins that
// production would ALREADY have classified lost before the clear was requested,
// then add distinct fresh fixture coins. The target identity set is taken later.
const capture=s.load('src/store/dispense.ts').capturePiece;
for(const[id,p]of rt.pieces)if(!p.ball&&capture(p.body.translation(),false,false)==='lost'){rt.world.removeRigidBody(p.body);rt.pieces.delete(id)}
for(let i=0;[...rt.pieces.values()].filter(p=>!p.ball).length<895;i++){const at={x:x0+(i%columns)*.64,y:3+Math.floor(i/columns)*.15,z:2.5};if(!free(at)){skipped++;continue}rt.addCoin(at.x,at.y,at.z,false,0,false,true)}
const tideGate=rt.tideMachine.status().gates.find(g=>g.lane==='center').position;
const extras=[rt.addCoin(0,4.8,-6.15,false,0,true),rt.addCoin(-6.2+C.sideShift,2.7,-5.25),rt.addCoin(tideGate.x,tideGate.y-.5,tideGate.z),rt.addCoin(C.halfWidth+.6,-.5,2),rt.addCoin(1,-1.2,1)];
extras[0].setEnabledTranslations(true,true,true,true);extras[0].setEnabledRotations(true,true,true,true);
const ids=[...rt.pieces].filter(([,p])=>!p.ball).map(([id])=>id);assert.equal(ids.length,900);
rt.world.step();
const motor=B.createBoardClearMachine(rt.world,{piece:id=>rt.pieces.get(id),obstacle:c=>{const p=c.parent()&&rt.pieces.get(c.parent().handle);return !p?.counted}}),collected=new Set(),retired=new Set();
const initialMinY=Math.min(...ids.map(id=>rt.pieces.get(id).body.translation().y));assert.equal(motor.begin(ids),true);let finished=0,minY=Infinity;
for(let frame=1;frame<=6500;frame++){
 motor.update(frame);rt.world.step();
 preservedBalls.forEach((p,i)=>assert.deepEqual({...p.body.translation()},ballPositions[i],'every frozen prize ball remains intact and untouched'));
 for(const id of ids){const p=rt.pieces.get(id);if(!p)continue;const at=p.body.translation();minY=Math.min(minY,at.y);
  if(!p.counted){const contact=rt.trayFloor.contactCollider(p.body.collider(0),.012);if(contact&&contact.distance<=.012&&contact.normal1.y>.4){assert.ok(!collected.has(id));collected.add(id);p.counted=frame}}
  if(p.counted&&frame-p.counted>90){p.body.setEnabled(false);p.body.setTranslation({x:at.x,y:at.y-.045,z:at.z},false)}
  if(p.counted&&at.y<-2.7){assert.ok(collected.has(id));rt.world.removeRigidBody(p.body);rt.pieces.delete(id);retired.add(id)}
 }
 if(motor.status().stage==='complete'){finished=frame;break}
}
const status=motor.status();assert.equal(status.stage,'complete',JSON.stringify({remaining:status.remaining,blocked:status.blocked,active:status.active.slice(0,12).map(a=>({...a,rotation:rt.pieces.get(a.id).body.rotation()}))}));assert.equal(collected.size,900);assert.equal(retired.size,900);assert.equal(rt.pieces.size,preservedBalls.length);assert.equal(rt.pieces.get(ball.handle).ball,true);assert.ok(minY>Math.min(-12,initialMinY-2),'escaped tray cargo is caught by the visible magnet before an unbounded fall: '+minY+' / '+initialMinY);
console.log('PASS 900 same-body medals, including pinboard/ramp/Tide-underpass/side-fall/underdeck starts, reach real tray and retire once; all prize balls preserved ('+finished+' physical frames)');
s.cleanup();console.log('1/1 dense Board Clear transport checks passed (production geometry + real Rapier, GPU stubbed).')
})().catch(e=>{console.error(e);process.exit(1)})
