/** Medal Cove's drawing quality on slower phones. The machine starts at HD; while it plays, KONO watches how
 * long frames take and steps down (sharpness, shadows and glow) when a phone can't keep up, so the medals move
 * smoothly instead of stuttering. It only ever steps down during a round, never back up (no flicker between
 * levels), and it never touches the game: physics, odds and payouts don't depend on what's drawn. */
export type Quality={level:0|1|2;pixelRatio:number;shadow:number;bloomScale:number}
/** HD, lighter, lite. `max` is the most a device asks for (its screen's pixel ratio, capped). */
export function qualityAt(level:0|1|2,max:number):Quality{
 return level===0?{level,pixelRatio:max,shadow:2048,bloomScale:1}:level===1?{level,pixelRatio:Math.min(max,1.25),shadow:1024,bloomScale:0.6}:{level,pixelRatio:1,shadow:512,bloomScale:0.5}
}
/** Over the last `WINDOW` frames, a frame on average longer than this (ms) means the phone is struggling
 * (about 40 fps; a steady 60 fps is 16.7 ms). */
export const SLOW_MS=25
export const WINDOW=90
/** Frames ignored after a step down, while the new settings take hold. */
export const SETTLE=60
/** Watches frame times and says when to step down. `frame(ms)` returns the new level when it changes. */
export function createQualityWatch(start:0|1|2=0){
 let level=start,times:number[]=[],settle=SETTLE
 return {
  get level(){return level},
  frame(ms:number):0|1|2|null{
   // A long gap (a paused tab, the options open, a breakpoint) isn't the phone being slow.
   if(!(ms>0)||ms>250)return null
   if(settle>0){settle--;return null}
   times.push(ms);if(times.length>WINDOW)times.shift()
   if(level>=2||times.length<WINDOW)return null
   const avg=times.reduce((a,b)=>a+b,0)/times.length
   if(avg<=SLOW_MS)return null
   level=(level+1) as 0|1|2;times=[];settle=SETTLE
   return level
  },
 }
}
