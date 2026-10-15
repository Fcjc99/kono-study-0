import {lazyPanel} from '../lazyPanel'
import type {PageContext} from './pageContext'
const KQuiz=lazyPanel(()=>import('../components/KQuiz'))

export default function KQuizPage({w}:{w:PageContext}){
 const {openSettings,profile,data,subjects,save}=w
 return <KQuiz onOpenAiSettings={()=>openSettings('Import & export')} profileId={profile.id} lectures={data.kquizLectures.filter(l=>l.profileId===profile.id)} sets={data.kquizSets.filter(s=>s.profileId===profile.id)} sources={data.kquizSources.filter(s=>s.profileId===profile.id)} decks={data.flashcardDecks.filter(d=>d.profileId===profile.id)} subjects={subjects} setData={save}/>
}
