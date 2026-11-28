/** Dropping something from outside onto Planner › Week (the To plan tray): the drag's data type, the event a
 * finger drag sends so the grid can show where it would land, and which day and time is under a point. */
export const PLAN_TYPE='application/x-kono-plan'
export const PLAN_HOVER='kono-plan-hover'
const SNAP=15
/** The day and start time under (x, y) on the week grid, an hour's slot centered on the point, in 15-minute
 * steps; null when the point isn't over a day's hours. */
export function weekSlotAt(x:number,y:number):{day:string;time:string;from:number}|null{
 const col=document.elementFromPoint(x,y)?.closest<HTMLElement>('[data-week-col]');if(!col)return null
 const first=Number(col.dataset.first),last=Number(col.dataset.last),r=col.getBoundingClientRect()
 if(!Number.isFinite(first)||!Number.isFinite(last)||r.height<=0)return null
 const minute=first*60+(y-r.top)/r.height*(last-first)*60
 const from=Math.min(last*60-60,Math.max(first*60,Math.round((minute-30)/SNAP)*SNAP))
 return {day:col.dataset.weekCol!,time:String(Math.floor(from/60)).padStart(2,'0')+':'+String(from%60).padStart(2,'0'),from}
}
export const hoverWeek=(slot:{day:string;from:number}|null)=>window.dispatchEvent(new CustomEvent(PLAN_HOVER,{detail:slot}))
