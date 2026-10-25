import type {CareEvent} from './konoCare'
import {FINDS,findSrc} from './konoFinds'

/** KONO's world map (Sanctuary › World map): KONO's island in the middle and three lands around it. A land
 * opens as KONO's bond grows (store/konoBond hearts). In a land KONO walks about, there's one look around a
 * day (a treasure from that land, kept in Decorate › Finds like a focus find), its market sells furniture
 * found nowhere else (store/konoFurniture › land), and the arcade's games can be played there. The art is
 * imported by tools/import_kono_world.py into public/garden/world. Positions are shares of the picture. */
export type LandId='beach'|'forest'|'snow'
type Spot={x:number;y:number}
/** walk: the open ground KONO walks about on (shares of the picture), where a tap sends KONO. */
export type Land={id:LandId;name:string;emoji:string;hearts:number;map:Spot;stall:Spot;walk:{x0:number;x1:number;y0:number;y1:number};finds:string[];line:string}
export const LANDS:Land[]=[
 {id:'beach',name:'Sandy Beach Cove',emoji:'🏝️',hearts:1,map:{x:0.17,y:0.43},stall:{x:0.8,y:0.3},walk:{x0:0.18,x1:0.84,y0:0.48,y1:0.8},finds:['shell','seaglass','pebble','feather'],line:'KONO wiggles its toes in the warm sand.'},
 {id:'forest',name:'Mossy Forest Glade',emoji:'🌳',hearts:2,map:{x:0.5,y:0.19},stall:{x:0.8,y:0.29},walk:{x0:0.16,x1:0.82,y0:0.4,y1:0.84},finds:['acorn','clover','mushroom','pinecone','leaf','golden-acorn'],line:'KONO listens to the birds in the glade.'},
 {id:'snow',name:'Snowy Mountain Village',emoji:'🏔️',hearts:3,map:{x:0.86,y:0.4},stall:{x:0.17,y:0.4},walk:{x0:0.2,x1:0.8,y0:0.5,y1:0.9},finds:['snowflake','crystal','star','pebble'],line:'KONO leaves little footprints in the snow.'},
]
export const HOME_SPOT={x:0.5,y:0.62}
/** The friends KONO can meet: sea friends pop up in the water on the world map, the others live in a land.
 * Tapping one meets it (kept on this device, shown in the explorer's passport). */
export type Friend={id:string;emoji:string;name:string;line:string;land?:LandId}
export const FRIENDS:Friend[]=[
 {id:'whale',emoji:'🐋',name:'Whale',line:'A whale spouts a fountain and waves its tail!'},
 {id:'dolphin',emoji:'🐬',name:'Dolphin',line:'A dolphin leaps over the waves. Splash!'},
 {id:'turtle',emoji:'🐢',name:'Sea turtle',line:'A sea turtle paddles by and blinks hello.'},
 {id:'octopus',emoji:'🐙',name:'Octopus',line:'An octopus waves all eight arms at once!'},
 {id:'crab',emoji:'🦀',name:'Crab',line:'The crab scuttles sideways and clicks its claws.',land:'beach'},
 {id:'butterfly',emoji:'🦋',name:'Butterfly',line:'A butterfly lands on KONO’s nose for a moment.',land:'forest'},
 {id:'penguin',emoji:'🐧',name:'Penguin',line:'A penguin slides past on its tummy. Wheee!',land:'snow'},
]
/** Spots on the world map's open sea where sea friends surface. */
export const SEA_SPOTS:Spot[]=[{x:0.22,y:0.68},{x:0.3,y:0.3},{x:0.72,y:0.29},{x:0.8,y:0.68},{x:0.9,y:0.72},{x:0.36,y:0.78}]
/** Which light the world is in by the clock: KONO's world follows the real day. */
export type Light='day'|'dawn'|'dusk'|'night'
export const lightAt=(hour:number):Light=>hour<6||hour>=21?'night':hour<8?'dawn':hour>=18?'dusk':'day'
export const worldSrc=(name:string)=>'/garden/world/'+name+'.webp'
/** Today's look around in a land: one a day, with a fixed ID so two devices agree. */
export const lookEventId=(land:LandId,today:string)=>'land-'+land+'-'+today
export const lookedToday=(log:CareEvent[],land:LandId,today:string)=>log.find(e=>e.id===lookEventId(land,today))
/** What KONO finds looking around a land: something from it not found yet, if there is one. */
export function landFind(land:Land,found:Map<string,number>,roll:number){
 const fresh=land.finds.filter(id=>!found.has(id)),pool=fresh.length?fresh:land.finds
 const id=pool[Math.floor(roll*pool.length)%pool.length]
 return FINDS.find(f=>f.id===id)??FINDS[0]
}
export const lookEvent=(land:LandId,today:string,findId:string,now:Date):CareEvent=>({id:lookEventId(land,today),kind:'find',at:now.toISOString(),item:findId})
export {findSrc}
