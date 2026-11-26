/** KONO's sound engine (loaded the first time a sound plays): every app sound in five packs, made with Web Audio
 * so there's nothing to download; your own uploaded sounds (kept on this device in IndexedDB); and the Focus
 * soundscapes (rain, waves, a fireplace, a café, birds, brown noise), also made live, mixed at your levels. */
import {readSoundPrefs,type ScapeKind,type SoundEvent,type SoundPack,type SoundPrefs} from './prefs'

let ctx:AudioContext|null=null
function audio(){
 try{ctx??=new AudioContext()}catch{return null}
 if(ctx.state==='suspended')void ctx.resume().catch(()=>undefined)
 return ctx
}
/** Note number (60 = middle C) to Hz. */
const hz=(n:number)=>440*2**((n-69)/12)
/** Each moment as notes: [note, start (s), length (s), loudness 0–1]. */
const TUNES:Record<SoundEvent,[number,number,number,number][]>={
 done:[[79,0,.12,.8],[84,.09,.32,1]],
 dayDone:[[72,0,.14,.7],[76,.1,.14,.75],[79,.2,.14,.8],[84,.3,.5,1],[91,.42,.4,.35]],
 start:[[72,0,.18,.7],[79,.14,.36,.8]],
 timer:[[88,0,.3,1],[84,.28,.3,.9],[79,.56,.5,.9],[88,1.3,.3,.8],[84,1.58,.3,.7],[79,1.86,.7,.7]],
 add:[[81,0,.1,.7],[86,.06,.16,.6]],
 move:[[76,0,.08,.6],[81,.06,.14,.65]],
 remove:[[69,0,.1,.6],[64,.08,.2,.55]],
 tap:[[96,0,.03,.35]],
 nope:[[62,0,.09,.6],[62,.13,.12,.5]],
}
type Voice={wave:OscillatorType;octave:number;attack:number;decay:number;gain:number;partials:[number,number][]}
const PACKS:Record<SoundPack,Voice>={
 kono:{wave:'triangle',octave:0,attack:.008,decay:1,gain:.22,partials:[[1,1]]},
 soft:{wave:'sine',octave:-12,attack:.03,decay:1.4,gain:.3,partials:[[1,1],[2,.15]]},
 marimba:{wave:'sine',octave:-12,attack:.003,decay:.55,gain:.32,partials:[[1,1],[3.93,.35],[9.2,.08]]},
 bells:{wave:'sine',octave:0,attack:.004,decay:3,gain:.16,partials:[[1,1],[2.76,.45],[5.4,.22],[8.93,.1]]},
 arcade:{wave:'square',octave:0,attack:.002,decay:.7,gain:.07,partials:[[1,1]]},
}
function playTune(event:SoundEvent,pack:SoundPack,volume:number,level=0){
 const a=audio();if(!a)return
 const v=PACKS[pack],out=a.createGain(),now=a.currentTime+.01
 out.gain.value=volume;out.connect(a.destination)
 const lift=Math.min(level,8)
 for(const [note,start,length,loud] of TUNES[event]){
  const at=now+start,len=Math.max(.04,length*v.decay)
  for(const [ratio,amp] of v.partials){
   const osc=a.createOscillator(),g=a.createGain()
   osc.type=ratio===1?v.wave:'sine'
   osc.frequency.setValueAtTime(hz(note+v.octave+lift)*ratio,at)
   if(pack==='arcade'&&event!=='tap')osc.frequency.setValueAtTime(hz(note+lift+12),at+len*.35)
   g.gain.setValueAtTime(0,at)
   g.gain.linearRampToValueAtTime(v.gain*loud*amp,at+v.attack)
   g.gain.exponentialRampToValueAtTime(.0001,at+len*(ratio===1?1:.45))
   osc.connect(g).connect(out);osc.start(at);osc.stop(at+len+.05)
  }
 }
}

