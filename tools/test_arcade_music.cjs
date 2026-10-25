// The arcade's recorded soundtracks (src/arcadeAudio): KONO Flow's songs start, change part with a
// crossfade, loop without a gap (the next copy starts over the last 3 seconds), slow down in Flow, rest
// while the app is in the background, and stop. Audio and the page are stand-ins.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript')
const root=path.resolve(__dirname,'..')
const made=[],listeners={}
class FakeAudio{
 constructor(src){this.src=src;this.volume=1;this.playbackRate=1;this.paused=true;this.currentTime=0;this.duration=120;this.on={};made.push(this)}
 addEventListener(k,f){(this.on[k]??=[]).push(f)}
 fire(k){for(const f of this.on[k]??[])f()}
 play(){this.paused=false;return Promise.resolve()}
 pause(){this.paused=true}
}
const document={hidden:false,addEventListener(k,f){(listeners[k]??=[]).push(f)}}
const store=new Map()
const sandbox={module:{exports:{}},Audio:FakeAudio,document,performance:{now:()=>Date.now()},requestAnimationFrame:f=>setTimeout(()=>f(),0),localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)},window:{setInterval,clearInterval,setTimeout,clearTimeout},setTimeout,Math,Set,Map,Promise,console}
sandbox.exports=sandbox.module.exports
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,'src/arcadeAudio.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,sandbox)
const A=sandbox.module.exports
const playing=()=>made.filter(a=>!a.paused)
const tick=()=>new Promise(r=>setTimeout(r,30))
;(async()=>{
 A.startMusic('flow',true,1)
 assert.equal(made.at(-1).src,'/audio/games/flow-1.mp3','the first stage plays song 1')
 await tick()
 assert.ok(made.at(-1).volume>0,'it fades in')
 // Near the end the next copy starts over the old one's fade-out: no gap, both play for a moment.
 const first=made.at(-1);first.currentTime=117.5;first.fire('timeupdate')
 assert.equal(made.length,2,'a second copy starts for the loop');assert.equal(made[1].src,first.src)
 assert.equal(playing().length,2,'both copies play over the last 3 seconds')
 first.currentTime=118;first.fire('timeupdate');assert.equal(made.length,2,'a track hands off only once')
 first.paused=true;first.fire('ended');assert.ok(first.paused,'the old copy finishes');assert.equal(playing().length,1,'only the new copy plays on')
 // Flow: slower (same pitch) and softer, and a copy that starts meanwhile starts slow too.
 A.musicSlow(true);assert.equal(made[1].playbackRate,0.8);assert.equal(made[1].volume,0.3)
 made[1].currentTime=117.2;made[1].fire('timeupdate');assert.equal(made[2].playbackRate,0.8,'the next loop starts slowed')
 A.musicSlow(false);assert.equal(made[2].playbackRate,1);assert.equal(made[1].playbackRate,1,'the finishing copy speeds up too')
 // A new stage: its song crossfades in.
 A.startMusic('flow',true,3)
 assert.equal(made.at(-1).src,'/audio/games/flow-3.mp3')
 await new Promise(r=>setTimeout(r,1000))
 assert.deepEqual(playing().map(a=>a.src),['/audio/games/flow-3.mp3'],'the old song fades out and stops')
 // In the background the music rests, and it comes back on return.
 document.hidden=true;for(const f of listeners.visibilitychange)f()
 assert.equal(playing().length,0,'nothing plays in the background')
 document.hidden=false;for(const f of listeners.visibilitychange)f()
 assert.deepEqual(playing().map(a=>a.src),['/audio/games/flow-3.mp3'],'it picks up again')
 // 🎵 off and on, then the game ends.
 A.setMusicOn(false,true);assert.equal(playing().length,0)
 A.setMusicOn(true,true);assert.equal(made.at(-1).src,'/audio/games/flow-3.mp3','🎵 back on plays the same stage’s song')
 A.stopMusic();await new Promise(r=>setTimeout(r,600))
 assert.equal(playing().length,0,'stopMusic stops every copy')
 console.log('PASS arcade music: KONO Flow’s songs start, loop without a gap, slow in Flow, change stage, rest in the background and stop')
})().catch(e=>{console.error(e);process.exit(1)})
