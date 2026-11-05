// Real production Rapier bodies. Deliberate injection samples every source lane;
// no body relocation, invented kicks, or altered world parameters.
const assert=require('node:assert/strict'),{start}=require('./production_runtime.cjs');
(async()=>{const results=[];for(const x of [-3.5,-3,-2,-1,0,1,2,3,3.5]){
 const h=await start(390,428),{rt}=h,{PLINKO:B,BOARD_BACKSTOP:A,PUSHER_SHELF:S}=h.load('src/store/motion.ts');
 assert.ok(A.bottom-S.height>0&&A.bottom-S.height<.011);
 const before=new Set(rt.pieces.keys());rt.addCoin(x,B.top+.3,B.z,false,0,true);
 const p=[...rt.pieces.values()].find(p=>!before.has(p.body.handle));assert.ok(p&&p.board);const id=p.body.handle;
 let exit=null,pinContact=false,rearEscape=false,shelfContact=false,captured=false,positions=[];
 for(let f=0;f<1000;f++){h.advance();const piece=rt.pieces.get(id);if(!piece){assert.ok(captured,'only ship-captured sample may retire');break}const at=piece.body.translation();
  if(f%60===0)positions.push([f,at.x,at.y,at.z]);
  rt.world.contactPairsWith(piece.body.collider(0),other=>{const t=other.translation();if(!other.parent()&&Math.abs(t.z-B.z)<.01&&t.y>B.bottom&&t.y<B.top)pinContact=true;if(other===rt.pusherBody.collider(0))shelfContact=true});
  rearEscape ||=at.z<A.z-A.depth/2-.31;
  if(piece.capturedPocket!==undefined){captured=true;exit??=f;}else if(!piece.board){exit??=f; if(at.y<.2||shelfContact)break}
 }
 assert.notEqual(exit,null,'source lane '+x+' must leave board');assert.ok(!rearEscape,'source lane '+x+' cannot escape behind continuous apron');
 if(!captured)assert.ok(shelfContact||p.body.translation().y<.2,'miss reaches real shelf/bed, not frozen over screen');
 results.push({x,exit,pinContact,captured,shelfContact});h.cleanup();
 }assert.ok(results.some(x=>x.pinContact));assert.ok(results.some(x=>x.captured));assert.ok(results.some(x=>!x.captured));console.log('PASS nine raised source lanes: actual pin contacts, ship captures/misses and continuous physical shelf handoff',results)
})().catch(e=>{console.error(e);process.exit(1)});
