import {useId,useState} from 'react'
import './mechanism-preview.css'

const mechanisms=[
 {name:'Medal chute',title:'One medal. A real starting point.',detail:'A shutter opens at the feed slot. Each medal travels down the pin board before joining the pusher bed.',path:'M180 106 L180 131 L166 150 L188 172 L179 192 L193 212 L193 241 L206 268',color:'#ffdc70'},
 {name:'Prize ball',title:'Follow the prize from its gate.',detail:'The purple ball follows its own side track, then rolls onto the playfield. A prize entering the field is not a collected reward.',path:'M102 103 L85 129 L105 153 L85 178 L105 203 L117 229 L142 253 L161 272',color:'#c99dff'},
 {name:'Tower release',title:'Build it up. Watch it release.',detail:'Tower growth fills the reserve. Five lamps build real stacks on a lift; it lowers and opens so the shelf can push and topple them. Only later tray contact adds to your hand.',path:'M246 81 L226 147 L226 208 L226 230 L226 265',color:'#ffdc70'},
] as const

/** Deliberately an illustration, not a substitute renderer or a simulated score. */
export default function MechanismPreview({compact=false}:{compact?:boolean}){
 const id=useId().replace(/:/g,''),[selected,setSelected]=useState(0),[run,setRun]=useState(0),m=mechanisms[selected]
 return <section className={'mechanism-preview'+(compact?' is-compact':'')} aria-label="Illustrated mechanism preview, not playable">
  <div className="mechanism-art">
   <svg viewBox="0 0 400 345" role="img" aria-label="Illustrated Medal Cove cabinet showing the medal slot, purple ball track, banked tower, pusher bed, and collection tray">
    <defs>
     <linearGradient id={id+'body'} x2=".2" y2="1"><stop stopColor="#ffe0eb"/><stop offset="1" stopColor="#ce789c"/></linearGradient>
     <linearGradient id={id+'deck'} x2="0" y2="1"><stop stopColor="#f7d8ae"/><stop offset="1" stopColor="#bc8553"/></linearGradient>
     <linearGradient id={id+'night'} x2="0" y2="1"><stop stopColor="#bfe7ff"/><stop offset="1" stopColor="#ffe1ec"/></linearGradient>
     <radialGradient id={id+'coin'} cx=".35" cy=".3"><stop stopColor="#fff8c6"/><stop offset=".6" stopColor="#ffcf4f"/><stop offset="1" stopColor="#ba7917"/></radialGradient>
     <radialGradient id={id+'ball'} cx=".3" cy=".25"><stop stopColor="#f3e8ff"/><stop offset=".28" stopColor="#c7a1ff"/><stop offset="1" stopColor="#6c38b2"/></radialGradient>
     <filter id={id+'glow'}><feGaussianBlur stdDeviation="2"/></filter>
    </defs>
    <image href="/games/cove/tree-blossom.webp" x="14" y="55" width="105" height="142"/>
    <image href="/games/cove/tree-leafy.webp" x="291" y="64" width="96" height="133"/>
    <image href="/games/cove/cloud-a.webp" x="24" y="22" width="98" height="32"/>
    <image href="/games/cove/cloud-b.webp" x="267" y="25" width="102" height="33"/>
    <ellipse cx="200" cy="321" rx="151" ry="14" fill="#110b1e" opacity=".65"/>
    <path d="M97 71 L303 71 L325 290 L297 318 L103 318 L75 290 Z" fill={'url(#'+id+'body)'} stroke="#ffdf8f" strokeWidth="3"/>
    <rect x="107" y="80" width="186" height="141" rx="8" fill={'url(#'+id+'night)'} stroke="#f1c86c" strokeWidth="3"/>
    <image href="/games/cove/light-arch.webp" x="216" y="20" width="63" height="68"/>
    <image href="/games/cove/flowers-1.webp" x="110" y="198" width="60" height="24"/>
    <image href="/games/cove/flowers-2.webp" x="241" y="198" width="52" height="24"/>
    <path d="M109 216 L291 216 L315 280 L85 280 Z" fill={'url(#'+id+'deck)'} stroke="#f3c679" strokeWidth="2"/>
    <path d="M111 218 L289 218 L295 240 L105 240 Z" fill="#8bd0be" stroke="#d7f4df" strokeWidth="2"/>
    <path d="M107 97 L107 213 L83 280 M293 97 L293 213 L317 280" fill="none" stroke="#e9dafa" strokeWidth="5" opacity=".55"/>
    <g fill="#e6d4f8" opacity=".65">{Array.from({length:30},(_,i)=><circle key={i} cx={121+(i%6)*29+(Math.floor(i/6)%2)*8} cy={132+Math.floor(i/6)*18} r="2.2"/>)}</g>
    <rect x="168" y="99" width="28" height="12" rx="5" fill="#100b20" stroke="#ffdc70" strokeWidth="2"/>
    <path d="M181 103 L181 119" stroke="#ffdc70" strokeWidth="4"/>
    <g stroke="#ffdc8a" strokeWidth="3" fill="none"><path d="M102 100 L83 130 L104 154 L83 179 L104 203 L116 229 L140 250"/><path d="M108 104 L90 130 L111 154 L90 179 L111 203 L123 226 L147 247"/></g>
    <rect x="94" y="92" width="20" height="15" rx="5" fill="#b586e4" stroke="#efe0ff" strokeWidth="2"/>
    <g fill={'url(#'+id+'coin)'} stroke="#9a661e" strokeWidth="1.1">{Array.from({length:8},(_,i)=><ellipse key={i} cx="246" cy={83-i*4.5} rx="17" ry="5"/>)}</g>
    <path d="M225 89 L267 89" stroke="#8ad5ce" strokeWidth="5" strokeLinecap="round"/>
    <path d="M202 172 L202 233 M250 172 L250 233 M202 172 L250 172" stroke="#b2a1ca" fill="none" strokeWidth="3"/>
    <g fill={'url(#'+id+'coin)'} stroke="#9a661e" strokeWidth=".7">{Array.from({length:10},(_,i)=><ellipse key={i} cx={i<5?217:235} cy={217-(i%5)*3.2} rx="8" ry="3"/>)}</g>
    <path d="M204 222 L224 222 M228 222 L248 222" stroke="#8ad5ce" strokeWidth="4"/>
    <text x="226" y="239" textAnchor="middle" fontSize="6" fill="#5d4971">BUILD · LOWER · RELEASE</text>
    <rect x="116" y="54" width="89" height="31" rx="8" fill="#362047" stroke="#ffdc81" strokeWidth="2"/>
    <text x="160" y="66" textAnchor="middle" fontSize="8" fontWeight="900" fill="#ffe3a2" letterSpacing="1">BIG BONUS</text>
    {Array.from({length:5},(_,i)=><circle key={i} cx={134+i*13} cy="75" r="3.8" fill={selected===2?'#ffe080':i<3?'#ffe080':'#786080'}/>)}
    <rect x="141" y="86" width="88" height="9" rx="4" fill="#ffdcb4"/>
    <text x="185" y="93" textAnchor="middle" fontSize="6.5" fontWeight="900" fill="#6e3555" letterSpacing="1">KONO MEDAL COVE</text>
    <g fill={'url(#'+id+'coin)'} stroke="#a76e20" strokeWidth=".7">{Array.from({length:39},(_,i)=>{const row=Math.floor(i/8),col=i%8;return <ellipse key={i} cx={117+col*23+(row%2)*6} cy={242+row*7} rx="10" ry="4.2"/>})}</g>
    <circle cx="157" cy="252" r="8" fill={'url(#'+id+'ball)'}/>
    <path d="M82 284 L318 284 L298 309 L102 309 Z" fill="#442745" stroke="#ffdf92" strokeWidth="2"/>
    <path d="M99 300 L301 300" stroke="#8dd4bd" strokeWidth="3"/>
    <text x="200" y="298" textAnchor="middle" fontSize="8" fontWeight="800" fill="#ffe5bb" letterSpacing="1.2">COLLECTION TRAY</text>
    <g fill="#fff2b2">{Array.from({length:12},(_,i)=><circle key={i} cx={113+i*15.8} cy="218" r="2.1"/>)}</g>
    <path d={m.path} fill="none" stroke={m.color} strokeWidth="3" strokeDasharray="3 6" opacity=".8"/>
    <circle key={selected+'-'+run} className="mechanism-traveller" r={selected===1?7:6} fill={'url(#'+id+(selected===1?'ball':'coin')+')'} stroke="#fff3cd" strokeWidth="1">
     <animateMotion dur={selected===1?'3s':'2.5s'} path={m.path} repeatCount="indefinite"/>
    </circle>
    <g fontSize="8" fontWeight="800" fill="#5d4971">
     <text x="181" y="119" textAnchor="middle">FEED</text>
     <text x="65" y="177" textAnchor="middle" transform="rotate(-90 65 177)">BALL RUN</text>
     <text x="246" y="37" textAnchor="middle">TOWER BANK</text>
    </g>
   </svg>
   <div className="mechanism-watermark">ILLUSTRATED PREVIEW · NOT PLAYABLE</div>
  </div>
  <div className="mechanism-copy">
   <div className="mechanism-tabs" role="group" aria-label="Preview a mechanism">{mechanisms.map((item,i)=><button key={item.name} type="button" aria-pressed={selected===i} onClick={()=>{setSelected(i);setRun(n=>n+1)}}>{item.name}</button>)}</div>
   <strong>{m.title}</strong><p>{m.detail}</p>
   <small>Only medals that reach the collection tray return to your hand.</small>
  </div>
 </section>
}
