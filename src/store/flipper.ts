/** Automatic feeder drive, in active 60 Hz simulation steps. No wall clock or RNG.
 * This is gameplay motion: motion-effect preferences do not stop the feeder. */
export const FLIPPER_PERIOD = 360
export function flipperPose(frame:number,halfWidth:number){
 const phase=(Number.isFinite(frame)?Math.max(0,frame):0)*Math.PI*2/FLIPPER_PERIOD
 const x=Math.sin(phase)*Math.max(0,halfWidth)*.94
 return {x,aim:50+x/(Math.max(.001,halfWidth)/45),tilt:-Math.cos(phase)*.24}
}
