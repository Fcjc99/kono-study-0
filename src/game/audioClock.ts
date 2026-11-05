/** What's reaching the speakers right now, on an AudioContext's clock (seconds), smoothed (see heardNow).
 * The sound card says what it played at a given moment, so that's carried forward on the frame clock. That
 * timestamp is checked first:
 * some browsers (older Safari) report one that's far off, and then it's the card's clock less its reported
 * delay to the speakers. A device's own extra delay (Bluetooth, the screen, the finger) isn't known to the
 * browser: KONO Beat's Sync check measures it. */
function heardRaw(ctx:AudioContext):number{
 const fallback=ctx.currentTime-(ctx.outputLatency||ctx.baseLatency||0)
 const ts=ctx.getOutputTimestamp?.()
 if(!ts||ts.contextTime===undefined||!ts.performanceTime)return fallback
 const at=ts.contextTime+(ctx.state==='running'?Math.max(0,performance.now()-ts.performanceTime)/1000:0)
 return Math.abs(at-fallback)<0.25?at:fallback
}
// The browser's audio clock moves in steps (a few ms on a desktop, up to a tenth of a second or more on some
// phones), so read straight it jumps. Each context gets a smooth clock instead: it runs on the frame clock
// and is pulled a fifth of the way toward the audio clock whenever that moves, never backward; a big gap
// (a pause, a stall) snaps it.
const smooth=new WeakMap<AudioContext,{base:number;perf:number;raw:number}>()
export function heardNow(ctx:AudioContext):number{
 const raw=heardRaw(ctx),p=performance.now()/1000,s=smooth.get(ctx)
 if(!s||ctx.state!=='running'){smooth.set(ctx,{base:raw,perf:p,raw});return raw}
 const est=s.base+(p-s.perf)
 if(Math.abs(raw-est)>0.2){smooth.set(ctx,{base:raw,perf:p,raw});return raw}
 if(raw!==s.raw){s.base=est+(raw-est)*0.2;s.perf=p;s.raw=raw;return s.base}
 return est
}

/** A short soft click at `when` (context time), for the Sync check's beat and the note ticks. */
export function click(ctx:AudioContext,when:number,{freq=1600,gain=0.22,accent=false}:{freq?:number;gain?:number;accent?:boolean}={}){
 const o=ctx.createOscillator(),g=ctx.createGain()
 o.type='triangle';o.frequency.value=accent?freq*1.5:freq
 g.gain.setValueAtTime(0,when);g.gain.linearRampToValueAtTime(accent?gain*1.3:gain,when+0.002);g.gain.exponentialRampToValueAtTime(0.0001,when+0.06)
 o.connect(g).connect(ctx.destination);o.start(when);o.stop(when+0.07)
}

/** A soft piano-like note (MIDI `midi`) at `when`: a few sine partials, a quick strike and a long fade (longer
 * for a long tile). KONO Beat plays one for each tile you hit, the same note the melody plays there. */
export function keyNote(ctx:AudioContext,when:number,midi:number,{gain=0.14,long=false}:{gain?:number;long?:boolean}={}){
 const f=440*2**((midi-69)/12),fade=long?1.6:0.9,out=ctx.createGain(),lp=ctx.createBiquadFilter()
 lp.type='lowpass';lp.frequency.value=Math.min(9000,f*6);lp.connect(ctx.destination);out.connect(lp)
 out.gain.setValueAtTime(0,when);out.gain.linearRampToValueAtTime(gain,when+0.004);out.gain.exponentialRampToValueAtTime(gain*0.35,when+0.12);out.gain.exponentialRampToValueAtTime(0.0001,when+fade)
 for(const [h,g] of [[1,1],[2,0.35],[3,0.12],[4,0.06]] as const){const o=ctx.createOscillator(),og=ctx.createGain();o.type='sine';o.frequency.value=f*h;og.gain.value=g;o.connect(og).connect(out);o.start(when);o.stop(when+fade+0.05)}
}
