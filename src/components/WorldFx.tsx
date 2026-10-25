import type {CSSProperties} from 'react'
import type {LandId,Light} from '../store/konoWorld'

/** The world map's and the lands' living layers (KonoWorld): drifting clouds and their shadows, glints on
 * the sea, birds, a sailing boat, the time of day's light, and each land's own weather (sea sparkle and
 * gulls on the beach, fireflies, sunbeams and falling leaves in the forest, snowfall and chimney smoke in
 * the village). Only pictures: nothing here can be tapped. Placed in shares of the picture. */

/** A fixed pseudo-random sequence, so the layers look the same every render. */
function seeded(seed:number){let s=seed;return ()=>{s=(s*16807)%2147483647;return s/2147483647}}
const pos=(x:number,y:number,extra:CSSProperties={}):CSSProperties=>({left:x*100+'%',top:y*100+'%',...extra})
const vars=(v:Record<string,string|number>)=>v as CSSProperties


const MAP_GLINTS=[[0.06,0.3],[0.12,0.62],[0.27,0.68],[0.33,0.27],[0.4,0.1],[0.66,0.07],[0.7,0.36],[0.78,0.2],[0.93,0.6],[0.82,0.66],[0.36,0.82],[0.6,0.94],[0.07,0.76],[0.95,0.25],[0.25,0.36],[0.73,0.86]]
const STARS=(()=>{const r=seeded(7);return Array.from({length:26},()=>[r(),r()*0.7,r()*3])})()

function Birds({top,delay,dur}:{top:number;delay:number;dur:number}){
 return <span className="wfx-birds" style={pos(0,top,vars({'--d':delay+'s','--t':dur+'s'}))}>
  {[0,1,2].map(i=><svg key={i} viewBox="0 0 20 8" style={vars({'--i':i})}><path d="M1 6 Q5 0 10 5 Q15 0 19 6"/></svg>)}
 </span>
}

function Night({light}:{light:Light}){
 return <>
  <span className={'wfx-light is-'+light}/>
  {light==='night'&&STARS.map(([x,y,d],i)=><i key={i} className="wfx-star" style={pos(x,y,vars({'--d':d+'s'}))}/>)}
 </>
}

export function MapFx({light}:{light:Light}){
 return <div className="wfx" aria-hidden="true">
  {MAP_GLINTS.map(([x,y],i)=><i key={i} className="wfx-glint" style={pos(x,y,vars({'--d':(i*0.37)%3+'s'}))}/>)}
  <span className="wfx-boat"><span>⛵</span></span>
  {[[0.14,0,46],[0.52,-22,58],[0.33,-40,52]].map(([y,d,t],i)=><span key={i} className="wfx-cloud-wrap" style={pos(0,y,vars({'--d':d+'s','--t':t+'s'}))}><span className="wfx-cloud-shadow"/><span className="wfx-cloud"/></span>)}
  <Birds top={0.1} delay={0} dur={22}/>
  <Birds top={0.58} delay={-11} dur={28}/>
  <Night light={light}/>
 </div>
}

const SNOW=(()=>{const r=seeded(3);return Array.from({length:44},()=>({x:r(),s:2+r()*4,d:-r()*9,t:6+r()*6,w:r()*30-15}))})()
const FIREFLIES=(()=>{const r=seeded(11);return Array.from({length:16},()=>({x:0.12+r()*0.76,y:0.3+r()*0.6,d:-r()*6,t:4+r()*4}))})()
const LEAVES=(()=>{const r=seeded(19);return Array.from({length:9},()=>({x:r(),d:-r()*12,t:9+r()*6,c:['#9bc53d','#e0a43a','#c8642f'][Math.floor(r()*3)]}))})()
const BEACH_GLINTS=[[0.06,0.5],[0.1,0.75],[0.2,0.86],[0.32,0.95],[0.5,0.9],[0.66,0.96],[0.03,0.3],[0.14,0.62],[0.42,0.82],[0.78,0.98]]
const SMOKE=[[0.7,0.18],[0.765,0.17],[0.94,0.14]]

export function LandFx({land,light}:{land:LandId;light:Light}){
 return <div className="wfx" aria-hidden="true">
  {land==='beach'&&<>
   {BEACH_GLINTS.map(([x,y],i)=><i key={i} className="wfx-glint" style={pos(x,y,vars({'--d':(i*0.53)%3+'s'}))}/>)}
   <span className="wfx-foam"/>
   <Birds top={0.08} delay={-4} dur={18}/>
  </>}
  {land==='forest'&&<>
   <span className="wfx-beams"><i/><i/><i/></span>
   {LEAVES.map((l,i)=><i key={i} className="wfx-leaf" style={pos(l.x,-0.05,vars({'--d':l.d+'s','--t':l.t+'s','--c':l.c}))}/>)}
   {FIREFLIES.map((f,i)=><i key={i} className="wfx-firefly" style={pos(f.x,f.y,vars({'--d':f.d+'s','--t':f.t+'s'}))}/>)}
  </>}
  {land==='snow'&&<>
   {SMOKE.map(([x,y],i)=><span key={i} className="wfx-smoke" style={pos(x,y)}>{[0,1,2].map(j=><i key={j} style={vars({'--d':-j*1.3-i*0.6+'s'})}/>)}</span>)}
   {SNOW.map((f,i)=><i key={i} className="wfx-snow" style={pos(f.x,-0.04,vars({'--s':f.s+'px','--d':f.d+'s','--t':f.t+'s','--w':f.w+'px'}))}/>)}
  </>}
  <span className="wfx-cloud-wrap is-shadow-only" style={pos(0,0.5,vars({'--d':'-10s','--t':'40s'}))}><span className="wfx-cloud-shadow"/></span>
  <Night light={light}/>
 </div>
}
