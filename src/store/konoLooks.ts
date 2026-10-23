import type {CareEvent} from './konoCare'

/** KONO's colors (KONO Town › Paint shop) and KONO's house (its furniture, from the furniture shop). Both
 * are bought with coins (store/konoCoins) and kept for good: a color as a 'buy' entry "paint:<id>", each
 * piece of furniture as a 'buy' entry "furn:<id>" (buying a piece again gets another one).
 *
 * The color KONO wears is the latest 'paint' entry (like outfits), and shows on the island, in the KONO bar
 * and corner, and in the house. The art is imported by tools/import_kono_colors.py (KONO's frames, into
 * public/garden/kono/colors/<id>) and tools/import_kono_house.py (the room and furniture, into
 * public/garden/house). */
export type PaintId='starry'|'rainbow'|'ghost'|'autumn'|'sakura'
export type Paint={id:PaintId;name:string;price:number;blurb:string}
export const PAINTS:Paint[]=[
 {id:'sakura',name:'Sakura',price:250,blurb:'Soft pink with little blossoms'},
 {id:'autumn',name:'Autumn',price:250,blurb:'Warm orange with falling leaves'},
 {id:'ghost',name:'Ghost',price:300,blurb:'Pale, glowy and a little see-through'},
 {id:'rainbow',name:'Rainbow',price:350,blurb:'Every pastel, top to toes'},
 {id:'starry',name:'Starry',price:400,blurb:'A night sky full of twinkles'},
]
/** KONO's frames that come in every color (the island's poses and walks). */
const PAINTED=new Set(['idle','happy','excited','question','sleep','read','tea','sit','fishing','pond','walk-down-01','walk-down-02','walk-down-03','walk-up-01','walk-up-02','walk-up-03','walk-left-01','walk-left-02','walk-right-01','walk-right-02'])
/** The picture of KONO in a pose, in its color ('/garden/kono/happy.webp' → '/garden/kono/colors/starry/happy.webp'). */
export function paintPose(pose:string,paint:PaintId|null):string{
 const m=pose.match(/^\/garden\/kono\/([\w-]+)\.webp$/)
 return paint&&m&&PAINTED.has(m[1])?'/garden/kono/colors/'+paint+'/'+m[1]+'.webp':pose
}
export const paintSrc=(id:PaintId)=>'/garden/kono/colors/'+id+'/happy.webp'
export const ownedPaints=(log:CareEvent[])=>new Set(log.filter(e=>e.kind==='buy'&&e.item?.startsWith('paint:')).map(e=>e.item!.slice(6) as PaintId).filter(id=>PAINTS.some(p=>p.id===id)))
/** The color KONO has on: the latest pick ("" is classic), if it's owned. */
export function wornPaint(log:CareEvent[],owned:Set<PaintId>):PaintId|null{
 const last=log.filter(e=>e.kind==='paint').sort((a,b)=>a.at.localeCompare(b.at)).at(-1)
 const id=last?.item as PaintId|undefined
 return id&&owned.has(id)?id:null
}

/** How many of each piece KONO owns. */
export function ownedFurniture(log:CareEvent[]):Map<string,number>{
 const counts=new Map<string,number>()
 for(const e of log)if(e.kind==='buy'&&e.item?.startsWith('furn:')){const id=e.item.slice(5);counts.set(id,(counts.get(id)??0)+1)}
 return counts
}
