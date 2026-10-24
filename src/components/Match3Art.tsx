import {memo} from 'react'
import type {Special} from '../store/match3'

/** The pieces of Gem blitz and Candy crush, drawn in SVG.
 * Gems are cut stones: a lit table in the middle and facets all round, each shaded by which way it faces
 * the light (from the top left), with a glint that sweeps across now and then. Candies are glossy sweets:
 * a red jelly bean, an orange lozenge, a yellow lemon drop, a green gum square, a blue lollipop head and a
 * purple cluster; striped ones carry white stripes, wrapped ones sit in a shiny wrapper with twisted ends,
 * and a color bomb is a chocolate ball covered in sprinkles. The shapes are defined once (`ArtDefs`) and
 * each piece just uses them. */
const GEM_COLORS=[['#ff5468','#ffb3bd','#8c0618'],['#ff9a2e','#ffd9a3','#a34600'],['#ffe03d','#fff7c2','#a37800'],['#3fe07a','#c4ffd6','#0b7030'],['#3d9bff','#c2e2ff','#0a3f96'],['#c14dff','#efc2ff','#5a0a8f'],['#eef3fb','#ffffff','#8b97ad']]
const CANDY_COLORS=[['#ff2e48','#ffa3ae','#9e0618'],['#ff8a14','#ffcf8f','#b04a00'],['#ffd60a','#fff59e','#b38900'],['#2fd14a','#b4f7a8','#0f7a22'],['#1f8bff','#a8d8ff','#0b4fb3'],['#a83ae8','#e6b3ff','#5a1494']]
type Pt=[number,number]
const polygon=(n:number,r:number,rot=0):Pt[]=>Array.from({length:n},(_,i)=>{const a=rot+i*2*Math.PI/n;return [50+Math.cos(a)*r,50+Math.sin(a)*r]})
// Gem outlines in a 100 × 100 box: red square-cut, orange hexagon, yellow diamond, green emerald cut,
// blue shield, purple triangle, white round.
const GEMS:Pt[][]=[
 [[22,8],[78,8],[92,22],[92,78],[78,92],[22,92],[8,78],[8,22]],
 [[50,4],[92,27],[92,73],[50,96],[8,73],[8,27]],
 [[50,3],[95,50],[50,97],[5,50]],
 [[33,6],[67,6],[94,33],[94,67],[67,94],[33,94],[6,67],[6,33]],
 [[50,4],[95,36],[80,94],[20,94],[5,36]],
 [[50,5],[97,90],[3,90]],
 polygon(12,45,Math.PI/12),
]
const pts=(p:Pt[])=>p.map(([x,y])=>x.toFixed(1)+','+y.toFixed(1)).join(' ')
const mix=(a:string,b:string,t:number)=>{const A=parseInt(a.slice(1),16),B=parseInt(b.slice(1),16),f=(s:number)=>Math.round(((A>>s)&255)*(1-t)+((B>>s)&255)*t);return 'rgb('+f(16)+','+f(8)+','+f(0)+')'}
/** A gem: the outline, an inner table at `inner` of its size, and a facet between each pair. */
function Gem({k}:{k:number}){
 const out=GEMS[k],[b,l,d]=GEM_COLORS[k]
 const cx=out.reduce((s,p)=>s+p[0],0)/out.length,cy=out.reduce((s,p)=>s+p[1],0)/out.length
 const inner=out.map(([x,y]):Pt=>[cx+(x-cx)*0.52,cy+(y-cy)*0.52])
 return <symbol id={'m3g-'+k} viewBox="0 0 100 100">
  <polygon points={pts(out)} fill={d}/>
  {out.map((p,i)=>{const q=out[(i+1)%out.length],mx=(p[0]+q[0])/2-cx,my=(p[1]+q[1])/2-cy,len=Math.hypot(mx,my)||1
   // How much this facet faces the light (top left): -1 away … 1 toward.
   const lit=(-mx*0.6-my*0.8)/len,fill=lit>0?mix(b,l,lit*0.85):mix(b,d,-lit*0.8)
   return <polygon key={i} points={pts([p,q,inner[(i+1)%out.length],inner[i]])} fill={fill} stroke={d} strokeWidth={0.6} strokeOpacity={0.5}/>})}
  <polygon points={pts(inner)} fill={'url(#m3gt-'+k+')'} stroke={l} strokeWidth={0.8} strokeOpacity={0.7}/>
  <polygon points={pts(out)} fill="none" stroke={d} strokeWidth={2}/>
  <ellipse cx={cx-14} cy={cy-16} rx={9} ry={5} fill="#fff" opacity={0.75} transform={'rotate(-35 '+(cx-14)+' '+(cy-16)+')'}/>
  <g clipPath={'url(#m3gc-'+k+')'}><rect className="m3-glint" x={-60} y={-20} width={26} height={140} fill="#fff" opacity={0.55} transform="rotate(25 50 50)"/></g>
 </symbol>
}
// Candy shapes in a 100 × 100 box.
const CANDY_SHAPES=[
 'M14,60 C8,34 34,16 54,26 C64,31 70,22 82,26 C97,33 96,62 78,76 C58,92 22,90 14,60Z',
 'M50,12 C80,12 94,30 94,50 C94,70 80,88 50,88 C20,88 6,70 6,50 C6,30 20,12 50,12Z',
 'M50,6 C66,16 88,36 88,58 C88,80 70,94 50,94 C30,94 12,80 12,58 C12,36 34,16 50,6Z',
 'M24,10 H76 Q90,10 90,24 V76 Q90,90 76,90 H24 Q10,90 10,76 V24 Q10,10 24,10Z',
 'M50,6 A44,44 0 1 1 49.9,6Z',
 'M50,8 C62,8 66,18 66,22 C76,18 90,26 88,40 C98,48 96,64 84,70 C88,84 74,94 62,88 C56,96 44,96 38,88 C26,94 12,84 16,70 C4,64 2,48 12,40 C10,26 24,18 34,22 C34,18 38,8 50,8Z',
]
function Candy({k}:{k:number}){
 const [b,l,d]=CANDY_COLORS[k]
 return <symbol id={'m3c-'+k} viewBox="0 0 100 100">
  <path d={CANDY_SHAPES[k]} fill={'url(#m3cg-'+k+')'} stroke={d} strokeWidth={2.5}/>
  {k===4&&<path d="M50,50 m0,-6 a6,6 0 1 1 -6,6 a12,12 0 1 1 12,12 a18,18 0 1 1 -18,-18 a24,24 0 1 1 24,24 a30,30 0 1 1 -30,-30" fill="none" stroke={l} strokeWidth={4} opacity={0.65} clipPath="url(#m3cc-4)"/>}
  {k===3&&<rect x={22} y={22} width={56} height={56} rx={10} fill="none" stroke={l} strokeWidth={3} opacity={0.6}/>}
  {k===1&&<ellipse cx={50} cy={50} rx={28} ry={20} fill="none" stroke={l} strokeWidth={3} opacity={0.55}/>}
  {k===5&&[[50,30],[70,45],[62,68],[38,68],[30,45]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r={8} fill={l} opacity={0.35}/>)}
  <ellipse cx={k===0?40:36} cy={k===0?36:30} rx={14} ry={7} fill="#fff" opacity={0.8} transform={'rotate(-30 36 30)'}/>
  <circle cx={66} cy={70} r={4} fill="#fff" opacity={0.35}/>
  <path d={CANDY_SHAPES[k]} fill="none" stroke={b} strokeWidth={1} opacity={0.5}/>
 </symbol>
}
/** Shapes, shading and patterns every piece uses: render once per board. */
export const ArtDefs=memo(function ArtDefs({mode}:{mode:'gems'|'candy'}){
 return <svg width="0" height="0" style={{position:'absolute'}} aria-hidden="true"><defs>
  {mode==='gems'?GEMS.map((g,k)=><g key={k}>
   <radialGradient id={'m3gt-'+k} cx="35%" cy="30%" r="80%"><stop offset="0" stopColor="#fff"/><stop offset="0.35" stopColor={GEM_COLORS[k][1]}/><stop offset="1" stopColor={GEM_COLORS[k][0]}/></radialGradient>
   <clipPath id={'m3gc-'+k}><polygon points={pts(g)}/></clipPath>
   <Gem k={k}/>
  </g>):CANDY_COLORS.map((c,k)=><g key={k}>
   <radialGradient id={'m3cg-'+k} cx="38%" cy="32%" r="75%"><stop offset="0" stopColor={c[1]}/><stop offset="0.45" stopColor={c[0]}/><stop offset="1" stopColor={c[2]}/></radialGradient>
   <clipPath id={'m3cc-'+k}><path d={CANDY_SHAPES[k]}/></clipPath>
   <Candy k={k}/>
  </g>)}
  <pattern id="m3-stripes-h" width="100" height="18" patternUnits="userSpaceOnUse"><rect width="100" height="7" fill="#fff"/></pattern>
  <pattern id="m3-stripes-v" width="18" height="100" patternUnits="userSpaceOnUse"><rect width="7" height="100" fill="#fff"/></pattern>
  <radialGradient id="m3-choc" cx="35%" cy="30%" r="75%"><stop offset="0" stopColor="#a5683f"/><stop offset="0.5" stopColor="#6b3a1c"/><stop offset="1" stopColor="#3a1c0a"/></radialGradient>
  <linearGradient id="m3-cube-a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ff5468"/><stop offset="0.5" stopColor="#ffe03d"/><stop offset="1" stopColor="#3fe07a"/></linearGradient>
  <linearGradient id="m3-cube-b" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#3d9bff"/><stop offset="1" stopColor="#c14dff"/></linearGradient>
  <linearGradient id="m3-cube-c" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#ff9a2e"/><stop offset="1" stopColor="#ff5ad0"/></linearGradient>
  <radialGradient id="m3-flame" cx="50%" cy="70%" r="60%"><stop offset="0" stopColor="#fff6c2"/><stop offset="0.35" stopColor="#ffb02e"/><stop offset="0.7" stopColor="#ff4d1a" stopOpacity="0.8"/><stop offset="1" stopColor="#ff2a00" stopOpacity="0"/></radialGradient>
 </defs></svg>
})
const SPRINKLES=Array.from({length:16},(_,i)=>{const a=i*2.39996,r=10+((i*37)%28);return {x:50+Math.cos(a)*r,y:50+Math.sin(a)*r,rot:(i*53)%180,c:['#ff4d6d','#ffd84d','#4dd2ff','#7dff6a','#fff','#c58bff'][i%6]}})
/** One piece: its gem or candy, dressed for whatever special it is. */
export const PieceArt=memo(function PieceArt({mode,kind,special}:{mode:'gems'|'candy';kind:number;special?:Special}){
 if(mode==='candy'){
  if(special==='color')return <svg className="m3-art is-bomb" viewBox="0 0 100 100"><circle cx={50} cy={50} r={42} fill="url(#m3-choc)" stroke="#2a1205" strokeWidth={2}/>{SPRINKLES.map((s,i)=><rect key={i} x={s.x-4} y={s.y-1.6} width={8} height={3.2} rx={1.6} fill={s.c} transform={'rotate('+s.rot+' '+s.x+' '+s.y+')'}/>)}<ellipse cx={36} cy={30} rx={13} ry={6} fill="#fff" opacity={0.35} transform="rotate(-30 36 30)"/></svg>
  if(special==='area')return <svg className="m3-art is-wrapped" viewBox="0 0 100 100">
   <path d="M18,50 L2,34 L6,50 L2,66Z M82,50 L98,34 L94,50 L98,66Z" fill={CANDY_COLORS[kind][1]} stroke={CANDY_COLORS[kind][2]} strokeWidth={1.5}/>
   <rect x={16} y={16} width={68} height={68} rx={16} fill={CANDY_COLORS[kind][0]} stroke={CANDY_COLORS[kind][2]} strokeWidth={2.5}/>
   <use href={'#m3c-'+kind} x={22} y={22} width={56} height={56}/>
   <rect x={16} y={16} width={68} height={68} rx={16} fill="#fff" opacity={0.22}/>
   <path d="M24,28 Q40,18 60,22" stroke="#fff" strokeWidth={5} strokeLinecap="round" fill="none" opacity={0.85}/>
  </svg>
  return <svg className="m3-art" viewBox="0 0 100 100">
   <use href={'#m3c-'+kind}/>
   {(special==='row'||special==='col')&&<g clipPath={'url(#m3cc-'+kind+')'}><rect width="100" height="100" fill={special==='row'?'url(#m3-stripes-h)':'url(#m3-stripes-v)'} opacity={0.85} transform={special==='row'?'rotate(-12 50 50)':'rotate(12 50 50)'}/></g>}
  </svg>
 }
 if(special==='color')return <svg className="m3-art is-cube" viewBox="0 0 100 100">
  <polygon points="50,8 90,30 50,52 10,30" fill="url(#m3-cube-a)" stroke="#fff" strokeWidth={1.5}/>
  <polygon points="10,30 50,52 50,94 10,72" fill="url(#m3-cube-b)" stroke="#fff" strokeWidth={1.5}/>
  <polygon points="90,30 50,52 50,94 90,72" fill="url(#m3-cube-c)" stroke="#fff" strokeWidth={1.5}/>
  <circle cx={50} cy={52} r={10} fill="#fff" opacity={0.85}/>
 </svg>
 return <svg className={'m3-art'+(special?' is-'+special:'')} viewBox="0 0 100 100">
  {special==='area'&&<g transform="translate(-22,-38) scale(1.44)"><g className="m3-flames"><path d="M50,98 C20,96 6,70 18,44 C22,60 30,62 30,62 C26,40 38,20 52,4 C54,26 70,30 72,48 C76,40 80,36 84,30 C96,56 84,94 50,98Z" fill="url(#m3-flame)"/></g></g>}
  {(special==='cross'||special==='row'||special==='col')&&<g className="m3-rays"><polygon points="50,-4 56,44 104,50 56,56 50,104 44,56 -4,50 44,44" fill="#fff" opacity={0.85}/></g>}
  {special==='nova'&&<circle className="m3-aura" cx={50} cy={50} r={48} fill="none" stroke="#fff" strokeWidth={5} opacity={0.8}/>}
  <use href={'#m3g-'+kind}/>
 </svg>
})
