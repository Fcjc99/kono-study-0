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
