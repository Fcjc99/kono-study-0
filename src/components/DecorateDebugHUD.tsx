import {useEffect, useState} from 'react'

const isDebugOn=():boolean=>{
 try{return new URLSearchParams(location.search).get('debug')==='1'}catch{return false}
}
const rectStr=(r:DOMRect|null):string=>r?`${r.x.toFixed(1)},${r.y.toFixed(1)} ${r.width.toFixed(1)}x${r.height.toFixed(1)}`:'none'

/** A temporary, opt-in (add ?debug=1 to the URL) on-screen readout of the exact numbers driving
 * Decorate's placement math -- added to get real evidence off a device (a Samsung Fold 7) where
 * Decorate looks badly broken, but every attempt to reproduce it in a standard browser -- even one
 * sized and emulated to match that exact screen -- shows correct, consistent numbers throughout.
 * Screenshotting this panel from the real device is the fastest way to find out whether it disagrees
 * with every other browser about its own layout, or whether something else entirely is going on.
 * Costs nothing for anyone who doesn't type ?debug=1 themselves -- safe to delete once that's answered. */
export default function DecorateDebugHUD({mode}:{mode:'decorate'|'view'}){
 const [on,setOn]=useState(isDebugOn)
 const [text,setText]=useState('')
 useEffect(()=>{
  if(!on)return
  let raf=0
  const tick=()=>{
   const hotspot=document.querySelector('.build-hotspot-layer')
   const backdrop=document.querySelector('.wb-sanctuary-backdrop')
   const canvas=document.querySelector('.sanctuary-viewport canvas')
   const items=Array.from(document.querySelectorAll('.build-item'))
   const lines=[
    `mode=${mode} viewport=${window.innerWidth}x${window.innerHeight} dpr=${window.devicePixelRatio} visualViewport=${window.visualViewport?Math.round(window.visualViewport.width)+'x'+Math.round(window.visualViewport.height):'n/a'}`,
    `UA=${navigator.userAgent}`,
    `hotspot=${rectStr(hotspot?.getBoundingClientRect()??null)} class=${hotspot?.className??'none'}`,
    `backdrop=${rectStr(backdrop?.getBoundingClientRect()??null)}`,
    `canvas=${rectStr(canvas?.getBoundingClientRect()??null)}`,
    ...items.map((el,i)=>`item[${i}] class="${el.className}" rect=${rectStr(el.getBoundingClientRect())} style="${el.getAttribute('style')}"`),
   ]
   setText(lines.join('\n'))
   raf=requestAnimationFrame(tick)
  }
  raf=requestAnimationFrame(tick)
  return ()=>cancelAnimationFrame(raf)
 },[on,mode])
 if(!on)return null
 return <pre style={{position:'fixed',left:4,right:4,bottom:4,zIndex:9999,maxHeight:'44vh',overflow:'auto',margin:0,padding:'8px 28px 8px 8px',background:'#000c',color:'#0f0',fontSize:10,lineHeight:1.35,whiteSpace:'pre-wrap',wordBreak:'break-all',borderRadius:8}}>
  {text}
  <button type="button" aria-label="Close debug overlay" style={{position:'absolute',top:2,right:2,fontSize:10,padding:'2px 6px',lineHeight:1,minHeight:0}} onClick={()=>setOn(false)}>×</button>
 </pre>
}
