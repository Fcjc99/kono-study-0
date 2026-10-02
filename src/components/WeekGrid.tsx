import {useEffect,useRef,useState,type CSSProperties,type PointerEvent as ReactPointerEvent} from 'react'
import {classTime} from '../store/classSchedule'

/** One thing on the week: timed ones sit at their hour, the rest in the "All day" row. */
/** `drag` ("tasks:ID", "exams:ID", "calendarEvents:ID") lets it be moved onto an hour or a day;
 * `stretch` lets a timed one be made longer or shorter by its bottom edge. */
export type WeekItem={id:string;day:string;title:string;start?:string;end?:string;color:string;important?:boolean;drag?:string;stretch?:boolean}

const minutes=(t:string)=>Number(t.slice(0,2))*60+Number(t.slice(3,5))
const clock=(m:number)=>String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0')
const HOUR=44,SNAP=15,LONG_PRESS_MS=300
const snap=(m:number)=>Math.round(m/SNAP)*SNAP

/** Where a drag would land: an hour on a day (with the stretch's new end), or a day's All day row. */
type Landing={day:string;from?:number;to?:number}
type Drag={item:WeekItem;mode:'move'|'stretch';pointer:number;x:number;y:number;grab:number;length:number;active:boolean;landing:Landing|null;timer?:number}

/** Planner › Week: seven days side by side with an hour grid. Tapping an empty hour adds something
 * then; tapping an item opens it to edit (onOpen). An item can be dragged onto another time or day
 * (onDrop, see store/weekDrop) and a timed one stretched by its bottom edge (onStretch), in 15-minute
 * steps. With a mouse a drag starts as soon as it moves; on a touch screen press and hold first, so a
 * swipe still scrolls (the bottom-edge grip stretches straight away). */
