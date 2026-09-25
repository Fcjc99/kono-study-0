import { Component, type ReactNode } from 'react'
import { reportError } from '../store/errorReporter'
export default class ErrorBoundary extends Component<{children:ReactNode},{failed:boolean}>{
 state={failed:false}
 static getDerivedStateFromError(){return {failed:true}}
 componentDidCatch(error:unknown){reportError(error)}
 render(){return this.state.failed?<main className="startup-card"><h1>KONO needs a fresh start</h1><p>Your saved plans have not been cleared. Reload the page; if this continues, keep this browser’s data and contact the site owner.</p><button onClick={()=>window.location.reload()}>Reload KONO</button></main>:this.props.children}
}
