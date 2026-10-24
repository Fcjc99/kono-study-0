import {memo} from 'react'

/** Meowdoku's cats, drawn in SVG: a round face with ears (pink inside), big shiny eyes that blink now and
 * then, a little nose and mouth, whiskers and rosy cheeks. Coats vary: ginger, grey, cream, black, calico
 * and tuxedo. `mood` 'happy' closes the eyes into smiles (a solved board); 'cross' narrows them (a cat in
 * the wrong place). */
const COATS=[
 {fur:'#ffb35c',dark:'#e07a1f',ear:'#ff9ab0',mark:'#e88a2c'},
 {fur:'#b9c3d6',dark:'#7a879e',ear:'#ffadc0',mark:'#8f9bb2'},
 {fur:'#fff1dc',dark:'#d9b98f',ear:'#ffadc0',mark:'#f0d3a8'},
 {fur:'#3a3550',dark:'#211d33',ear:'#ff8fb0',mark:'#2a2640'},
 {fur:'#fff7ee',dark:'#cfa98a',ear:'#ffadc0',mark:'#f29a3c'},
 {fur:'#2d2a3a',dark:'#15131f',ear:'#ff9ab0',mark:'#ffffff'},
]
export default memo(function CatArt({coat=0,mood}:{coat?:number;mood?:'happy'|'cross'}){
 const c=COATS[coat%COATS.length],light=coat===3||coat===5
 return <svg className={'cat-art'+(mood?' is-'+mood:'')} viewBox="0 0 100 100">
  <path d="M18,44 L14,8 L42,26Z" fill={c.fur} stroke={c.dark} strokeWidth={3} strokeLinejoin="round"/>
  <path d="M82,44 L86,8 L58,26Z" fill={c.fur} stroke={c.dark} strokeWidth={3} strokeLinejoin="round"/>
  <path d="M21,36 L19,16 L35,27Z" fill={c.ear}/><path d="M79,36 L81,16 L65,27Z" fill={c.ear}/>
  <ellipse cx={50} cy={58} rx={40} ry={34} fill={c.fur} stroke={c.dark} strokeWidth={3}/>
  {coat===0&&<path d="M44,26 Q50,34 56,26 M38,30 Q44,38 50,30 M50,30 Q56,38 62,30" stroke={c.mark} strokeWidth={3.5} fill="none" strokeLinecap="round"/>}
  {coat===4&&<><path d="M16,52 Q20,30 40,28 Q30,44 32,60Z" fill={c.mark}/><path d="M84,46 Q80,32 66,30 Q74,40 70,52Z" fill="#4a3428"/></>}
  {coat===5&&<path d="M34,72 Q50,96 66,72 Q60,62 50,64 Q40,62 34,72Z" fill={c.mark}/>}
  {mood==='happy'?<><path d="M28,56 Q35,48 42,56" stroke="#2a1d2e" strokeWidth={4} fill="none" strokeLinecap="round"/><path d="M58,56 Q65,48 72,56" stroke="#2a1d2e" strokeWidth={4} fill="none" strokeLinecap="round"/></>
  :<g className="cat-eyes">
   <ellipse cx={35} cy={55} rx={8} ry={mood==='cross'?4:10} fill={light?'#ffe36b':'#2a1d2e'}/><ellipse cx={65} cy={55} rx={8} ry={mood==='cross'?4:10} fill={light?'#ffe36b':'#2a1d2e'}/>
   {light&&<><ellipse cx={35} cy={55} rx={3} ry={8} fill="#1a1520"/><ellipse cx={65} cy={55} rx={3} ry={8} fill="#1a1520"/></>}
   <circle cx={38} cy={50} r={3.2} fill="#fff"/><circle cx={68} cy={50} r={3.2} fill="#fff"/><circle cx={33} cy={59} r={1.5} fill="#fff" opacity={0.8}/><circle cx={63} cy={59} r={1.5} fill="#fff" opacity={0.8}/>
  </g>}
  <ellipse cx={24} cy={68} rx={7} ry={4} fill="#ff8fb0" opacity={0.55}/><ellipse cx={76} cy={68} rx={7} ry={4} fill="#ff8fb0" opacity={0.55}/>
  <path d="M46,64 L54,64 L50,69Z" fill="#ff7aa0"/>
  <path d="M50,69 Q46,75 41,72 M50,69 Q54,75 59,72" stroke={light?'#fff':'#2a1d2e'} strokeWidth={2.2} fill="none" strokeLinecap="round"/>
  <path d="M8,62 L30,65 M8,72 L30,70 M92,62 L70,65 M92,72 L70,70" stroke={light?'#fff':'#5a4a5e'} strokeWidth={1.6} strokeLinecap="round" opacity={0.8}/>
 </svg>
})
