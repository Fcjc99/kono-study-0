/** The KONO polo collection. Each `image` is a cut-out on the shared mockup template (796×1000, the inside of
 * the collar see-through), so one set of fit anchors in tryOn.ts works for every polo. A price of null shows
 * as "coming soon" until it's set. */
export type Polo={id:string;name:string;colorway:string;blurb:string;image:string;accent:string;swatch:string;price:number|null}
export const POLOS:Polo[]=[
 {id:'sakura-teal',name:'Sakura Polo',colorway:'Teal blossom',blurb:'Branches of plum blossom in teal and soft grey on white, with a deep teal placket and inner collar.',image:'/shop/polo-sakura-teal.webp',accent:'#1f8a96',swatch:'#e9f3f3',price:null},
 {id:'tile-navy',name:'Tile Polo',colorway:'Navy geometric',blurb:'A small four-petal tile repeat in slate blue, finished with a navy placket. The quiet one.',image:'/shop/polo-tile-navy.webp',accent:'#1d2a5c',swatch:'#7487b4',price:null},
 {id:'hibiscus-sky',name:'Hibiscus Polo',colorway:'Sky floral',blurb:'Tiny sky-blue hibiscus and leaves all over, with a bright cobalt placket.',image:'/shop/polo-hibiscus-sky.webp',accent:'#2438b0',swatch:'#9cc8e6',price:null},
]
export const SIZES=['XS','S','M','L','XL','XXL'] as const
export const POLO_DETAILS=['Lightweight stretch piqué that breathes','Three-button placket with the コ mark','KONO badge on the left sleeve','All-over print, made to order'] as const
