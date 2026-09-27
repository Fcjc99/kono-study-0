import {useState} from 'react'
import type {WeekRecap as Recap} from '../store/weekRecap'
import {brandLogoPath} from './BrandLogo'

const short=(iso:string)=>new Date(iso+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'})
const letter=(iso:string)=>new Date(iso+'T12:00:00').toLocaleDateString(undefined,{weekday:'narrow'})
const weekday=(iso:string)=>new Date(iso+'T12:00:00').toLocaleDateString(undefined,{weekday:'long'})
const studyTime=(m:number)=>m>=60?(Math.round(m/6)/10).toString().replace(/\.0$/,'')+' h':m+' min'

/** Tiles shown in the card and on the picture: counts only, so sharing never shows what the work was. */
function tiles(r:Recap){
 return [
  {icon:'✅',value:String(r.assignmentsDone+r.examsDone),label:r.assignmentsDone+r.examsDone===1?'thing done':'things done'},
  {icon:'📚',value:String(r.studySessions),label:r.studySessions===1?'study session':'study sessions',note:r.studyMinutes?studyTime(r.studyMinutes):undefined},
  {icon:'🔥',value:String(r.streak),label:'day streak'},
  {icon:'🌱',value:r.activeDays+'/7',label:'active days'},
 ]
}

/** The shareable picture (1080×1920, story size), drawn on a canvas so it works offline. */
async function recapImage(r:Recap):Promise<Blob>{
 const c=document.createElement('canvas');c.width=1080;c.height=1920
 const g=c.getContext('2d')
 if(!g)throw Error('This browser can’t make pictures.')
 const bg=g.createLinearGradient(0,0,0,1920);bg.addColorStop(0,'#fff4ea');bg.addColorStop(1,'#f6d9cc');g.fillStyle=bg;g.fillRect(0,0,1080,1920)
 const font=(weight:number,size:number)=>`${weight} ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`
 g.save();g.translate(440,150);g.scale(200/296,200/296);g.fillStyle='#2b1d18';g.fill(new Path2D(brandLogoPath),'evenodd');g.restore()
 g.textAlign='center';g.fillStyle='#2b1d18'
 g.font=font(800,78);g.fillText('My week on KONO',540,470)
 g.font=font(500,40);g.fillStyle='#7a5a4c';g.fillText(short(r.from)+' – '+short(r.to),540,535)
 g.font=font(700,48);g.fillStyle='#b24c3a';wrap(g,r.headline,540,630,900,60)
 const t=tiles(r)
 t.forEach((tile,i)=>{
  const x=90+(i%2)*470,y=760+Math.floor(i/2)*380
  g.fillStyle='rgba(255,255,255,.8)';round(g,x,y,430,340,40);g.fill()
  g.textAlign='center';g.font=font(400,64);g.fillStyle='#2b1d18';g.fillText(tile.icon,x+215,y+95)
  g.font=font(800,110);g.fillText(tile.value,x+215,y+220)
  g.font=font(500,38);g.fillStyle='#7a5a4c';g.fillText(tile.label+(tile.note?' · '+tile.note:''),x+215,y+285)
 })
 r.days.forEach((d,i)=>{
  const x=180+i*120,y=1590
  g.beginPath();g.arc(x,y,42,0,Math.PI*2);g.fillStyle=d.active?'#e0705c':'rgba(255,255,255,.75)';g.fill()
  g.font=font(700,36);g.fillStyle=d.active?'#fff':'#9b7d70';g.textAlign='center';g.fillText(letter(d.date),x,y+13)
 })
 g.font=font(600,40);g.fillStyle='#2b1d18';g.fillText('My island: '+r.stageName,540,1720)
 g.font=font(500,34);g.fillStyle='#7a5a4c';g.fillText('KONO · Study Sanctuary',540,1830)
 return new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error('Could not make the picture.')),'image/png'))
}
function round(g:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath()}
function wrap(g:CanvasRenderingContext2D,text:string,x:number,y:number,max:number,line:number){
 const words=text.split(' ');let row=''
 for(const w of words){const next=row?row+' '+w:w;if(g.measureText(next).width>max&&row){g.fillText(row,x,y);row=w;y+=line}else row=next}
 if(row)g.fillText(row,x,y)
}

/** The weekly recap card. `onDismiss` shows "Hide until next week" (the Sunday card on the Sanctuary page). */
export default function WeekRecap({recap,onPlanWeek,onDismiss}:{recap:Recap;onPlanWeek?:()=>void;onDismiss?:()=>void}){
 const [status,setStatus]=useState(''),[busy,setBusy]=useState(false)
 const share=async()=>{
  if(busy)return;setBusy(true);setStatus('')
  try{
   const file=new File([await recapImage(recap)],'my-kono-week.png',{type:'image/png'})
   if(navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:'My week on KONO'});return}
   const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=file.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000)
   setStatus('Saved the picture. Share it anywhere you like.')
  }catch(e){if(!(e instanceof DOMException&&e.name==='AbortError'))setStatus(e instanceof Error?e.message:'Could not share the picture.')}finally{setBusy(false)}
 }
 return <section className="week-recap" aria-label="Your week in review">
  <div className="week-recap-head"><div><small>YOUR WEEK · {short(recap.from).toUpperCase()} – {short(recap.to).toUpperCase()}</small><h3>{recap.headline}</h3></div></div>
  <ul className="week-recap-tiles">{tiles(recap).map(t=><li key={t.label}><span aria-hidden="true">{t.icon}</span><strong>{t.value}</strong><small>{t.label}{t.note?' · '+t.note:''}</small></li>)}</ul>
  <ol className="week-recap-days" aria-label={recap.activeDays+' of the last 7 days had finished work'}>{recap.days.map(d=><li key={d.date} className={d.active?'is-active':''} title={weekday(d.date)}><span aria-hidden="true">{letter(d.date)}</span><span className="sr-only">{weekday(d.date)}: {d.active?'finished work':'nothing finished'}</span></li>)}</ol>
  <p className="week-recap-notes">🏝️ Your island: <strong>{recap.stageName}</strong>{recap.grewThisWeek?' · +'+recap.grewThisWeek+' growth this week':''}{recap.topSubject?<><br/>⭐ Most done in <strong>{recap.topSubject}</strong></>:null}</p>
  <p className="week-recap-next">{recap.nextWeekDue?<>Next week: <strong>{recap.nextWeekDue} thing{recap.nextWeekDue===1?'':'s'} due</strong>{recap.nextExam?<>, including {recap.nextExam.title} on {weekday(recap.nextExam.due)}</>:null}.</>:'Nothing due next week yet.'}</p>
  <div className="wb-toolbar">{onPlanWeek&&recap.nextWeekDue>0&&<button type="button" className="primary" onClick={onPlanWeek}>✨ Plan my week</button>}<button type="button" disabled={busy} onClick={()=>void share()}>{busy?'Making the picture…':'Share my week'}</button>{onDismiss&&<button type="button" onClick={onDismiss}>Hide until next week</button>}</div>
  {status&&<p role="status">{status}</p>}
 </section>
}
