import { useRef, useState, type FormEvent, type SetStateAction } from 'react'
import {useDraftState} from '../hooks/useDraftState'
import { uid, type AppData } from '../store/model'
import { parseFlashcards, reviewQueue, type FlashcardDeck } from '../store/flashcards'
import './StudyPlanner.css'

export default function Flashcards({ profileId, decks, setData, draftKey='kono-card-draft' }: { draftKey?:string; profileId: string; decks: FlashcardDeck[]; setData: (action: SetStateAction<AppData>) => Promise<boolean> }) {
  const [open, setOpen] = useState(false), [title, setTitle] = useDraftState(draftKey+':title',''), [text, setText] = useDraftState(draftKey+':text',''), [message, setMessage] = useState('')
  const [deleting,setDeleting]=useState<string|null>(null)
  const [editing,setEditing]=useState<FlashcardDeck|null>(null)
  const [preview, setPreview] = useState<FlashcardDeck | null>(null)
  const [session, setSession] = useState<{ deckId: string; ids: string[]; index: number } | null>(null)
  const [revealed, setRevealed] = useState(false), [busy, setBusy] = useState(false)
  const saving = useRef(false), importGeneration = useRef(0)
  const deck = decks.find(d => d.id === session?.deckId), card = deck?.cards.find(c => c.id === session?.ids[session.index])
  const run = async (action: () => Promise<boolean>, success: () => void) => {
    if (saving.current) return
    saving.current = true; setBusy(true); setMessage('')
    try { if (await action()) success(); else setMessage('Not saved yet. Use Retry in the save status before leaving.') }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save. Your draft is still here.') }
    finally { saving.current = false; setBusy(false) }
  }
  const review = (event: FormEvent) => {
    event.preventDefault(); setMessage('')
    try { if (!title.trim()) throw new Error('Give this deck a name.'); importGeneration.current++; setPreview({ id: editing?.id??uid('deck'), profileId, title: title.trim(), cards: parseFlashcards(text, () => uid('card')).map((c,i)=>editing?.cards[i]?{...c,id:editing.cards[i].id,needsReview:true,reviewId:uid('review')}:c) }) }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Check the question-and-answer format.') }
  }
  const startQuiz = (d: FlashcardDeck, missedOnly = false) => { setSession({ deckId: d.id, ids: reviewQueue(d, missedOnly), index: 0 }); setRevealed(false); setMessage('') }
  const grade = (needsReview: boolean) => {
    if (!deck || !card || !session) return
    const expected = card, active = session, reviewId = uid('review')
    void run(() => setData(data => {
      const current = data.flashcardDecks.find(d => d.id === deck.id && d.profileId === profileId)?.cards.find(c => c.id === card.id)
      if (!current || current.question !== expected.question || current.answer !== expected.answer) throw new Error('This card changed on another device. Start the quiz again.')
      return { ...data, flashcardDecks: data.flashcardDecks.map(d => d.id === deck.id ? { ...d, cards: d.cards.map(c => c.id === card.id ? { ...c, needsReview, reviewId } : c) } : d) }
    }), () => { setSession({ ...active, index: active.index + 1 }); setRevealed(false) })
  }
  return <section className="card study-planner flashcards"><div className="card-head"><div><span className="eyebrow">Quiz me</span><h3>Your flashcards</h3><p>Write your own questions or import a prepared question-and-answer list. No AI needed.</p></div><button type="button" className="primary" onClick={() => { setEditing(null);setOpen(true); setMessage('') }}>＋ Create / import cards</button></div>
    {deleting && <div className="study-message" role="group" aria-label="Confirm deck removal"><p>Move this deck to Trash? You can restore it later.</p><button disabled={busy} onClick={()=>void run(()=>setData(data=>({...data,flashcardDecks:data.flashcardDecks.filter(d=>d.id!==deleting)})),()=>{if(session?.deckId===deleting)setSession(null);setDeleting(null);setMessage('Deck moved to Trash.')})}>Confirm removal</button><button onClick={()=>setDeleting(null)}>Keep deck</button></div>}
    {message && <p className="study-message" role="status">{message}</p>}
    {open && !preview && <form className="study-plan-form" onSubmit={review}><fieldset disabled={busy}><label>Deck name<input required maxLength={200} value={title} onChange={e => setTitle(e.target.value)} placeholder="Biology — key terms" /></label><label>Question-and-answer list<textarea required rows={7} maxLength={100000} value={text} onChange={e => { importGeneration.current++; setText(e.target.value) }} placeholder={'What is photosynthesis? :: Turning light into chemical energy\nWhat carries genetic information? :: DNA'} /></label><p>One card per line: question <strong> :: </strong> answer. Tab-separated pairs also work. Up to 200 cards. Ordinary notes and PDFs need to be turned into pairs first.</p><label>Import a text or TSV file<input type="file" accept=".txt,.tsv,text/plain,text/tab-separated-values" onChange={e => {
      const file = e.target.files?.[0]; e.target.value = ''; if (!file) return
      if (file.size > 100000) { setMessage('Choose a text file under 100 KB.'); return }
      const generation = ++importGeneration.current
      void file.text().then(value => { if (generation !== importGeneration.current) return; parseFlashcards(value, () => uid('check')); setText(value); setMessage('Imported into the draft. Preview before saving.') }).catch(error => { if (generation === importGeneration.current) setMessage(error instanceof Error ? error.message : 'Could not read this file.') })
    }} /></label><div className="study-actions"><button className="primary">Preview cards</button><button type="button" className="secondary" onClick={() => { importGeneration.current++; setOpen(false) }}>Cancel</button></div></fieldset></form>}
    {preview && <div><h4>{preview.title} · {preview.cards.length} cards</h4><div className="study-preview-scroll"><ol>{preview.cards.map(c => <li key={c.id}><strong>{c.question}</strong><p>{c.answer}</p></li>)}</ol></div><div className="study-actions"><button type="button" disabled={busy} className="primary" onClick={() => void run(() => setData(data => {if(editing&&JSON.stringify(data.flashcardDecks.find(d=>d.id===editing.id))!==JSON.stringify(editing))throw new Error('This deck changed elsewhere. Reopen it before saving.');return {...data,flashcardDecks:editing?data.flashcardDecks.map(d=>d.id===preview.id?preview:d):[...data.flashcardDecks,preview]}}), () => { setPreview(null); setEditing(null); setOpen(false); setTitle(''); setText(''); setMessage('Flashcards saved. Choose Quiz me to practice.') })}>Save flashcards</button><button type="button" disabled={busy} className="secondary" onClick={() => setPreview(null)}>Back to edit</button></div></div>}
    {session && <div className="flashcard-practice" aria-live="polite">{!deck ? <p>This deck is no longer available.</p> : session.index >= session.ids.length ? <><h4>Round finished</h4><p>{deck.cards.filter(c => c.needsReview).length} cards still marked for review.</p><button type="button" className="primary" disabled={!deck.cards.some(c => c.needsReview)} onClick={() => startQuiz(deck, true)}>Repeat missed cards</button></> : card ? <><p>{deck.title} · Card {session.index + 1} of {session.ids.length}</p><h4>{card.question}</h4>{!revealed ? <button type="button" className="primary" onClick={() => setRevealed(true)}>Show answer</button> : <><p className="flashcard-answer">{card.answer}</p><div className="study-actions"><button type="button" className="primary" disabled={busy} onClick={() => grade(false)}>Got it</button><button type="button" className="secondary" disabled={busy} onClick={() => grade(true)}>Review again</button></div></>}</> : <p>This card was removed. Start a new round.</p>}<button type="button" className="secondary" disabled={busy} onClick={() => setSession(null)}>Close quiz</button></div>}
    <div className="flashcard-decks">{decks.map(d => <article key={d.id}><div><h4>{d.title}</h4><p>{d.cards.length} cards · {d.cards.filter(c => c.needsReview).length} to review</p></div><div className="study-actions"><button type="button" className="primary" disabled={busy} onClick={() => startQuiz(d)}>Quiz me</button><button type="button" disabled={busy} onClick={()=>{setEditing(d);setTitle(d.title);setText(d.cards.map(c=>c.question+' :: '+c.answer).join('\n'));setOpen(true);setPreview(null);setSession(null)}}>Edit cards</button><button type="button" disabled={busy} onClick={()=>void run(()=>setData(data=>({...data,flashcardDecks:[...data.flashcardDecks,{...d,id:uid('deck'),title:d.title+' (copy)',cards:d.cards.map(c=>({...c,id:uid('card'),needsReview:true}))}]})),()=>setMessage('Deck duplicated.'))}>Duplicate</button><button type="button" className="secondary" disabled={busy} onClick={() => { setDeleting(d.id) }}>Delete deck</button></div></article>)}</div>
  </section>
}
