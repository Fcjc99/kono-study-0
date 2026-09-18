import {addDays} from './studyScheduler'

export type SrsState={interval:number;ease:number;dueDate:string}

const MIN_EASE=1.3,MAX_EASE=2.8,INITIAL_EASE=2.3

/** A brand new card is due immediately, same as the old needsReview:true default -- nothing sits
 * unreachable behind a schedule until it's actually been seen once. */
export const srsInitial=(today:string):SrsState=>({interval:0,ease:INITIAL_EASE,dueDate:today})

/** Two-button grading (this app has no 1-5 quality scale), loosely modeled on SM-2: a miss drops the
 * card back to box zero -- ease dips slightly and it's due again today -- while a hit grows the
 * interval (1 day, then 3, then interval*ease) and nudges ease up a little. Missed cards resurface
 * fast; well-known ones space out further apart each time. */
export function srsGrade(state:SrsState,correct:boolean,today:string):SrsState{
 if(!correct)return {interval:0,ease:Math.max(MIN_EASE,+(state.ease-0.2).toFixed(2)),dueDate:today}
 const ease=Math.min(MAX_EASE,+(state.ease+0.1).toFixed(2))
 const interval=state.interval===0?1:state.interval===1?3:Math.round(state.interval*ease)
 return {interval,ease,dueDate:addDays(today,interval)}
}

export const isDue=(state:SrsState,today:string):boolean=>state.dueDate<=today
