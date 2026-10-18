import {Component,Suspense,lazy,type ComponentType,type ReactNode} from 'react'
import {reportError} from './store/errorReporter'

/** Shown if a panel's code can't be downloaded -- usually offline, or KONO updated since this tab opened
 * and the old file is gone. Nothing in the plan is affected; reloading picks up the current version. */
class PanelLoadBoundary extends Component<{children:ReactNode},{failed:boolean}>{
 state={failed:false}
 static getDerivedStateFromError(){return {failed:true}}
 componentDidCatch(error:unknown){reportError(error)}
 render(){
  if(!this.state.failed)return this.props.children
  return <div className="wb-panel lazy-panel-error" role="alert"><p>This part of KONO couldn't load. You may be offline, or KONO was just updated. Your plan is safe.</p><button type="button" onClick={()=>window.location.reload()}>Reload KONO</button></div>
 }
}

/** Loads a panel's code only when it is first shown, keeping it out of the startup download. */
/** `fallback` replaces the "Loading…" line while it loads (null shows nothing). */
export function lazyPanel<P extends object>(load:()=>Promise<{default:ComponentType<P>}>,fallback?:ReactNode){
 const Panel=lazy(load) as unknown as ComponentType<P>
 return function LazyPanel(props:P){
  return <PanelLoadBoundary><Suspense fallback={fallback!==undefined?fallback:<p className="wb-muted lazy-panel-loading" aria-live="polite">Loading…</p>}><Panel {...props}/></Suspense></PanelLoadBoundary>
 }
}

/** A whole page that loads on demand, with nothing in its place while it does (no layout flash).
 * `preload()` fetches its code ahead of time; once that has arrived the page shows on the very first
 * render, because React.lazy takes a module from a thenable that answers at once without suspending. */
export function lazyPage<P extends object>(load:()=>Promise<{default:ComponentType<P>}>){
 type Loaded={default:ComponentType<P>}
 let loaded:Loaded|undefined,loading:Promise<Loaded>|undefined
 const preload=()=>loading??=load().then(m=>loaded=m,error=>{loading=undefined;throw error})
 const now=(m:Loaded)=>({then:(done:(value:Loaded)=>void)=>done(m)}) as unknown as Promise<Loaded>
 return Object.assign(lazyPanel<P>(()=>loaded?now(loaded):preload(),null),{preload})
}
