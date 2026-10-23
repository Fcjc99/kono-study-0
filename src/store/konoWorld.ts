import type {CareEvent} from './konoCare'
import {FINDS,findSrc} from './konoFinds'

/** KONO's world map (Sanctuary › World map): KONO's island in the middle and three lands around it. A land
 * opens as KONO's bond grows (store/konoBond hearts). In a land KONO walks about, there's one look around a
 * day (a treasure from that land, kept in Decorate › Finds like a focus find), its market sells furniture
 * found nowhere else (store/konoFurniture › land), and the arcade's games can be played there. The art is
 * imported by tools/import_kono_world.py into public/garden/world. Positions are shares of the picture. */
export type LandId='beach'|'forest'|'snow'
export type Land={id:LandId;name:string;emoji:string;hearts:number;map:{x:number;y:number};stall:{x:number;y:number};finds:string[];line:string}
export const LANDS:Land[]=[
 {id:'beach',name:'Sandy Beach Cove',emoji:'🏝️',hearts:1,map:{x:0.17,y:0.43},stall:{x:0.8,y:0.3},finds:['shell','seaglass','pebble','feather'],line:'KONO wiggles its toes in the warm sand.'},
 {id:'forest',name:'Mossy Forest Glade',emoji:'🌳',hearts:2,map:{x:0.5,y:0.19},stall:{x:0.8,y:0.29},finds:['acorn','clover','mushroom','pinecone','leaf','golden-acorn'],line:'KONO listens to the birds in the glade.'},
 {id:'snow',name:'Snowy Mountain Village',emoji:'🏔️',hearts:3,map:{x:0.86,y:0.4},stall:{x:0.17,y:0.4},finds:['snowflake','crystal','star','pebble'],line:'KONO leaves little footprints in the snow.'},
]
export const HOME_SPOT={x:0.5,y:0.62}
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
