import {useState,type CSSProperties,type DragEvent} from 'react'
import {classTime} from '../store/classSchedule'

/** One thing on the week: timed ones sit at their hour, the rest in the "All day" row. */
/** `drag` ("tasks:ID", "exams:ID", "calendarEvents:ID") makes it draggable onto an hour or a day. */
export type WeekItem={id:string;day:string;title:string;start?:string;end?:string;color:string;important?:boolean;drag?:string}
const MIME='application/x-kono-week'

const minutes=(t:string)=>Number(t.slice(0,2))*60+Number(t.slice(3,5))
const clock=(m:number)=>String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0')
const HOUR=44

/** Planner › Week: seven days side by side with an hour grid. Tapping an empty hour adds something
 * then; tapping a day or an item opens that day's page below. Dragging an item onto an hour plans it
 * then (see store/weekDrop), onto the All day row moves its date. */
export default function WeekGrid({days,items,selected,onSelect,onAddAt,onDrop,dayLabel}:{days:string[];items:WeekItem[];selected:string;onSelect:(day:string)=>void;onAddAt:(day:string,time:string)=>void;onDrop?:(drag:string,day:string,time?:string)=>void;dayLabel:(day:string)=>string}){
 const [over,setOver]=useState('')
 const dragStart=(item:WeekItem)=>(e:DragEvent<HTMLElement>)=>{e.dataTransfer.setData(MIME,item.drag!);e.dataTransfer.effectAllowed='move'}
 const target=(key:string,day:string,time?:string)=>onDrop?{
  onDragOver:(e:DragEvent<HTMLElement>)=>{if(e.dataTransfer.types.includes(MIME)){e.preventDefault();e.dataTransfer.dropEffect='move';if(over!==key)setOver(key)}},
  onDragLeave:()=>setOver(o=>o===key?'':o),
  onDrop:(e:DragEvent<HTMLElement>)=>{const drag=e.dataTransfer.getData(MIME);setOver('');if(drag){e.preventDefault();onDrop(drag,day,time)}},
 }:{}
 const timed=items.filter(i=>i.start),allDay=items.filter(i=>!i.start)
 const ends=timed.map(i=>i.end&&i.end>i.start!?minutes(i.end):minutes(i.start!)+60)
 const first=Math.min(7,...timed.map(i=>Math.floor(minutes(i.start!)/60))),last=Math.min(24,Math.max(21,...ends.map(m=>Math.ceil(m/60))))
 const hours=Array.from({length:last-first},(_,i)=>first+i)
 const today=new Date(),todayIso=today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0')+'-'+String(today.getDate()).padStart(2,'0')
 // Items that overlap share their hour side by side.
 const lanes=(day:string)=>{
  const list=timed.filter(i=>i.day===day).map(i=>({item:i,from:minutes(i.start!),to:i.end&&i.end>i.start!?minutes(i.end):minutes(i.start!)+60})).sort((a,b)=>a.from-b.from||b.to-a.to)
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
 return <div className="week-grid" role="region" aria-label="Week" style={{'--days':days.length} as CSSProperties}>
  <div className="week-grid-row week-grid-head"><span className="week-grid-gutter" aria-hidden="true"/>{days.map(day=><button type="button" key={day} aria-pressed={day===selected} aria-label={dayLabel(day)} className={day===todayIso?'is-today':''} onClick={()=>onSelect(day)}><small>{weekday(day)}</small><strong>{Number(day.slice(-2))}</strong></button>)}</div>
  <div className="week-grid-row week-grid-allday"><span className="week-grid-gutter">All day</span>{days.map(day=><div key={day} className={'week-grid-allday-cell'+(over==='all'+day?' is-drop-target':'')} {...target('all'+day,day)}>{allDay.filter(i=>i.day===day).map(i=><button type="button" key={i.id} className={'week-item'+(i.important?' is-important':'')} style={{'--item-color':i.color} as CSSProperties} draggable={!!i.drag} onDragStart={i.drag?dragStart(i):undefined} onClick={()=>onSelect(day)}>{i.important?'★ ':''}{i.title}</button>)}</div>)}</div>
  <div className="week-grid-row week-grid-body" style={{'--hour':HOUR+'px'} as CSSProperties}>
   <div className="week-grid-gutter week-grid-hours">{hours.map(h=><span key={h}>{(h%12||12)+(h<12||h===24?' AM':' PM')}</span>)}</div>
   {days.map(day=><div key={day} className={'week-grid-day'+(day===selected?' is-selected':'')} style={{height:hours.length*HOUR}}>
    {hours.map(h=><button type="button" key={h} className={'week-grid-slot'+(over===day+h?' is-drop-target':'')} style={{top:(h-first)*HOUR}} {...target(day+h,day,clock(h*60))} aria-label={'Add at '+classTime(clock(h*60))+' on '+dayLabel(day)} onClick={()=>onAddAt(day,clock(h*60))}><span aria-hidden="true">＋</span></button>)}
    {lanes(day).map(({item,from,to,lane,of})=><button type="button" key={item.id} className={'week-item week-item-timed'+(item.important?' is-important':'')} style={{'--item-color':item.color,top:(from-first*60)/60*HOUR,height:Math.max(22,(to-from)/60*HOUR-2),left:`calc(${lane/of*100}% + 2px)`,width:`calc(${100/of}% - 4px)`} as CSSProperties} aria-label={item.title+' · '+classTime(item.start!)+(item.end?'–'+classTime(item.end):'')+' · '+dayLabel(day)} draggable={!!item.drag} onDragStart={item.drag?dragStart(item):undefined} onClick={()=>onSelect(day)}><small>{classTime(item.start!)}</small>{item.important?'★ ':''}{item.title}</button>)}
   </div>)}
  </div>
 </div>
}
