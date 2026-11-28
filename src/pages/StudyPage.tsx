import type {CSSProperties} from 'react'
import type {Entry} from '../store/workspace'
import {reviewQueue} from '../store/flashcards'
import {toneVars} from '../store/tones'
import type {PageContext} from './pageContext'
import StudyTabs from './StudyTabs'
import Icon from '../components/Icon'
import KonoEmpty from '../components/KonoEmpty'
import './study-page.css'

const DAY=86_400_000
/** Study: tests, flashcards, K-Quiz study sets and notes in one place. Tests count down first (Review plans
 * sessions for one), then the flashcards due today, the latest study sets and a few notes. Each section opens
 * its full page (Exams, Notes, K-Quiz), which keeps the same Study tabs on top. */
export default function StudyPage({w}:{w:PageContext}){
 const {data,profile,today,notes,subjects,navigate,create,edit,setPlanRequest,hiddenPages}=w
 const days=(due:string)=>Math.round((new Date(due+'T12:00:00').getTime()-new Date(today+'T12:00:00').getTime())/DAY)
 const tests=data.exams.filter(e=>e.profileId===profile.id&&!e.done&&e.due>=today).sort((a,b)=>a.due.localeCompare(b.due))
 const decks=data.flashcardDecks.filter(d=>d.profileId===profile.id)
 const due=decks.reduce((n,d)=>n+reviewQueue(d,today).length,0),dueDecks=decks.filter(d=>reviewQueue(d,today).length>0)
 const sets=data.kquizSets.filter(s=>s.profileId===profile.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))
 const shownNotes=[...notes].sort((a,b)=>Number(Boolean(b.pinned))-Number(Boolean(a.pinned))||String(b.created??'').localeCompare(String(a.created??''))).slice(0,4)
 const subjectName=(id:string)=>subjects.find(s=>s.id===id)?.name
 const flashcards=()=>{try{sessionStorage.setItem('kono-open-flashcards','1')}catch{/* fine */}navigate('Notes')}
 return <div className="study-page">
  <StudyTabs page="Study" navigate={navigate} hidden={hiddenPages}/>
  {/* The next test, big: how long until it, and Plan review; then the rest in a few numbers. */}
  <section className={'study-hero'+(tests[0]?'':' is-clear')} aria-label="Coming up">
   {tests[0]?(()=>{const t=tests[0],n=days(t.due),span=14,p=Math.max(4,Math.min(100,Math.round((span-Math.min(span,n))/span*100)));return <>
    <div className="study-hero-ring" style={{'--p':p} as CSSProperties} aria-hidden="true"><b>{n}</b><small>{n===0?'today':n===1?'day':'days'}</small></div>
    <div className="study-hero-copy"><small>Next test{subjectName(t.subjectId)?' · '+subjectName(t.subjectId):''}</small><b>{t.title}</b><span>{new Date(t.due+'T12:00:00').toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}</span></div>
    <button type="button" className="study-hero-go" onClick={()=>{setPlanRequest(x=>x+1);navigate('Planner')}}>✨ Plan my review</button>
   </>})():<><img className="study-hero-kono" src="/garden/kono/read.webp" alt="" width={72} height={72}/><div className="study-hero-copy"><small>Coming up</small><b>No tests on the way</b><span>A calm stretch: a good time for flashcards or a study set.</span></div></>}
   <ul className="study-hero-stats" aria-label="Study at a glance">
    <li><b>{tests.length}</b> test{tests.length===1?'':'s'}</li><li><b>{due}</b> card{due===1?'':'s'} due</li><li><b>{sets.length}</b> study set{sets.length===1?'':'s'}</li><li><b>{notes.length}</b> note{notes.length===1?'':'s'}</li>
   </ul>
  </section>
  {!hiddenPages.includes('Exams')&&<section className="wb-panel study-tests" aria-label="Tests">
   <div className="study-head"><h2>Tests</h2><button type="button" onClick={()=>create('exams')}>＋ Add a test</button></div>
   {tests.length?<ul>{tests.slice(0,3).map(e=>{const n=days(e.due);return <li key={e.id}>
    <div className="study-count" aria-hidden="true"><b>{n}</b><span>{n===0?'today':n===1?'day':'days'}</span></div>
    <button type="button" className="study-test-main" aria-label={'Edit '+e.title} onClick={()=>edit('exams',e as unknown as Entry)}><b>{e.title}</b><small>{[subjectName(e.subjectId),new Date(e.due+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})].filter(Boolean).join(' · ')}</small></button>
    <button type="button" className="study-pill" onClick={()=>{setPlanRequest(x=>x+1);navigate('Planner')}}>Plan review</button>
   </li>})}</ul>:<KonoEmpty compact pose="sit" title="No tests coming up">Add one and KONO counts down to it.</KonoEmpty>}
   {tests.length>3&&<button type="button" className="study-more" onClick={()=>navigate('Exams')}>All {tests.length} tests ›</button>}
  </section>}
  <section className="wb-panel study-cards" aria-label="Flashcards">
   <span className="study-emoji"><Icon name="cards" size={30}/></span>
   <div><h2>{due?due+' flashcard'+(due===1?'':'s')+' due':'Flashcards'}</h2><p className="wb-muted">{due?dueDecks.map(d=>d.title).slice(0,3).join(' · '):decks.length?'Nothing due today. Nice.':'Cards you write yourself, shown again just before you’d forget them.'}</p></div>
   <button type="button" className="study-pill" onClick={flashcards}>{due?'Practice':decks.length?'Open':'Make cards'}</button>
  </section>
  {!hiddenPages.includes('K-Quiz')&&<section className="wb-panel study-sets" aria-label="Study sets">
   <div className="study-head"><h2>Study sets</h2><button type="button" className="primary" onClick={()=>navigate('K-Quiz')}>＋ Make one</button></div>
   {sets.length?<ul>{sets.slice(0,3).map(s=><li key={s.id}><span className="study-set-icon"><Icon name="sets" size={24}/></span><button type="button" className="study-set-main" onClick={()=>navigate('K-Quiz')}><b>{s.title}</b><small>{[subjectName(s.subjectId),s.studyGuide?'Guide':'',s.flashcardDeckId?'Cards':'',s.practiceTest?'Practice test':''].filter(Boolean).join(' · ')}</small></button></li>)}</ul>
   :<p className="wb-muted">Record a lecture, paste notes or scan a page, and K-Quiz makes a study guide, flashcards and a practice test.</p>}
  </section>}
  <section className="wb-panel study-notes" aria-label="Notes">
   <div className="study-head"><h2>Notes</h2><button type="button" onClick={()=>navigate('Notes')}>{notes.length?'All '+notes.length+' ›':'＋ New note'}</button></div>
   {shownNotes.length?<div className="study-note-grid">{shownNotes.map(n=><button type="button" key={n.id} className="study-note" style={toneVars(String(n.color??'#f6e6b8')) as CSSProperties} onClick={()=>edit('notes',n as unknown as Entry)}><b>{n.title||'Note'}</b><span>{String(n.body??'').replace(/<[^>]*>/g,' ').replace(/[*_#`~>]+/g,'').slice(0,80)}</span></button>)}</div>
   :<p className="wb-muted">Pin reminders, ideas and study notes here.</p>}
  </section>
 </div>
}
