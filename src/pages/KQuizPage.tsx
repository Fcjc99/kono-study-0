import {lazyPanel} from '../lazyPanel'
import type {PageContext} from './pageContext'
import {quizCoins,quizEvent,quizToday,QUIZ_DAILY} from '../store/konoCoins'
import {addCareEvent} from '../store/konoCare'
import {localDate} from '../store/model'
const KQuiz=lazyPanel(()=>import('../components/KQuiz'))

export default function KQuizPage({w}:{w:PageContext}){
 const {openSettings,profile,data,subjects,save}=w
 // A right answer in K-Quiz › Play: its coins go to KONO's care log (store/konoCoins quizEvent, up to a
 // daily limit). The event is worked out from the latest plan as it saves; the number shown is the same.
 const payQuiz=(streak:number)=>{
  const now=new Date(),today=localDate(now),left=QUIZ_DAILY-quizToday(data.konoCare?.[profile.id]?.log??[],today)
  if(left<=0)return null
  void save(d=>{const ev=quizEvent(d.konoCare?.[profile.id]?.log??[],today,streak,now);return ev?{...d,konoCare:{...d.konoCare,[profile.id]:addCareEvent(d.konoCare?.[profile.id],profile.id,ev,now)}}:d},{undoable:false})
  return Math.min(quizCoins(streak),left)
 }
 return <KQuiz onOpenAiSettings={()=>openSettings('Import & export')} profileId={profile.id} lectures={data.kquizLectures.filter(l=>l.profileId===profile.id)} sets={data.kquizSets.filter(s=>s.profileId===profile.id)} sources={data.kquizSources.filter(s=>s.profileId===profile.id)} decks={data.flashcardDecks.filter(d=>d.profileId===profile.id)} subjects={subjects} setData={save} onCorrect={payQuiz}/>
}