export default function WeekGrid({days,items,selected,onSelect,onAddAt,onOpen,onDrop,onStretch,dayLabel}:{days:string[];items:WeekItem[];selected:string;onSelect:(day:string)=>void;onAddAt:(day:string,time:string)=>void;onOpen?:(item:WeekItem)=>void;onDrop?:(drag:string,day:string,time?:string)=>void;onStretch?:(drag:string,end:string)=>void;dayLabel:(day:string)=>string}){
 const [drag,setDrag]=useState<Drag|null>(null)
 const dragRef=useRef<Drag|null>(null),swallowClick=useRef(false)
 const columns=useRef(new Map<string,HTMLElement>()),allDayCells=useRef(new Map<string,HTMLElement>()),body=useRef<HTMLDivElement>(null)
 const update=(next:Drag|null)=>{dragRef.current=next;setDrag(next)}
 const timed=items.filter(i=>i.start),allDay=items.filter(i=>!i.start)
 const ends=timed.map(i=>i.end&&i.end>i.start!?minutes(i.end):minutes(i.start!)+60)
 const first=Math.min(7,...timed.map(i=>Math.floor(minutes(i.start!)/60))),last=Math.min(24,Math.max(21,...ends.map(m=>Math.ceil(m/60))))
 const hours=Array.from({length:last-first},(_,i)=>first+i)
 const today=new Date(),todayIso=today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0')+'-'+String(today.getDate()).padStart(2,'0')
 const span=(i:WeekItem)=>({from:minutes(i.start!),to:i.end&&i.end>i.start!?minutes(i.end):minutes(i.start!)+60})

 // Once a drag has started on a touch screen, the page mustn't scroll under the finger.
 useEffect(()=>{
  const hold=(e:TouchEvent)=>{if(dragRef.current?.active)e.preventDefault()}
  document.addEventListener('touchmove',hold,{passive:false})
  return ()=>{document.removeEventListener('touchmove',hold);clearTimeout(dragRef.current?.timer)}
 },[])

 const landingAt=(d:Drag,x:number,y:number):Landing|null=>{
  const inside=(el:HTMLElement)=>{const r=el.getBoundingClientRect();return x>=r.left&&x<r.right&&y>=r.top&&y<r.bottom?r:null}
  if(d.mode==='stretch'){
   const col=columns.current.get(d.item.day),r=col?.getBoundingClientRect()
   if(!r)return null
   const from=minutes(d.item.start!),to=Math.max(from+SNAP,Math.min(last*60,snap(first*60+(y-r.top)/HOUR*60)))
   return {day:d.item.day,from,to}
  }
  for(const [day,cell] of allDayCells.current)if(inside(cell))return {day}
  for(const [day,col] of columns.current){
   const r=col.getBoundingClientRect()
   if(x<r.left||x>=r.right)continue
   const from=Math.max(first*60,Math.min(last*60-SNAP,snap(first*60+(y-r.top-d.grab)/HOUR*60)))
   return {day,from,to:Math.min(24*60,from+d.length)}
  }
  return null
 }
 const begin=(item:WeekItem,mode:Drag['mode'])=>(e:ReactPointerEvent<HTMLElement>)=>{
  if(e.button!==0||!item.drag)return
  if(mode==='stretch')e.stopPropagation()
  // The item follows the pointer from here on, even once it's off the item (a stretch leaves it at once).
  const el=e.currentTarget.closest<HTMLElement>('.week-item')!,box=el.getBoundingClientRect()
  try{el.setPointerCapture(e.pointerId)}catch{/* Not capturable (already released). */}
  const length=item.start?span(item).to-span(item).from:60
  const d:Drag={item,mode,pointer:e.pointerId,x:e.clientX,y:e.clientY,grab:item.start?Math.max(0,e.clientY-box.top):0,length,active:false,landing:null}
  // A mouse drag (and a stretch) starts as soon as it moves; a finger has to press and hold.
  if(e.pointerType==='touch'&&mode==='move')d.timer=window.setTimeout(()=>{const c=dragRef.current;if(c&&c.pointer===d.pointer&&!c.active){navigator.vibrate?.(15);update({...c,active:true,landing:landingAt(c,c.x,c.y)})}},LONG_PRESS_MS)
  update(d)
 }
 const move=(e:ReactPointerEvent<HTMLElement>)=>{
  const d=dragRef.current
  if(!d||d.pointer!==e.pointerId)return
  const far=Math.hypot(e.clientX-d.x,e.clientY-d.y)>6
  if(!d.active){
   if(!far)return
   // A finger that moves before the hold is a scroll, not a drag.
   if(e.pointerType==='touch'&&d.mode==='move'){clearTimeout(d.timer);update(null);return}
  }
  // Near the top or bottom of the hours, keep scrolling them.
  const b=body.current?.getBoundingClientRect()
  if(b&&body.current){if(e.clientY<b.top+28)body.current.scrollTop-=10;else if(e.clientY>b.bottom-28)body.current.scrollTop+=10}
  update({...d,x:e.clientX,y:e.clientY,active:true,landing:landingAt(d,e.clientX,e.clientY)})
 }
 const end=(e:ReactPointerEvent<HTMLElement>)=>{
  const d=dragRef.current
  if(!d||d.pointer!==e.pointerId)return
  clearTimeout(d.timer);update(null)
  if(!d.active||e.type==='pointercancel')return
  swallowClick.current=true;setTimeout(()=>{swallowClick.current=false},0)
  const at=d.landing
  if(!at||!d.item.drag)return
  if(d.mode==='stretch'){const to=clock(Math.min(24*60-1,at.to!));if(to!==d.item.end)onStretch?.(d.item.drag,to);return}
  const time=at.from===undefined?undefined:clock(at.from)
  if(at.day===d.item.day&&time===d.item.start)return
  onDrop?.(d.item.drag,at.day,time)
 }
 const open=(item:WeekItem)=>()=>{if(swallowClick.current){swallowClick.current=false;return}if(onOpen)onOpen(item);else onSelect(item.day)}
 const handlers=(item:WeekItem)=>item.drag&&(onDrop||onStretch)?{onPointerDown:begin(item,'move'),onPointerMove:move,onPointerUp:end,onPointerCancel:end,onContextMenu:(e:{preventDefault:()=>void})=>{if(dragRef.current)e.preventDefault()}}:{}

 // Items that overlap share their hour side by side.
 const lanes=(day:string)=>{
  const list=timed.filter(i=>i.day===day).map(i=>({item:i,...span(i)})).sort((a,b)=>a.from-b.from||b.to-a.to)
  const placed:{item:WeekItem;from:number;to:number;lane:number;of:number}[]=[]
  let group:typeof placed=[],groupEnd=-1
  const close=()=>{const of=Math.max(1,...group.map(g=>g.lane+1));for(const g of group)g.of=of;group=[]}
  for(const x of list){
   if(x.from>=groupEnd)close()
   const used=new Set(group.filter(g=>g.to>x.from).map(g=>g.lane));let lane=0;while(used.has(lane))lane++
   const p={...x,lane,of:1};placed.push(p);group.push(p);groupEnd=Math.max(groupEnd,x.to)
  }
  close()
  return placed
 }
 const weekday=(day:string)=>new Date(day+'T12:00:00').toLocaleDateString(undefined,{weekday:'short'})
 const live=drag?.active?drag:null,landing=live?.landing
 const label=(i:WeekItem)=>i.title+(i.start?' · '+classTime(i.start)+(i.end?'–'+classTime(i.end):''):'')+' · '+dayLabel(i.day)
 const itemClass=(i:WeekItem,extra='')=>'week-item'+extra+(i.important?' is-important':'')+(i.drag&&onDrop?' is-movable':'')+(live?.item.id===i.id?' is-dragging':'')
 return <div className={'week-grid'+(live?' is-dragging':'')} role="region" aria-label="Week" style={{'--days':days.length} as CSSProperties}>
  <div className="week-grid-row week-grid-head"><span className="week-grid-gutter" aria-hidden="true"/>{days.map(day=><button type="button" key={day} aria-pressed={day===selected} aria-label={dayLabel(day)} className={day===todayIso?'is-today':''} onClick={()=>onSelect(day)}><small>{weekday(day)}</small><strong>{Number(day.slice(-2))}</strong></button>)}</div>
  <div className="week-grid-row week-grid-allday"><span className="week-grid-gutter">All day</span>{days.map(day=><div key={day} ref={el=>{if(el)allDayCells.current.set(day,el);else allDayCells.current.delete(day)}} className={'week-grid-allday-cell'+(landing&&landing.day===day&&landing.from===undefined?' is-drop-target':'')}>{allDay.filter(i=>i.day===day).map(i=><button type="button" key={i.id} className={itemClass(i)} style={{'--item-color':i.color} as CSSProperties} aria-label={label(i)} onClick={open(i)} {...handlers(i)}>{i.important?'★ ':''}{i.title}</button>)}</div>)}</div>
  <div ref={body} className="week-grid-row week-grid-body" style={{'--hour':HOUR+'px'} as CSSProperties}>
   <div className="week-grid-gutter week-grid-hours">{hours.map(h=><span key={h}>{(h%12||12)+(h<12||h===24?' AM':' PM')}</span>)}</div>
   {days.map(day=><div key={day} ref={el=>{if(el)columns.current.set(day,el);else columns.current.delete(day)}} className={'week-grid-day'+(day===selected?' is-selected':'')} style={{height:hours.length*HOUR}}>
    {hours.map(h=><button type="button" key={h} className="week-grid-slot" style={{top:(h-first)*HOUR}} aria-label={'Add at '+classTime(clock(h*60))+' on '+dayLabel(day)} onClick={()=>onAddAt(day,clock(h*60))}><span aria-hidden="true">＋</span></button>)}
    {lanes(day).map(({item,from,to,lane,of})=><button type="button" key={item.id} className={itemClass(item,' week-item-timed')} style={{'--item-color':item.color,top:(from-first*60)/60*HOUR,height:Math.max(22,(to-from)/60*HOUR-2),left:`calc(${lane/of*100}% + 2px)`,width:`calc(${100/of}% - 4px)`} as CSSProperties} aria-label={label(item)} onClick={open(item)} {...handlers(item)}><small>{classTime(item.start!)}</small>{item.important?'★ ':''}{item.title}{item.stretch&&onStretch&&<span className="week-item-grip" aria-hidden="true" onPointerDown={begin(item,'stretch')}/>}</button>)}
    {landing&&landing.day===day&&landing.from!==undefined&&<div className="week-item-ghost" aria-hidden="true" style={{'--item-color':live!.item.color,top:(landing.from-first*60)/60*HOUR,height:Math.max(22,(landing.to!-landing.from)/60*HOUR-2)} as CSSProperties}>{classTime(clock(landing.from))}–{classTime(clock(Math.min(24*60-1,landing.to!)))}</div>}
   </div>)}
  </div>
 </div>
}
