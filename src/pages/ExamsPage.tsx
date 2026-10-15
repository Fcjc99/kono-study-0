import type {Entry} from '../store/workspace'
import type {PageContext} from './pageContext'

export default function ExamsPage({w}:{w:PageContext}){
 const {create,data,profile,card}=w
 return <section className="wb-panel wb-board board-paper"><div className="wb-section-head wb-board-heading"><h2>Your exams</h2><button onClick={()=>create('exams')}>＋ Exam</button></div><div className="wb-note-grid wb-board-canvas">{data.exams.filter(e=>e.profileId===profile.id).sort((a,b)=>a.due.localeCompare(b.due)).map(e=>card('exams',e as unknown as Entry))}{!data.exams.some(e=>e.profileId===profile.id)&&<p className="wb-board-empty"><img className="kono-empty-art" src="/garden/kono/tea.webp" alt="" aria-hidden="true"/>No exams yet. Add a date and what you need to review.</p>}</div><div className="wb-board-tray" aria-hidden="true"><span>✿</span><span>✦</span><span>✿</span></div></section>
}
