const assert=require('assert/strict'),fs=require('fs'),{start}=require('./production_runtime.cjs');
(async()=>{
 const h=await start(390,500,{initialStock:0}),v=h.review,cues=[];v.musicRef.current={cue:kind=>cues.push(kind),setActive(){}};h.advance(3);
 v.cove.current={...v.cove.current,dish:{pocket:0,at:v.cove.current.frame+2,launchId:8001}};h.advance(1);assert.equal(cues.length,0);h.advance(3);assert.deepEqual(cues,['bonus']);h.advance(10);assert.equal(cues.filter(x=>x==='bonus').length,1,'same draw never repeats every frame');
 v.cove.current={...v.cove.current,dish:null,chance:{pocket:0,at:v.cove.current.frame,launchId:8002},winPockets:12};h.advance(202);assert.equal(cues.filter(x=>x==='jackpot').length,1,'real jackpot win cues once');h.advance(10);assert.equal(cues.filter(x=>x==='jackpot').length,1);
 h.cleanup();const t=await start(390,500,{initialStock:0});t.review.musicRef.current={cue:kind=>cues.push(kind),setActive(){}};t.review.cove.current=t.load('src/store/pusher.ts').awardTower(t.review.cove.current,8);for(let i=0;i<1200&&!cues.includes('tower');i++)t.advance();assert.ok(cues.includes('tower'),'physical construction triggers tower cue');t.cleanup();
 const src=fs.readFileSync('src/components/MedalCove.tsx','utf8'),main=fs.readFileSync('src/main.tsx','utf8');assert.match(src,/music\?\.setActive\(hud.ready&&!blocked&&!detailsPaused&&!looking&&!fail\)/);assert.match(main,/music.player\?\.setActive\(false\);setResult/);assert.match(main,/Mute coin sound effects/);assert.match(main,/Mute music/);
 console.log('PASS production music cues follow actual bonus launch, jackpot win and physical tower build; independent mute and lifecycle gates wired');
})().catch(e=>{console.error(e);process.exitCode=1});
