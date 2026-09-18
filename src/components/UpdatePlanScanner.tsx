import { useState } from 'react'
import { localDate, normalizeData, type AppData, type Subject } from '../store/model'
import { readAssignmentPhoto, applyAssignmentPhoto, type CreatedItem } from '../store/assignmentPhoto'
import { useLocalSetting } from '../hooks/useLocalSetting'

const kindLabels = { tasks: 'Assignment', exams: 'Exam / project', calendarEvents: 'Event' } as const

export default function UpdatePlanScanner({ profileId, subjects, save, close }: { profileId: string; subjects: Subject[]; save: (fn: (d: AppData) => AppData) => Promise<boolean>; close: () => void }) {
  // Shares K-Quiz's exact provider/key storage (same localStorage keys) -- it is the same browser-side
  // AI call either way, so setting it up once in either place works in both.
  const [provider, setProvider] = useLocalSetting('kono-kquiz:' + profileId + ':provider', 'gemini')
  const [apiKey, setApiKey] = useLocalSetting('kono-kquiz:' + profileId + ':key', '')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [createdItems, setCreatedItems] = useState<CreatedItem[]>([])
  // Mirrors ScheduleImport's own receipt/undo: one snapshot of the plan right before this scan's
  // items landed, so a bad read (wrong subject guesses, misread handwriting) can be undone as a whole
  // batch instead of deleting each item by hand.
  const [receipt, setReceipt] = useState<{ before: AppData; after: AppData } | null>(null)

  const scan = async () => {
    if (!file || busy) return
    if (file.size > 8_000_000) { setError('Choose a photo under 8 MB.'); return }
    if (!apiKey.trim()) { setError('Add an AI API key below first.'); return }
    setBusy(true); setError(''); setStatus('Reading your notes…'); setCreatedItems([])
    let before: AppData | undefined, after: AppData | undefined
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
        reader.onerror = () => reject(new Error('Could not read that photo.'))
        reader.readAsDataURL(file)
      })
      const today = localDate()
      const items = await readAssignmentPhoto({ base64, mimeType: file.type || 'image/jpeg' }, provider === 'openai' ? 'openai' : 'gemini', apiKey, today)
      let created: CreatedItem[] = []
      const saved = await save(d => { before = normalizeData(d); const result = applyAssignmentPhoto(d, profileId, items, today); created = result.created; after = result.data; return result.data })
      if (saved && before && after) {
        setReceipt({ before, after })
        setCreatedItems(created)
        setStatus(`${created.length} item${created.length === 1 ? '' : 's'} added to your plan — check each one below.`)
        setFile(null)
      } else setError('Not saved yet. Check the save status and try again.')
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not read that photo.') }
    finally { setBusy(false) }
  }

  // Rows are editable in place (title/date/subject) before confirming, so a wrong AI guess never
  // needs a trip into the full entry editor -- this is the "list of everything" a scan produces.
  const editRow = (id: string, patch: Partial<CreatedItem>) => setCreatedItems(items => items.map(i => i.id === id ? { ...i, ...patch } : i))

  const confirmItem = async (item: CreatedItem) => {
    const ok = await save(d => {
      if (item.key === 'tasks') return { ...d, tasks: d.tasks.map(t => t.id === item.id ? { ...t, title: item.title, due: item.date, subjectId: item.subjectId, needsReview: false } : t) }
      if (item.key === 'exams') return { ...d, exams: d.exams.map(e => e.id === item.id ? { ...e, title: item.title, due: item.date, subjectId: item.subjectId, needsReview: false } : e) }
      return { ...d, calendarEvents: d.calendarEvents.map(e => e.id === item.id ? { ...e, title: item.title, date: item.date, subjectId: item.subjectId, needsReview: false } : e) }
    })
    if (ok) setCreatedItems(items => items.filter(i => i.id !== item.id))
  }

  const removeItem = async (item: CreatedItem) => {
    const ok = await save(d => {
      if (item.key === 'tasks') return { ...d, tasks: d.tasks.filter(t => t.id !== item.id) }
      if (item.key === 'exams') return { ...d, exams: d.exams.filter(e => e.id !== item.id) }
      return { ...d, calendarEvents: d.calendarEvents.filter(e => e.id !== item.id) }
    })
    if (ok) setCreatedItems(items => items.filter(i => i.id !== item.id))
  }

  const undo = async () => {
    if (!receipt || busy) return
    setBusy(true); setError('')
    try {
      const saved = await save(current => {
        if (JSON.stringify(normalizeData(current)) !== JSON.stringify(receipt.after)) throw new Error('Your plan has changed since scanning. Use each item’s own Trash action to avoid losing newer work.')
        return receipt.before
      })
      if (saved) { setReceipt(null); setCreatedItems([]); setStatus('The entire scan was undone.') }
      else setError('Undo was not saved. The scanned items are still there.')
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not undo.') }
    finally { setBusy(false) }
  }

  return <div className="update-plan-scanner">
    <p>Take a photo of handwritten or printed notes listing assignments, due dates, tests, or classes — a to-do list, a torn notebook page, anything. Every item found is added to your plan right away, flagged in red until you open or confirm it.</p>
    <p className="wb-muted">Needs a real AI vision model to read handwriting reliably. Uses the same AI key as K-Quiz — set it up once in either place and it works in both. The photo and key go straight to your chosen provider from this browser; nothing is stored anywhere else.</p>
    <details><summary>AI settings</summary>
      <label>Provider<select value={provider} onChange={e => setProvider(e.target.value)}><option value="gemini">Google Gemini (free tier available)</option><option value="openai">OpenAI</option></select></label>
      <label>API key<input type="password" autoComplete="off" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Paste your API key" /></label>
    </details>
    <label>Choose photo<input type="file" accept="image/*" disabled={busy} onChange={e => { setFile(e.target.files?.[0] ?? null); setError(''); e.target.value = '' }} /></label>
    {file && <p>{file.name}</p>}
    <div className="study-actions">
      <button className="primary" disabled={!file || busy} onClick={() => void scan()}>{busy ? 'Reading…' : 'Scan and add to plan'}</button>
      <button type="button" className="secondary" onClick={close}>Close</button>
    </div>
    {status && <p role="status">{status}</p>}
    {error && <p role="alert">{error}</p>}
    {createdItems.length > 0 && <div className="update-plan-results">
      <h4>Just added — check and fix each one</h4>
      {createdItems.map(item => <div className="update-plan-result-row" key={item.id}>
        <span className="update-plan-result-kind">{kindLabels[item.key]}</span>
        <div className="update-plan-result-fields">
          <label>Title<input value={item.title} maxLength={200} onChange={e => editRow(item.id, { title: e.target.value })} /></label>
          <label>Date<input type="date" value={item.date} onChange={e => editRow(item.id, { date: e.target.value })} /></label>
          <label>Subject<select value={item.subjectId} onChange={e => editRow(item.id, { subjectId: e.target.value })}>
            <option value="">General / unassigned</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select></label>
        </div>
        <div className="study-actions">
          <button type="button" onClick={() => void confirmItem(item)}>Looks good</button>
          <button type="button" className="secondary" onClick={() => void removeItem(item)}>Remove</button>
        </div>
      </div>)}
    </div>}
    {receipt && <button type="button" className="secondary" disabled={busy} onClick={() => void undo()}>Undo this entire scan</button>}
  </div>
}
