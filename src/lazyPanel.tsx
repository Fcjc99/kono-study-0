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
export function lazyPanel<P extends object>(load:()=>Promise<{default:ComponentType<P>}>){
 const Panel=lazy(load) as unknown as ComponentType<P>
 return function LazyPanel(props:P){
  return <PanelLoadBoundary><Suspense fallback={<p className="wb-muted lazy-panel-loading" aria-live="polite">Loading…</p>}><Panel {...props}/></Suspense></PanelLoadBoundary>
 }
}
