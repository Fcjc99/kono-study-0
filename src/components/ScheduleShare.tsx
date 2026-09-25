import { useState } from 'react'
import type { AppData } from '../store/model'
import type { PlannerRepository } from '../store/repository'
import { exportScheduleShare, importScheduleShare, previewScheduleShare } from '../store/scheduleShare'

export default function ScheduleShare({ data, save }: { data: AppData; save: PlannerRepository['update'] }) {
 const seasons = data.studySeasons.filter(s => s.profileId === data.activeProfileId)
 const [seasonId, setSeasonId] = useState(seasons[0]?.id ?? '')
 const [includeWork, setIncludeWork] = useState(false)
 const [file, setFile] = useState<File | null>(null)
 const [raw, setRaw] = useState('')
 const [preview, setPreview] = useState<ReturnType<typeof previewScheduleShare> | null>(null)
 const [busy, setBusy] = useState(false)
 const [message, setMessage] = useState('')
 const [error, setError] = useState('')
 const download = () => {
  setError('')
  try {
   const share = exportScheduleShare(data, seasonId, { includeWork })
   const blob = new Blob([JSON.stringify(share)], { type: 'application/json' })
   const url = URL.createObjectURL(blob)
   const a = document.createElement('a')
   a.href = url
   a.download = (share.season.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'schedule') + '.kono-schedule.json'
   a.click()
   URL.revokeObjectURL(url)
   setMessage('Downloaded. Send this small file to the other person — they use "Load a shared schedule" below to add it.')
  } catch (e) { setError(e instanceof Error ? e.message : 'Could not export this schedule.') }
 }
 const review = (text: string) => {
  setError(''); setMessage('')
  try { setPreview(previewScheduleShare(text)); setRaw(text) } catch (e) { setPreview(null); setError(e instanceof Error ? e.message : 'Invalid schedule file.') }
 }
 const commit = async () => {
  if (busy || !preview) return
  setBusy(true); setError('')
  try {
   const saved = await save(d => importScheduleShare(d, d.activeProfileId, raw))
   if (saved) { setPreview(null); setRaw(''); setFile(null); setMessage('Added as a new, paused schedule. Find it under Work & weekly activities › Your weekly schedules (or the school/college setup) to review it and turn it on.') }
   else setError('Not saved yet. Check the save status above, then try again.')
  } catch (e) { setError(e instanceof Error ? e.message : 'Could not import.') }
  finally { setBusy(false) }
 }
 return <section className="wb-panel schedule-share">
  <div className="wb-section-head"><div><h2>Share a schedule</h2><p>Send someone your class schedule as one small file — not your whole account.</p></div></div>
  {!!seasons.length && <div className="schedule-share-export"><label>Which schedule?<select value={seasonId} onChange={e => setSeasonId(e.target.value)}>{seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><button onClick={download}>Download shareable file</button></div>}
  {!!seasons.length && <label className="wb-check"><input type="checkbox" checked={includeWork} onChange={e => setIncludeWork(e.target.checked)} />Also include this schedule's unfinished assignments and exams</label>}
  {!seasons.length && <p className="wb-muted">Set up a schedule above first — then it can be shared here.</p>}
  <div className="schedule-share-import"><h3>Load a shared schedule</h3><p className="wb-muted">Adds a new, separate schedule to your plan. Nothing you already have is changed or removed, and it starts paused so you can review it first.</p><label>Schedule file<input type="file" accept=".json,application/json" onChange={e => { const picked = e.target.files?.[0]; e.target.value = ''; setFile(picked ?? null); setPreview(null); setError(''); if (!picked) return; if (picked.size > 2_000_000) { setError('This file is too large to be a schedule share.'); return } void picked.text().then(review) }} /></label>{file && <p>{file.name}</p>}
  {preview && <div className="recovery-notice"><p><strong>{preview.name}</strong> · {preview.start} – {preview.end}</p><p>{preview.classCount} class block{preview.classCount === 1 ? '' : 's'} · {preview.subjectCount} subject{preview.subjectCount === 1 ? '' : 's'}{(preview.taskCount > 0 || preview.examCount > 0) && <> · {preview.taskCount} assignment{preview.taskCount === 1 ? '' : 's'} · {preview.examCount} exam{preview.examCount === 1 ? '' : 's'}</>}</p><button className="primary" disabled={busy} onClick={() => void commit()}>{busy ? 'Adding…' : 'Add this schedule'}</button><button disabled={busy} onClick={() => { setPreview(null); setFile(null) }}>Cancel</button></div>}
  </div>
  {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
 </section>
}
