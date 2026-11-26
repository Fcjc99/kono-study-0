import type {ReactNode} from 'react'
import './kono-empty.css'

/** When there's nothing to show: KONO in a pose that fits (resting on a free day, reading by an empty shelf), a
 * short line that says what's going on, and the one thing to do next. KONO steps out when a plan has the island
 * and KONO turned off (Settings › Look & feel), leaving the words. `compact` sits inside a list. */
export default function KonoEmpty({pose='sit',title,children,action,compact}:{pose?:'sit'|'sleep'|'tea'|'read'|'happy'|'excited'|'question'|'fishing';title:string;children?:ReactNode;action?:{label:string;onClick:()=>void};compact?:boolean}){
 return <div className={'kono-empty'+(compact?' is-compact':'')}>
  <img className="kono-empty-face" src={'/garden/kono/'+pose+'.webp'} alt="" aria-hidden="true" width={compact?48:76} height={compact?48:76}/>
  <div className="kono-empty-text"><p className="kono-empty-title">{title}</p>{children&&<p className="kono-empty-note">{children}</p>}{action&&<button type="button" className="kono-empty-action" onClick={action.onClick}>{action.label}</button>}</div>
 </div>
}
