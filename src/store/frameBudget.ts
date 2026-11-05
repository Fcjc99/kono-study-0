/** Fixed 60 Hz physics, bounded work per presented frame. Dropping wall-clock
 * debt is deliberate slow simulation under load; it never skips a rules step,
 * removes a medal, enlarges dt or fabricates a payout. */
export const PHYSICS_STEP_MS=1000/60
export const MAX_FRAME_STEPS=2
export const PHYSICS_WORK_BUDGET_MS=10
export function boundedAccumulator(previous:number,elapsed:number){
 return Math.min(PHYSICS_STEP_MS*MAX_FRAME_STEPS,Math.max(0,previous)+Math.max(0,Math.min(100,elapsed)))
}
export function mayStep(accumulator:number,steps:number,elapsedWork:number){
 return accumulator+1e-8>=PHYSICS_STEP_MS&&steps<MAX_FRAME_STEPS&&(steps===0||elapsedWork<PHYSICS_WORK_BUDGET_MS)
}
export function retainedRemainder(accumulator:number){return Math.max(0,accumulator)%PHYSICS_STEP_MS}
