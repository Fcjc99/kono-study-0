import type {CareEvent} from './konoCare'
import {addDays} from './studyScheduler'

/** KONO's friends (Decorate › Friends): after a good week a little friend visits the island for the
 * day, and once met it can go on the island like a sticker. A good week is 3 or more things finished
 * in the 7 days before today with at most one of them late; a great week (6 or more, none late) can
 * also bring the shy ones, the fox and the owl. New friends come before ones you've met. Each visit
 * is saved once a day with a fixed ID ('visit-<day>'), so two devices agree on who came. Art is drawn
 * by tools/draw_kono_outfits.py into public/garden/friends. */
export type FriendTier='good'|'great'
export type Friend={id:string;name:string;emoji:string;tier:FriendTier}
export const FRIENDS:Friend[]=[
 {id:'cat',name:'Mochi the cat',emoji:'🐱',tier:'good'},
 {id:'duck',name:'Puddle the duck',emoji:'🦆',tier:'good'},
 {id:'frog',name:'Hop the frog',emoji:'🐸',tier:'good'},
 {id:'bunny',name:'Clover the bunny',emoji:'🐰',tier:'good'},
 {id:'hedgehog',name:'Bramble the hedgehog',emoji:'🦔',tier:'good'},
 {id:'turtle',name:'Shelly the turtle',emoji:'🐢',tier:'good'},
 {id:'fox',name:'Ember the fox',emoji:'🦊',tier:'great'},
 {id:'owl',name:'Hoot the owl',emoji:'🦉',tier:'great'},
]
export const friendSrc=(id:string)=>'/garden/friends/'+id+'.webp'
export const friendHow=(f:Friend)=>f.tier==='great'?'Visits after a great week (6+ things done, none late).':'Visits after a good week (3+ things done, at most one late).'

type Done={done:boolean;due:string;completedAt?:string}
const localDay=(iso:string)=>{const d=new Date(iso);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
/** The 7 days before `today`: how many things were finished, and how many of those late. */
export function lastWeek(tasks:Done[],today:string){
 const from=addDays(today,-7)
 const finished=tasks.filter(t=>t.done&&t.completedAt&&localDay(t.completedAt)>=from&&localDay(t.completedAt)<today)
 return {finished:finished.length,late:finished.filter(t=>localDay(t.completedAt!)>t.due).length}
}
export const weekKind=(w:{finished:number;late:number}):FriendTier|null=>w.finished>=6&&w.late===0?'great':w.finished>=3&&w.late<=1?'good':null

/** Friends met so far (how many visits each). */
export function friendsMet(log:CareEvent[]):Map<string,number>{
 const met=new Map<string,number>()
 for(const e of log)if(e.kind==='visit'&&e.item)met.set(e.item,(met.get(e.item)??0)+1)
 return met
}
const hash=(text:string)=>{let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
/** Who is visiting today: whoever already came today, or (after a good week) a friend picked for the
 * day, someone new first. */
export function visitorToday(tasks:Done[],log:CareEvent[],today:string):Friend|null{
 const came=log.find(e=>e.kind==='visit'&&e.id===visitEventId(today))
 if(came)return FRIENDS.find(f=>f.id===came.item)??null
 const kind=weekKind(lastWeek(tasks,today))
 if(!kind)return null
 const met=friendsMet(log)
 const pool=FRIENDS.filter(f=>kind==='great'||f.tier==='good')
 const fresh=pool.filter(f=>!met.has(f.id)),choices=fresh.length?fresh:pool
 return choices[hash('visit'+today)%choices.length]
}
export const visitEventId=(today:string)=>'visit-'+today
export const visitEvent=(today:string,friend:Friend):CareEvent=>({id:visitEventId(today),kind:'visit',at:today+'T12:00:00.000Z',item:friend.id})
export const visitLine=(f:Friend,first:boolean)=>f.emoji+' '+f.name+(first?' came to visit the island! A good week brings friends. Find them in Decorate › Friends.':' is visiting the island again today!')