// ── Your own sounds (Settings › Sound): kept on this device only, never synced.
const DB='kono-sounds',STORE='clips'
function db():Promise<IDBDatabase>{return new Promise((ok,no)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE)};r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error??new Error('No sound storage here.'))})}
async function tx<T>(mode:IDBTransactionMode,run:(s:IDBObjectStore)=>IDBRequest|void):Promise<T|undefined>{
 const d=await db()
 try{return await new Promise<T|undefined>((ok,no)=>{const t=d.transaction(STORE,mode),req=run(t.objectStore(STORE));t.oncomplete=()=>ok(req?req.result as T:undefined);t.onerror=()=>no(t.error??new Error('Sound storage failed.'))})}finally{d.close()}
}
export const MAX_CLIP_BYTES=2_000_000
const urls=new Map<string,string>()
export async function saveClip(event:'done'|'timer'|'start',file:Blob){
 if(file.size>MAX_CLIP_BYTES)throw new Error('That sound is over 2 MB. Try a shorter clip.')
 if(file.type&&!file.type.startsWith('audio/'))throw new Error('That isn’t a sound file. Try an MP3, M4A, WAV or OGG.')
 await tx('readwrite',s=>s.put(file,event))
 const old=urls.get(event);if(old)URL.revokeObjectURL(old);urls.delete(event)
}
export async function deleteClip(event:'done'|'timer'|'start'){await tx('readwrite',s=>s.delete(event));const old=urls.get(event);if(old)URL.revokeObjectURL(old);urls.delete(event)}
async function clipUrl(event:string){
 const hit=urls.get(event);if(hit)return hit
 const blob=await tx<Blob>('readonly',s=>s.get(event));if(!blob)return null
 const url=URL.createObjectURL(blob);urls.set(event,url);return url
}
let playing:HTMLAudioElement|null=null
async function playClip(event:'done'|'timer'|'start',volume:number,maxSeconds:number){
 const url=await clipUrl(event);if(!url)return false
 playing?.pause()
 const a=new Audio(url);a.volume=Math.min(1,volume);playing=a
 await a.play()
 window.setTimeout(()=>{if(playing===a){a.pause()}},maxSeconds*1000)
 return true
}

/** Play `event` the way these prefs say: your uploaded sound if there is one, else the pack's. */
export async function playEvent(event:SoundEvent,p:SoundPrefs=readSoundPrefs(),level=0){
 const volume=p.volume
 if((event==='done'||event==='timer'||event==='start')&&p.custom[event]){
  try{if(await playClip(event,volume,event==='timer'?12:4))return}catch{/* fall back to the pack */}
 }
 if(p.pack==='kono'&&(event==='done'||event==='dayDone')){
  try{const a=new Audio('/audio/completion.wav') as HTMLAudioElement&{preservesPitch?:boolean};a.preservesPitch=false;a.playbackRate=event==='dayDone'?1.12:Math.min(1.6,1+level*.08);a.volume=Math.min(1,.55*volume);await a.play()
   if(event==='dayDone')playTune('dayDone','bells',volume*.6)
   return}catch{/* fall through to the synth */}
 }
 playTune(event,p.pack,volume,level)
}
/** A short preview of a pack (for Settings). */
export function previewPack(pack:SoundPack,volume:number){playTune('done',pack,volume);window.setTimeout(()=>playTune('add',pack,volume),520)}

