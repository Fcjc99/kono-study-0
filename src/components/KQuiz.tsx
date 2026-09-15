import { useEffect, useRef, useState, type FormEvent, type SetStateAction } from 'react'
import { useDraftState } from '../hooks/useDraftState'
import { useLectureRecorder } from '../hooks/useLectureRecorder'
import { uid, type AppData, type KQuizLecture, type KQuizSet, type KQuizSource, type KQuizQuestion, type Subject } from '../store/model'
import type { FlashcardDeck } from '../store/flashcards'
import { generateStudyMaterials, transcribePhoto } from '../store/kquizGenerate'
import { saveRecording, loadRecording, deleteRecording } from '../store/audioStore'
import KQuizGuide from './KQuizGuide'
import './kquiz.css'

const formatDuration = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

function useLocalSetting(key: string, fallback: string): [string, (value: string) => void] {
  const [value, setValue] = useState(() => { try { return localStorage.getItem(key) ?? fallback } catch { return fallback } })
  const update = (next: string) => { setValue(next); try { localStorage.setItem(key, next) } catch { /* best effort; the field still works this session */ } }
  return [value, update]
}

const UNSORTED = '__unsorted__'

export default function KQuiz({ profileId, lectures, sets, sources, decks, subjects, setData }: { profileId: string; lectures: KQuizLecture[]; sets: KQuizSet[]; sources: KQuizSource[]; decks: FlashcardDeck[]; subjects: Subject[]; setData: (action: SetStateAction<AppData>) => Promise<boolean> }) {
  const [provider, setProvider] = useLocalSetting('kono-kquiz:' + profileId + ':provider', 'gemini')
  const [apiKey, setApiKey] = useLocalSetting('kono-kquiz:' + profileId + ':key', '')
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [pendingTitle, setPendingTitle] = useState('')
  // The active folder both filters what's shown below and decides what subject a newly recorded
  // lecture or generated study set files under — recording while browsing "Biology" lands in
  // Biology, the same way saving a file into an open folder does. '' means All, UNSORTED its own bucket.
  const [folder, setFolder] = useState('')
  const folderSubjectId = folder === UNSORTED ? '' : folder
  const [pendingRecording, setPendingRecording] = useState<{ blob: Blob; transcript: string; durationSeconds: number } | null>(null)
  const [noteTitle, setNoteTitle] = useDraftState('kquiz-note-title:' + profileId, ''), [noteText, setNoteText] = useDraftState('kquiz-note-text:' + profileId, '')
  const [generatingFor, setGeneratingFor] = useState<string | null>(null)
  // A lecture or note (once checked) is a source to fold into one combined study set — checking a few
  // pages captured over the semester and generating once at midterms, rather than one study set per
  // scan. IDs are unique across both collections (see uid()), so one set is enough to track either.
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [combineTitle, setCombineTitle] = useState('')
  const [guideTab, setGuideTab] = useState<Record<string, 'summary' | 'guide'>>({})
  const [test, setTest] = useState<{ setId: string; index: number; picked: number | null; revealed: boolean; score: number } | null>(null)
  const [flashSession, setFlashSession] = useState<{ deckId: string; index: number; revealed: boolean } | null>(null)
  const [playing, setPlaying] = useState<{ id: string; url: string } | null>(null)
  const recorder = useLectureRecorder()
  const saving = useRef(false)
  const photoInputRef = useRef<HTMLInputElement | null>(null)
  const messageRef = useRef<HTMLParagraphElement | null>(null)
  const run = async (action: () => Promise<boolean>, success: () => void) => {
    if (saving.current) return
    saving.current = true; setBusy(true); setMessage('')
    try { if (await action()) success(); else setMessage('Not saved yet. Check the save status and try again.') }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save.') }
    finally { saving.current = false; setBusy(false) }
  }
  const needsApiKey = () => {
    if (apiKey.trim()) return false
    setMessage('Add an API key in K-Quiz settings first.'); setSettingsOpen(true)
    return true
  }

  useEffect(() => () => { if (playing) URL.revokeObjectURL(playing.url) }, [playing])
  // A status message can land far from whatever the person just tapped (the photo scanner and
  // notes form are both well below the fold on a long page) — without this, a rejected action can
  // look like it silently did nothing.
  useEffect(() => { if (message) messageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }, [message])

  const stopRecording = async () => { const result = await recorder.stop(); if (result) { setPendingRecording(result); setPendingTitle('Lecture · ' + new Date().toLocaleDateString()) } }
  const saveLecture = (event: FormEvent) => {
    event.preventDefault()
    if (!pendingRecording) return
    const title = pendingTitle.trim() || 'Untitled lecture'
    const lecture: KQuizLecture = { id: uid('lecture'), profileId, subjectId: folderSubjectId, title, createdAt: new Date().toISOString(), durationSeconds: pendingRecording.durationSeconds, transcript: pendingRecording.transcript }
    void run(async () => { await saveRecording(lecture.id, pendingRecording.blob); return setData(data => ({ ...data, kquizLectures: [...data.kquizLectures, lecture] })) }, () => { setPendingRecording(null); setPendingTitle(''); setMessage('Lecture saved.') })
  }
  const discardRecording = () => { setPendingRecording(null); setPendingTitle('') }

  const deleteLecture = (lecture: KQuizLecture) => {
    void run(async () => { await deleteRecording(lecture.id).catch(() => undefined); return setData(data => ({ ...data, kquizLectures: data.kquizLectures.filter(l => l.id !== lecture.id) })) }, () => setMessage('Lecture removed.'))
  }

  const togglePlay = async (lecture: KQuizLecture) => {
    if (playing?.id === lecture.id) { URL.revokeObjectURL(playing.url); setPlaying(null); return }
    const blob = await loadRecording(lecture.id)
    if (!blob) { setMessage('This recording is no longer on this device.'); return }
    if (playing) URL.revokeObjectURL(playing.url)
    setPlaying({ id: lecture.id, url: URL.createObjectURL(blob) })
  }

  const saveGenerated = async (title: string, materials: Awaited<ReturnType<typeof generateStudyMaterials>>, subjectId?: string) => {
    const deck: FlashcardDeck = { id: uid('deck'), profileId, title, cards: materials.flashcards.map(c => ({ id: uid('card'), question: c.question, answer: c.answer, needsReview: true })) }
    const set: KQuizSet = { id: uid('kqset'), profileId, subjectId: subjectId ?? '', title, createdAt: new Date().toISOString(), summary: materials.summary, studyGuide: materials.studyGuide, flashcardDeckId: deck.id, practiceTest: { questions: materials.questions } }
    return setData(data => ({ ...data, flashcardDecks: [...data.flashcardDecks, deck], kquizSets: [...data.kquizSets, set] }))
  }

  const savePastedNote = (event: FormEvent) => {
    event.preventDefault()
    if (!noteTitle.trim() || !noteText.trim()) { setMessage('Add a title and some notes or a transcript first.'); return }
    const source: KQuizSource = { id: uid('note'), profileId, subjectId: folderSubjectId, title: noteTitle.trim(), createdAt: new Date().toISOString(), text: noteText }
    void run(() => setData(data => ({ ...data, kquizSources: [...data.kquizSources, source] })), () => { setNoteTitle(''); setNoteText(''); setMessage('Note saved.') })
  }

  const scanPhoto = async (file: File) => {
    if (needsApiKey()) return
    if (file.size > 8_000_000) { setMessage('Choose a photo under 8 MB.'); return }
    setGeneratingFor('photo'); setMessage('')
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
        reader.onerror = () => reject(new Error('Could not read that photo.'))
        reader.readAsDataURL(file)
      })
      const text = await transcribePhoto({ base64, mimeType: file.type || 'image/jpeg' }, provider === 'openai' ? 'openai' : 'gemini', apiKey)
      const source: KQuizSource = { id: uid('note'), profileId, subjectId: folderSubjectId, title: 'Scanned notes · ' + new Date().toLocaleDateString(), createdAt: new Date().toISOString(), text }
      const ok = await setData(data => ({ ...data, kquizSources: [...data.kquizSources, source] }))
      setMessage(ok ? 'Photo saved to your notes.' : 'Not saved yet. Check the save status and try again.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not read that photo.') }
    finally { setGeneratingFor(null) }
  }

  const deleteSource = (source: KQuizSource) => {
    void run(() => setData(data => ({ ...data, kquizSources: data.kquizSources.filter(s => s.id !== source.id) })), () => { setChecked(prev => { if (!prev.has(source.id)) return prev; const next = new Set(prev); next.delete(source.id); return next }); setMessage('Note removed.') })
  }

  const toggleChecked = (id: string) => setChecked(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  const checkedLectures = lectures.filter(l => checked.has(l.id) && l.transcript)
  const checkedSources = sources.filter(s => checked.has(s.id))
  const checkedCount = checkedLectures.length + checkedSources.length

  const generateFromChecked = async () => {
    if (needsApiKey()) return
    if (!combineTitle.trim()) { setMessage('Give this study set a title first.'); return }
    setGeneratingFor('combined'); setMessage('')
    try {
      const combined = [...checkedLectures.map(l => `--- ${l.title} ---\n${l.transcript}`), ...checkedSources.map(s => `--- ${s.title} ---\n${s.text}`)].join('\n\n')
      const materials = await generateStudyMaterials(combined, provider === 'openai' ? 'openai' : 'gemini', apiKey)
      const ok = await saveGenerated(combineTitle.trim(), materials, folderSubjectId)
      setMessage(ok ? 'Study set generated.' : 'Not saved yet. Check the save status and try again.')
      if (ok) { setChecked(new Set()); setCombineTitle('') }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not generate study materials.') }
    finally { setGeneratingFor(null) }
  }

  const deleteSet = (set: KQuizSet) => { void run(() => setData(data => ({ ...data, kquizSets: data.kquizSets.filter(s => s.id !== set.id) })), () => { if (test?.setId === set.id) setTest(null); setMessage('Study set removed.') }) }

  const startTest = (set: KQuizSet) => { if (!set.practiceTest?.questions.length) return; setTest({ setId: set.id, index: 0, picked: null, revealed: false, score: 0 }) }
  const testSet = test ? sets.find(s => s.id === test.setId) : null
  const question: KQuizQuestion | undefined = testSet?.practiceTest?.questions[test?.index ?? 0]
  const answerMcq = (choiceIndex: number) => { if (!test || !question || question.type !== 'mcq' || test.revealed) return; setTest({ ...test, picked: choiceIndex, revealed: true, score: test.score + (choiceIndex === question.correctIndex ? 1 : 0) }) }
  const gradeWritten = (gotIt: boolean) => { if (!test) return; setTest({ ...test, score: test.score + (gotIt ? 1 : 0), revealed: false, picked: null, index: test.index + 1 }) }
  const nextQuestion = () => { if (!test) return; setTest({ ...test, index: test.index + 1, revealed: false, picked: null }) }

  const flashDeck = flashSession ? decks.find(d => d.id === flashSession.deckId) : null
  const flashCard = flashDeck?.cards[flashSession?.index ?? 0]

  const visibleLectures = folder === '' ? lectures : lectures.filter(l => l.subjectId === folderSubjectId)
  const visibleSets = folder === '' ? sets : sets.filter(s => s.subjectId === folderSubjectId)
  const visibleSources = folder === '' ? sources : sources.filter(s => s.subjectId === folderSubjectId)

  return <section className="card study-planner kquiz">
    <div className="card-head"><div><span className="eyebrow">K-Quiz</span><h3>Lectures &amp; study sets</h3><p>Record a lecture, paste notes, or scan a photo — they collect in a running list below. Check off whichever ones you want, any time, and generate one summary, study guide, flashcard deck, and practice test from all of them together.</p></div></div>
    {message && <p ref={messageRef} className="study-message" role="status">{message}</p>}

    {subjects.length > 0 && <div className="kquiz-folders" role="tablist" aria-label="Folders">
      <button type="button" role="tab" aria-selected={folder === ''} onClick={() => setFolder('')}>All</button>
      {subjects.map(s => <button type="button" role="tab" key={s.id} aria-selected={folder === s.id} onClick={() => setFolder(s.id)}>{s.name}</button>)}
      <button type="button" role="tab" aria-selected={folder === UNSORTED} onClick={() => setFolder(UNSORTED)}>Unsorted</button>
    </div>}

    <details className="wb-panel kquiz-settings" open={settingsOpen} onToggle={e => setSettingsOpen(e.currentTarget.open)}>
      <summary>AI settings</summary>
      <p className="wb-muted">Generation calls an AI provider directly from your browser using your own key — it's never sent anywhere else. Google's Gemini has a free tier with no credit card (though on the free tier Google may use your input to improve its models); OpenAI requires billing set up at platform.openai.com.</p>
      <label>Provider<select value={provider} onChange={e => setProvider(e.target.value)}><option value="gemini">Google Gemini (free tier available)</option><option value="openai">OpenAI</option></select></label>
      <label>API key<input type="password" autoComplete="off" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Paste your API key" /></label>
    </details>

    <div className="wb-panel kquiz-record">
      <h4>Record a lecture</h4>
      {!recorder.supported && <p className="wb-muted">Recording needs microphone access, which this browser doesn't support here.</p>}
      {recorder.error && <p className="study-message" role="alert">{recorder.error}</p>}
      {!pendingRecording && <div className="study-actions">
        {recorder.state === 'idle' && recorder.supported && <button type="button" className="primary" onClick={() => void recorder.start()}>● Start recording</button>}
        {recorder.state === 'recording' && <><span className="kquiz-timer">{formatDuration(recorder.elapsedSeconds)}</span><button type="button" className="primary" onClick={() => void stopRecording()}>■ Stop</button></>}
        {recorder.state === 'stopping' && <span className="wb-muted">Finishing up…</span>}
      </div>}
      {recorder.state === 'recording' && <p className="kquiz-live-transcript" aria-live="polite">{recorder.transcript} <em>{recorder.interim}</em></p>}
      {pendingRecording && <form className="study-plan-form" onSubmit={saveLecture}><fieldset disabled={busy}>
        <label>Title<input required maxLength={300} value={pendingTitle} onChange={e => setPendingTitle(e.target.value)} /></label>
        <p className="wb-muted">{formatDuration(pendingRecording.durationSeconds)} recorded{pendingRecording.transcript ? ', transcript captured.' : '. No transcript was captured — live transcription may not be supported in this browser.'}</p>
        <div className="study-actions"><button className="primary">Save lecture</button><button type="button" className="secondary" onClick={discardRecording}>Discard</button></div>
      </fieldset></form>}
    </div>

    <div className="wb-panel">
      <h4>Paste notes / a transcript</h4>
      <form className="study-plan-form" onSubmit={savePastedNote}><fieldset disabled={busy}>
        <label>Title<input required maxLength={300} value={noteTitle} onChange={e => setNoteTitle(e.target.value)} placeholder="Chapter 4 — Cell biology" /></label>
        <label>Notes or transcript<textarea required rows={6} maxLength={60000} value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Paste lecture notes, a transcript, or reading material here." /></label>
        <div className="study-actions"><button className="primary">Save note</button></div>
      </fieldset></form>
    </div>

    <div className="wb-panel kquiz-photo">
      <h4>Scan a photo of notes</h4>
      <p className="wb-muted">Take a picture of handwritten or printed notes — a page from your binder, a whiteboard, anything — and K-Quiz reads it into your running notes list below. No typing needed.</p>
      <div className="study-actions">
        <button type="button" className="primary" disabled={busy || generatingFor === 'photo'} onClick={() => photoInputRef.current?.click()}>{generatingFor === 'photo' ? 'Reading photo…' : '📷 Take or upload a photo'}</button>
        {/* No `capture` attribute: that forces mobile browsers straight into the camera app with no
         * way back to the photo library, which is exactly the "doesn't upload, just camera" complaint
         * this fixes — plain file input still offers "Take Photo" as one of its own options. */}
        <input ref={photoInputRef} type="file" accept="image/*" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void scanPhoto(file) }} />
      </div>
    </div>

    {checkedCount > 0 && <div className="wb-panel kquiz-combine">
      <h4>{checkedCount} item{checkedCount === 1 ? '' : 's'} selected</h4>
      <form className="study-plan-form" onSubmit={e => { e.preventDefault(); void generateFromChecked() }}><fieldset disabled={busy || generatingFor === 'combined'}>
        <label>Title for this study set<input required maxLength={300} value={combineTitle} onChange={e => setCombineTitle(e.target.value)} placeholder="Midterm review — Chapters 1-4" /></label>
        <div className="study-actions">
          <button className="primary">{generatingFor === 'combined' ? 'Generating…' : 'Generate study guide'}</button>
          <button type="button" className="secondary" onClick={() => setChecked(new Set())}>Clear selection</button>
        </div>
      </fieldset></form>
    </div>}

    {visibleLectures.length > 0 && <div className="kquiz-lectures">
      <h4>Lectures</h4>
      {visibleLectures.map(lecture => (
        <article key={lecture.id} className="kquiz-lecture">
          <label className="kquiz-checkline"><input type="checkbox" disabled={!lecture.transcript} checked={checked.has(lecture.id)} onChange={() => toggleChecked(lecture.id)} /><div><h5>{lecture.title}</h5><p className="wb-muted">{formatDuration(lecture.durationSeconds)} · {new Date(lecture.createdAt).toLocaleDateString()}{!lecture.transcript && ' · no transcript'}</p></div></label>
          <div className="study-actions">
            <button type="button" onClick={() => void togglePlay(lecture)}>{playing?.id === lecture.id ? 'Stop playback' : 'Play'}</button>
            <button type="button" className="secondary" disabled={busy} onClick={() => deleteLecture(lecture)}>Delete</button>
          </div>
          {playing?.id === lecture.id && <audio controls autoPlay src={playing.url} onEnded={() => setPlaying(null)} />}
        </article>
      ))}
    </div>}

    {visibleSources.length > 0 && <div className="kquiz-lectures">
      <h4>Notes</h4>
      {visibleSources.map(source => (
        <article key={source.id} className="kquiz-lecture">
          <label className="kquiz-checkline"><input type="checkbox" checked={checked.has(source.id)} onChange={() => toggleChecked(source.id)} /><div><h5>{source.title}</h5><p className="wb-muted">{new Date(source.createdAt).toLocaleDateString()} · {source.text.length.toLocaleString()} characters</p></div></label>
          <div className="study-actions"><button type="button" className="secondary" disabled={busy} onClick={() => deleteSource(source)}>Delete</button></div>
        </article>
      ))}
    </div>}

    {visibleSets.length > 0 && <div className="kquiz-sets">
      <h4>Study sets</h4>
      {visibleSets.map(set => {
        const deck = decks.find(d => d.id === set.flashcardDeckId)
        const activeTab = guideTab[set.id] ?? (set.summary ? 'summary' : 'guide')
        return <article key={set.id} className="kquiz-set">
          <div className="kquiz-set-head"><h5>{set.title}</h5><button type="button" className="secondary" disabled={busy} onClick={() => deleteSet(set)}>Delete</button></div>
          <p className="wb-muted">{new Date(set.createdAt).toLocaleDateString()}{deck && ` · ${deck.cards.length} flashcards`}{set.practiceTest && ` · ${set.practiceTest.questions.length} practice questions`}</p>

          {(set.summary || set.studyGuide) && <>
            <div className="kquiz-guide-tabs" role="tablist">
              <button type="button" role="tab" aria-selected={activeTab === 'summary'} disabled={!set.summary} onClick={() => setGuideTab(g => ({ ...g, [set.id]: 'summary' }))}>Summary</button>
              <button type="button" role="tab" aria-selected={activeTab === 'guide'} disabled={!set.studyGuide} onClick={() => setGuideTab(g => ({ ...g, [set.id]: 'guide' }))}>Study guide</button>
            </div>
            <div className="kquiz-guide-panel">
              <KQuizGuide text={(activeTab === 'summary' ? set.summary : set.studyGuide) ?? ''} />
              <p className="kquiz-ai-note">This study guide was generated by AI and may contain mistakes — check it against the original material.</p>
            </div>
          </>}

          <div className="kquiz-material-list">
            <p className="kquiz-material-label">Study this material</p>
            {deck && <button type="button" className="kquiz-material-row" onClick={() => setFlashSession({ deckId: deck.id, index: 0, revealed: false })}><span>🗂️ Flashcards</span><span className="wb-muted">{deck.cards.length} cards ›</span></button>}
            {set.practiceTest && <button type="button" className="kquiz-material-row" onClick={() => startTest(set)}><span>📝 Practice questions</span><span className="wb-muted">{set.practiceTest.questions.length} questions ›</span></button>}
          </div>
        </article>
      })}
    </div>}

    {test && testSet && <div className="kquiz-test" role="dialog" aria-label="Practice test"><div className="kquiz-test-card">
      <p className="wb-muted">{testSet.title}</p>
      {!question ? <><h4>Test finished</h4><p>{test.score} of {testSet.practiceTest?.questions.length} correct.</p></> : <>
        <span className="kquiz-test-count">{test.index + 1}/{testSet.practiceTest?.questions.length}</span>
        <h4>{question.prompt}</h4>
        {question.type === 'mcq' ? <div className="kquiz-choices">
          {question.choices.map((choice, i) => <button type="button" key={i} aria-disabled={test.revealed} className={'kquiz-choice' + (test.revealed && i === question.correctIndex ? ' is-correct' : test.revealed && i === test.picked ? ' is-wrong' : '')} onClick={() => answerMcq(i)}>{test.revealed && i === question.correctIndex ? '✓ ' : test.revealed && i === test.picked ? '✗ ' : ''}{choice}</button>)}
          {test.revealed && <button type="button" className="primary" onClick={nextQuestion}>Next</button>}
        </div> : <>
          <textarea rows={4} placeholder="Type your answer, then check it against the model answer." disabled={test.revealed} />
          {!test.revealed ? <button type="button" className="primary" onClick={() => setTest({ ...test, revealed: true })}>Show model answer</button> : <><p className="kquiz-text"><strong>Model answer:</strong> {question.answer}</p><div className="study-actions"><button type="button" className="primary" onClick={() => gradeWritten(true)}>Got it</button><button type="button" className="secondary" onClick={() => gradeWritten(false)}>Review again</button></div></>}
        </>}
      </>}
      <button type="button" className="secondary" onClick={() => setTest(null)}>Close test</button>
    </div></div>}

    {flashSession && flashDeck && <div className="kquiz-test" role="dialog" aria-label="Flashcards"><div className="kquiz-test-card">
      <p className="wb-muted">{flashDeck.title}</p>
      {flashCard ? <>
        <span className="kquiz-test-count">{flashSession.index + 1}/{flashDeck.cards.length}</span>
        <h4>{flashCard.question}</h4>
        {flashSession.revealed && <p className="kquiz-text">{flashCard.answer}</p>}
        <div className="study-actions">
          {!flashSession.revealed ? <button type="button" className="primary" onClick={() => setFlashSession(s => s && { ...s, revealed: true })}>Show answer</button>
            : <button type="button" className="primary" onClick={() => setFlashSession(s => s && { ...s, index: s.index + 1, revealed: false })}>Next</button>}
        </div>
      </> : <><h4>Round finished</h4><p>You've gone through all {flashDeck.cards.length} cards.</p></>}
      <button type="button" className="secondary" onClick={() => setFlashSession(null)}>Close</button>
    </div></div>}
  </section>
}
