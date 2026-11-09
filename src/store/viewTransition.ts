import {flushSync} from 'react-dom'
/** Switching views (Week to Month, 3 days to People) as a short cross-fade where the browser can, instead of a
 * jump. Nothing moves for someone who asked for less motion, or in a browser without view transitions. */
export function smoothly(change:()=>void){
 const doc=document as Document&{startViewTransition?:(cb:()=>void)=>unknown}
 const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||document.documentElement.dataset.motion==='reduced'
 if(!doc.startViewTransition||reduced||navigator.webdriver){change();return}
 try{doc.startViewTransition(()=>flushSync(change))}catch{change()}
}
