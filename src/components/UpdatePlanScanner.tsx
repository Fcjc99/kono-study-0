import { useState } from 'react'
import { localDate, type AppData } from '../store/model'
import { readAssignmentPhoto, applyAssignmentPhoto } from '../store/assignmentPhoto'
import { useLocalSetting } from '../hooks/useLocalSetting'

export default function UpdatePlanScanner({ profileId, save, close }: { profileId: string; save: (fn: (d: AppData) => AppData) => Promise<boolean>; close: () => void }) {
  // Shares K-Quiz's exact provider/key storage (same localStorage keys) -- it is the same browser-side
  // AI call either way, so setting it up once in either place works in both.
  const [provider, setProvider] = useLocalSetting('kono-kquiz:' + profileId + ':provider', 'gemini')
  const [apiKey, setApiKey] = useLocalSetting('kono-kquiz:' + profileId + ':key', '')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  const scan = async () => {
    if (!file || busy) return
    if (file.size > 8_000_000) { setError('Choose a photo under 8 MB.'); return }
    if (!apiKey.trim()) { setError('Add an AI API key below first.'); return }
    setBusy(true); setError(''); setStatus('Reading your notes…')
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
        reader.onerror = () => reject(new Error('Could not read that photo.'))
        reader.readAsDataURL(file)
      })
      const today = localDate()
      const items = await readAssignmentPhoto({ base64, mimeType: file.type || 'image/jpeg' }, provider === 'openai' ? 'openai' : 'gemini', apiKey, today)
      let added = 0
      const saved = await save(d => { const result = applyAssignmentPhoto(d, profileId, items, today); added = result.added; return result.data })
      if (saved) { setStatus(`${added} item${added === 1 ? '' : 's'} added to your plan — check the ones marked in red.`); setFile(null) }
      else setError('Not saved yet. Check the save status and try again.')
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not read that photo.') }
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
  </div>
}
