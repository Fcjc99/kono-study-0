import {useState} from 'react'
import type {AppData} from '../store/model'
import {answer,readQuestion,type KonoAnswer,type KonoQuestion} from '../store/askKono'
import {useSpeechToText} from '../hooks/useSpeechToText'

/** Sanctuary › KONO today › "Ask KONO": KONO asks what you want to know (today, tomorrow, this week,
 * or when something is due) and answers on screen. Ask by tapping, typing or the microphone. KONO
 * doesn't talk back for now (store/konoVoice.ts is kept for if it does again). */
export default function AskKono({data,today,name,pose,onClose}:{data:AppData;today:string;name:string;pose:string;onClose:()=>void}){
 const greeting='Hi'+(name?' '+name:'')+'! What do you want to know?'
 const [reply,setReply]=useState<KonoAnswer|null>(null),[typing,setTyping]=useState(false),[text,setText]=useState(''),[heard,setHeard]=useState('')
 const ask=(question:KonoQuestion,said?:string)=>{
  setHeard(said??'')
  const result=answer(data,question,today)
  const shown=result??{title:'Hmm…',lines:['Try “today”, “tomorrow”, “this week”, or “when is my essay due”.'],speech:'I didn’t catch that. You can ask about today, tomorrow, this week, or when something is due.'}
  setReply(shown)
 }
 const {listening,error,toggle,supported}=useSpeechToText((said:string)=>ask(readQuestion(said),said))
 const submit=()=>{if(!text.trim())return;const q=readQuestion(text);ask(q.kind==='unknown'?{kind:'due',query:text}:q,text);setText('')}
 return <div className="ask-kono" role="dialog" aria-label="Ask KONO">
  <div className="ask-kono-head"><img src={pose} alt=""/><p className="ask-kono-bubble">{reply?<><strong>{reply.title}</strong>{reply.lines.map((l,i)=><span key={i}>{l}</span>)}</>:greeting}</p></div>
  {heard&&<p className="ask-kono-heard">You asked: “{heard}”</p>}
  <div className="ask-kono-choices" role="group" aria-label="Ask about">
   <button type="button" onClick={()=>ask({kind:'today'})}>📅 Today’s schedule</button>
   <button type="button" onClick={()=>ask({kind:'tomorrow'})}>🌙 Tomorrow</button>
   <button type="button" onClick={()=>ask({kind:'week'})}>🗓️ This week</button>
   <button type="button" aria-pressed={typing} onClick={()=>setTyping(!typing)}>⏰ When is something due?</button>
  </div>
  {typing&&<form className="ask-kono-type" onSubmit={e=>{e.preventDefault();submit()}}><label>What’s it called?<input value={text} onChange={e=>setText(e.target.value)} placeholder="bio essay, math test…" autoFocus enterKeyHint="search"/></label><button type="submit" className="primary" disabled={!text.trim()}>Ask</button></form>}
  <div className="wb-toolbar ask-kono-foot">
   {supported&&<button type="button" className={'ask-kono-mic'+(listening?' is-listening':'')} aria-pressed={listening} onClick={toggle}>{listening?'Listening…':'🎤 Ask out loud'}</button>}
   <button type="button" onClick={onClose}>Close</button>
  </div>
  {error&&<p role="alert">{error}</p>}
 </div>
}
