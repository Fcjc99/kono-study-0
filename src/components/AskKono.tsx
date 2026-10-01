import {useCallback,useEffect,useRef,useState} from 'react'
import type {AppData} from '../store/model'
import {answer,readQuestion,type KonoAnswer,type KonoQuestion} from '../store/askKono'
import {useSpeechToText} from '../hooks/useSpeechToText'
import {useLocalSetting} from '../hooks/useLocalSetting'

/** Sanctuary › KONO today › "Ask KONO": KONO asks what you want to know (today, tomorrow, this week,
 * or when something is due), answers on screen and reads it out loud. Ask by tapping, typing or the
 * microphone. "Quiet" turns the voice off on this device. */
const canSpeak=()=>typeof window!=='undefined'&&'speechSynthesis' in window&&typeof SpeechSynthesisUtterance!=='undefined'
function speak(text:string){
 if(!canSpeak())return
 window.speechSynthesis.cancel()
 const u=new SpeechSynthesisUtterance(text)
 u.rate=0.98;u.pitch=1.15
 window.speechSynthesis.speak(u)
}

export default function AskKono({data,today,name,pose,onClose}:{data:AppData;today:string;name:string;pose:string;onClose:()=>void}){
 const [voice,setVoice]=useLocalSetting('kono-voice','on')
 const talking=voice==='on'&&canSpeak()
 const greeting='Hi'+(name?' '+name:'')+'! What do you want to know?'
 const [reply,setReply]=useState<KonoAnswer|null>(null),[typing,setTyping]=useState(false),[text,setText]=useState(''),[heard,setHeard]=useState('')
 const say=useCallback((words:string)=>{if(talking)speak(words)},[talking])
 const greeted=useRef(false)
 useEffect(()=>{if(!greeted.current){greeted.current=true;say(greeting)}},[say,greeting])
 useEffect(()=>()=>{if(canSpeak())window.speechSynthesis.cancel()},[])
 const ask=(question:KonoQuestion,said?:string)=>{
  setHeard(said??'')
  const result=answer(data,question,today)
  const shown=result??{title:'Hmm…',lines:['Try “today”, “tomorrow”, “this week”, or “when is my essay due”.'],speech:'I didn’t catch that. You can ask about today, tomorrow, this week, or when something is due.'}
  setReply(shown);say(shown.speech)
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
   <button type="button" aria-pressed={typing} onClick={()=>{setTyping(!typing);if(!typing)say('What are you looking for? Say or type part of its name.')}}>⏰ When is something due?</button>
  </div>
  {typing&&<form className="ask-kono-type" onSubmit={e=>{e.preventDefault();submit()}}><label>What’s it called?<input value={text} onChange={e=>setText(e.target.value)} placeholder="bio essay, math test…" autoFocus enterKeyHint="search"/></label><button type="submit" className="primary" disabled={!text.trim()}>Ask</button></form>}
  <div className="wb-toolbar ask-kono-foot">
   {supported&&<button type="button" className={'ask-kono-mic'+(listening?' is-listening':'')} aria-pressed={listening} onClick={toggle}>{listening?'Listening…':'🎤 Ask out loud'}</button>}
   {reply&&talking&&<button type="button" onClick={()=>say(reply.speech)}>🔊 Say it again</button>}
   {canSpeak()&&<button type="button" aria-pressed={voice!=='on'} onClick={()=>{const next=voice==='on'?'off':'on';setVoice(next);if(next==='off')window.speechSynthesis.cancel()}}>{voice==='on'?'🔇 Quiet':'🔊 Talk'}</button>}
   <button type="button" onClick={onClose}>Close</button>
  </div>
  {error&&<p role="alert">{error}</p>}
 </div>
}