// ── Focus soundscapes.
type Layer={gain:GainNode;stop:()=>void}
let scapeOut:GainNode|null=null
const layers=new Map<ScapeKind,Layer>()
function noise(a:AudioContext,kind:'white'|'brown'){
 const len=a.sampleRate*4,buf=a.createBuffer(1,len,a.sampleRate),d=buf.getChannelData(0)
 let last=0
 for(let i=0;i<len;i++){const w=Math.random()*2-1;if(kind==='white')d[i]=w*.5;else{last=(last+.02*w)/1.02;d[i]=last*3.2}}
 const s=a.createBufferSource();s.buffer=buf;s.loop=true;return s
}
function filter(a:AudioContext,type:BiquadFilterType,freq:number,q=.7){const f=a.createBiquadFilter();f.type=type;f.frequency.value=freq;f.Q.value=q;return f}
/** Things that happen now and then (a crackle, a clink, a chirp), at random gaps. */
function every(min:number,max:number,run:()=>void){let t=0;const next=()=>{t=window.setTimeout(()=>{run();next()},min+Math.random()*(max-min))};next();return()=>window.clearTimeout(t)}
function blip(a:AudioContext,to:AudioNode,freq:number,len:number,gain:number,type:OscillatorType='sine',sweep=1){
 const o=a.createOscillator(),g=a.createGain(),at=a.currentTime+.01
 o.type=type;o.frequency.setValueAtTime(freq,at);if(sweep!==1)o.frequency.exponentialRampToValueAtTime(freq*sweep,at+len)
 g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(gain,at+.004);g.gain.exponentialRampToValueAtTime(.0001,at+len)
 o.connect(g).connect(to);o.start(at);o.stop(at+len+.02)
}
function crackle(a:AudioContext,to:AudioNode,gain:number){
 const s=noise(a,'white'),g=a.createGain(),hp=filter(a,'highpass',1800),at=a.currentTime+.01,len=.01+Math.random()*.03
 g.gain.setValueAtTime(gain,at);g.gain.exponentialRampToValueAtTime(.0001,at+len)
 s.connect(hp).connect(g).connect(to);s.start(at,Math.random()*3);s.stop(at+len+.02)
}
function lfo(a:AudioContext,target:AudioParam,rate:number,depth:number){const o=a.createOscillator(),g=a.createGain();o.frequency.value=rate;g.gain.value=depth;o.connect(g).connect(target);o.start();return o}
function buildLayer(a:AudioContext,kind:ScapeKind,out:AudioNode):Layer{
 const gain=a.createGain();gain.gain.value=0;gain.connect(out)
 const nodes:AudioScheduledSourceNode[]=[],timers:(()=>void)[]=[]
 if(kind==='rain'){
  const n=noise(a,'white'),hp=filter(a,'highpass',500),lp=filter(a,'lowpass',6500),g=a.createGain();g.gain.value=.55
  n.connect(hp).connect(lp).connect(g).connect(gain);n.start();nodes.push(n)
  timers.push(every(30,160,()=>crackle(a,gain,.05+Math.random()*.08)))
 }else if(kind==='brown'){
  const n=noise(a,'brown'),lp=filter(a,'lowpass',600),g=a.createGain();g.gain.value=.9
  n.connect(lp).connect(g).connect(gain);n.start();nodes.push(n)
 }else if(kind==='waves'){
  const n=noise(a,'brown'),lp=filter(a,'lowpass',1100),g=a.createGain();g.gain.value=.55
  n.connect(lp).connect(g).connect(gain);n.start();nodes.push(n,lfo(a,g.gain,.085,.45),lfo(a,lp.frequency,.085,500))
 }else if(kind==='fire'){
  const n=noise(a,'brown'),lp=filter(a,'lowpass',420),g=a.createGain();g.gain.value=.8
  n.connect(lp).connect(g).connect(gain);n.start();nodes.push(n,lfo(a,g.gain,.4,.15))
  timers.push(every(60,420,()=>crackle(a,gain,.15+Math.random()*.25)))
 }else if(kind==='cafe'){
  const n=noise(a,'brown'),bp=filter(a,'bandpass',380,.9),g=a.createGain();g.gain.value=1.1
  n.connect(bp).connect(g).connect(gain);n.start();nodes.push(n,lfo(a,g.gain,.23,.35),lfo(a,bp.frequency,.17,120))
  timers.push(every(1800,6500,()=>{const f=2400+Math.random()*1600;blip(a,gain,f,.35,.05);if(Math.random()<.5)window.setTimeout(()=>blip(a,gain,f*1.07,.25,.035),90)}))
 }else{
  timers.push(every(900,4200,()=>{const base=2600+Math.random()*1800,count=2+Math.floor(Math.random()*4)
   for(let i=0;i<count;i++)window.setTimeout(()=>blip(a,gain,base*(1+Math.random()*.08),.09,.06,'sine',1.35),i*(110+Math.random()*60))}))
  const n=noise(a,'white'),lp=filter(a,'lowpass',900),g=a.createGain();g.gain.value=.06
  n.connect(lp).connect(g).connect(gain);n.start();nodes.push(n)
 }
 return {gain,stop:()=>{timers.forEach(t=>t());nodes.forEach(n=>{try{n.stop()}catch{/* already stopped */}});gain.disconnect()}}
}
/** Set the soundscape to this mix (each layer 0–1, at the overall volume); an empty mix stops it. */
export function setScape(mix:Partial<Record<ScapeKind,number>>,volume=readSoundPrefs().volume){
 const kinds=(Object.keys(mix) as ScapeKind[]).filter(k=>(mix[k]??0)>0)
 if(!kinds.length&&!layers.size)return
 const a=audio();if(!a)return
 if(!scapeOut){scapeOut=a.createGain();scapeOut.gain.value=0;scapeOut.connect(a.destination)}
 scapeOut.gain.setTargetAtTime(volume*.9,a.currentTime,.3)
 for(const [k,l] of layers)if(!kinds.includes(k)){l.gain.gain.setTargetAtTime(0,a.currentTime,.25);const old=l;window.setTimeout(()=>old.stop(),1200);layers.delete(k)}
 for(const k of kinds){
  let l=layers.get(k);if(!l){l=buildLayer(a,k,scapeOut);layers.set(k,l)}
  l.gain.gain.setTargetAtTime((mix[k]??0)*.8,a.currentTime,.4)
 }
}
export const stopScape=()=>setScape({})
export const scapePlaying=()=>layers.size>0
