const assert=require('assert/strict'),fs=require('fs'),vm=require('vm'),ts=require('typescript');
const intervals=new Set();const api={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/medalMusic.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:api,console,setInterval:fn=>(intervals.add(fn),fn),clearInterval:fn=>intervals.delete(fn)});
const flush=()=>new Promise(resolve=>setImmediate(resolve));
class FakeAudio{
 constructor(src){this.src=src;this.paused=true;this.currentTime=0;this.volume=1;this.listeners=new Map();this.plays=0;this.pauses=0}
 play(){this.plays++;if(this.reject)return Promise.reject(new Error('blocked'));this.paused=false;return Promise.resolve()}
 pause(){this.paused=true;this.pauses++}
 addEventListener(kind,fn){if(!this.listeners.has(kind))this.listeners.set(kind,[]);this.listeners.get(kind).push(fn)}
 emit(kind){for(const fn of this.listeners.get(kind)||[])fn()}
}
(async()=>{
 const made=[],music=api.createMedalMusic(src=>{const a=new FakeAudio(src);made.push(a);return a}),states=[];music.subscribe(s=>states.push(s));
 music.setEnabled(true);music.setActive(true);assert.equal(made.length,0,'no media until user gesture');assert.equal(music.getStatus(),'ready');
 music.unlock();await flush();assert.equal(made.length,1);const bed=made[0];assert.equal(bed.loop,true);assert.equal(bed.preload,'none');assert.equal(bed.paused,false);assert.equal(music.getStatus(),'playing');
 for(let i=0;i<100;i++)music.setActive(true);assert.equal(bed.plays,1,'no frame-by-frame play calls');
 assert.equal(music.cue('bonus'),true);await flush();const bonus=made[1];assert.equal(bed.volume,.32*.22);assert.equal(music.cue('bonus'),false,'no repeated cue');
 assert.equal(music.cue('jackpot'),true);await flush();const jackpot=made[2];assert.equal(bonus.paused,true);assert.equal(music.cue('tower'),false,'lower-priority cue never interrupts jackpot');assert.equal(made.length,3);
 bonus.emit('ended');assert.equal(jackpot.paused,false,'stale ended callback cannot kill current cue');
 jackpot.currentTime=5;music.setHidden(true);assert.ok(bed.paused&&jackpot.paused);assert.equal(music.getStatus(),'paused');assert.equal(music.cue('tower'),false);music.setHidden(false);await flush();assert.equal(jackpot.currentTime,5);assert.ok(!bed.paused&&!jackpot.paused);assert.equal(bed.volume,.32*.22,'bed remains ducked after pause');
 music.setActive(false);assert.ok(bed.paused&&jackpot.paused);music.setActive(true);await flush();jackpot.emit('ended');assert.equal(bed.volume,.32);assert.equal(jackpot.paused,true);
 music.setVolume(.5);assert.equal(bed.volume,.5);assert.equal(music.cue('tower'),true);await flush();const tower=made.at(-1);tower.currentTime=22;tower.emit('timeupdate');assert.equal(tower.paused,true);assert.equal(bed.volume,.5);
 music.setEnabled(false);assert.equal(bed.paused,true);assert.equal(music.getStatus(),'off');const count=made.length;assert.equal(music.cue('jackpot'),false);assert.equal(made.length,count);music.unlock();assert.equal(bed.paused,true);
 music.setTrack('sanctuary');assert.equal(made.length,count,'track selection while muted makes no request');music.setEnabled(true);await flush();const calm=made.at(-1);assert.match(calm.src,/calm-sanctuary/);assert.equal(calm.paused,false);assert.equal(bed.paused,true);
 calm.currentTime=10;music.reset();assert.equal(calm.currentTime,0);music.dispose();assert.equal(calm.paused,true);music.unlock();assert.equal(calm.paused,true);
 const deferred=[],pending=api.createMedalMusic(src=>{const a=new FakeAudio(src);a.play=function(){this.paused=false;return new Promise(resolve=>deferred.push(resolve))};made.push(a);return a});pending.setEnabled(true);pending.setActive(true);pending.unlock();const old=made.at(-1);pending.setTrack('sanctuary');const newer=made.at(-1);pending.setEnabled(false);deferred.forEach(r=>r());await flush();assert.ok(old.paused&&newer.paused,'late play promises cannot defeat mute or track change');pending.dispose();
 const bad=new FakeAudio('bad');bad.reject=true;const retry=api.createMedalMusic(()=>bad);retry.setActive(true);retry.setEnabled(true);retry.unlock();await flush();assert.equal(retry.getStatus(),'unavailable');bad.reject=false;retry.unlock();await flush();assert.equal(retry.getStatus(),'playing');retry.dispose();
 const attempts=[],rapidAudio=new FakeAudio('rapid');rapidAudio.play=function(){this.paused=false;this.plays++;return new Promise((resolve,reject)=>attempts.push({resolve,reject}))};const rapid=api.createMedalMusic(()=>rapidAudio);rapid.setEnabled(true);rapid.setActive(true);rapid.unlock();rapid.setHidden(true);rapid.setHidden(false);assert.equal(attempts.length,2);attempts[0].reject(Object.assign(new Error('aborted'),{name:'AbortError'}));attempts[1].resolve();await flush();assert.equal(rapid.getStatus(),'playing');assert.equal(rapidAudio.paused,false);rapid.dispose();
 const eventFail=[],nonfatal=api.createMedalMusic(src=>{const a=new FakeAudio(src);if(src.includes('bonus-adventure'))a.reject=true;eventFail.push(a);return a});nonfatal.setEnabled(true);nonfatal.setActive(true);nonfatal.unlock();await flush();nonfatal.cue('bonus');await flush();assert.equal(nonfatal.cue('tower'),true);nonfatal.setActive(false);nonfatal.setActive(true);await flush();assert.equal(eventFail[0].paused,false);nonfatal.dispose();
 const stalled=[],watch=api.createMedalMusic(src=>{const a=new FakeAudio(src);stalled.push(a);return a});watch.setEnabled(true);watch.setActive(true);watch.unlock();await flush();watch.cue('bonus');await flush();for(let i=0;i<101;i++)for(const fn of [...intervals])fn();assert.equal(stalled[1].paused,true);assert.equal(stalled[0].volume,.32);watch.dispose();
 console.log('PASS music gesture gating, mute, background selection, single priority cue, interruption, pause/resume, bounds, retry, late promises and teardown');
})().catch(e=>{console.error(e);process.exitCode=1});
