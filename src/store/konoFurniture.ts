import type {HouseItem} from './konoCare'

/** KONO's house furniture (from KONO Town's furniture shop; store/konoLooks has what's owned). Loaded with
 * KONO Town and KONO's house, not at startup. The art is imported by tools/import_kono_house.py into
 * public/garden/house. */
/** Furniture for KONO's house. `width` is how wide the piece stands in the room (a share of the room's
 * width); `rug` pieces lie on the floor under everything else; `wall` pieces can hang on the walls. `use` is
 * what KONO does with it now and then: a pose, where KONO stands (`dy` above the piece's foot is on it, as
 * a share of the room's height, a share of the piece's width across), a little emoji, and what it says. */
export type FurnitureUse={pose:string;dx?:number;dy:number;on?:boolean;emoji?:string;line:string}
export type Furniture={id:string;name:string;price:number;width:number;rug?:boolean;wall?:boolean;use?:FurnitureUse}
export const FURNITURE:Furniture[]=[
 {id:'round-rug',name:'Round rug',price:0,width:0.3,rug:true},
 {id:'bed',name:'Cozy bed',price:120,width:0.24,use:{pose:'sleep',dy:-0.07,on:true,emoji:'💤',line:'KONO is napping in the cozy bed.'}},
 {id:'potted-plant',name:'Potted plant',price:40,width:0.09,use:{pose:'happy',dx:0.9,dy:0.02,emoji:'💧',line:'KONO is watering the plant.'}},
 {id:'floor-lamp',name:'Floor lamp',price:70,width:0.06},
 {id:'beanbag',name:'Beanbag',price:80,width:0.13,use:{pose:'tea',dy:-0.05,on:true,line:'KONO is sinking into the beanbag.'}},
 {id:'armchair',name:'Armchair',price:110,width:0.14,use:{pose:'tea',dy:-0.06,on:true,emoji:'☕',line:'KONO is having tea in the armchair.'}},
 {id:'toy-chest',name:'Toy chest',price:90,width:0.14,use:{pose:'excited',dx:0.75,dy:0.02,emoji:'🧸',line:'KONO is playing with its toys.'}},
 {id:'bookshelf',name:'Bookshelf',price:150,width:0.15,use:{pose:'read',dx:0.7,dy:0.03,emoji:'📖',line:'KONO is reading a book from the shelf.'}},
 {id:'desk',name:'Study desk',price:140,width:0.2,use:{pose:'read',dy:0.04,emoji:'✏️',line:'KONO is studying at the desk.'}},
 {id:'window-seat',name:'Window seat',price:160,width:0.22,use:{pose:'tea',dy:-0.06,on:true,line:'KONO is gazing out from the window seat.'}},
 {id:'snack-fridge',name:'Snack fridge',price:130,width:0.11,use:{pose:'happy',dx:0.75,dy:0.02,emoji:'🍙',line:'KONO is sneaking a snack from the fridge.'}},
 {id:'music-player',name:'Music player',price:120,width:0.1,use:{pose:'excited',dx:0.8,dy:0.03,emoji:'🎵',line:'KONO is dancing to a song.'}},
 {id:'fireplace',name:'Fireplace',price:220,width:0.19,use:{pose:'tea',dy:0.05,emoji:'🔥',line:'KONO is warming its paws by the fire.'}},
 {id:'wall-clock',name:'Wall clock',price:60,width:0.08,wall:true},
 {id:'picture-frame',name:'Picture frame',price:50,width:0.08,wall:true},
 {id:'string-lights',name:'String lights',price:70,width:0.2,wall:true},
]
/** Where KONO goes to use a piece placed in the room. */
export function spotFor(h:HouseItem,f:Furniture):{x:number;y:number}{
 const u=f.use!,w=f.width*(h.size??1)
 return {x:Math.min(0.94,Math.max(0.06,h.x+(u.dx??0)*w*(h.flip?-1:1))),y:Math.min(0.97,Math.max(0.2,h.y+u.dy))}
}
export const furnitureSrc=(id:string)=>'/garden/house/'+id+'.webp'
export const ROOM_SRC='/garden/house/room.webp'
/** Pieces owned but not in the room (to place from the tray). */
export function inStorage(owned:Map<string,number>,house:HouseItem[]):{furniture:Furniture;count:number}[]{
 return FURNITURE.map(f=>({furniture:f,count:(owned.get(f.id)??0)-house.filter(h=>h.item===f.id).length})).filter(x=>x.count>0)
}
/** Where things can stand: the floor (or, for wall pieces, up the walls too). */
export function clampSpot(f:Furniture|undefined,x:number,y:number){
 return {x:Math.min(0.94,Math.max(0.06,x)),y:Math.min(0.96,Math.max(f?.wall?0.12:0.32,y))}
}
export const SIZES=[0.7,0.85,1,1.2,1.45]
