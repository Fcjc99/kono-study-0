import { useEffect, useRef, useState, type FormEvent, type SetStateAction } from 'react'
import {completeTask} from '../store/workspace'
import {useDraftState} from '../hooks/useDraftState'
import { uid, type AppData, type StudyPlan, type Subject, type Task } from '../store/model'
import { addDays, buildStudyTasks, calendarTask, cancelStudyPlan, dateInZone, defaultStudyZone, distributeUnits, rescheduleStudyPlan, studyDates, studyTemplates, studyUnits, unitRange } from '../store/studyScheduler'
import VoiceInputButton from './VoiceInputButton'
import './StudyPlanner.css'

type Save = (action: SetStateAction<AppData>) => Promise<boolean>
const labelDate = (value: string) => new Date(`${value}T12:00:00Z`).toLocaleDateString(undefined, { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })
const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function StudyPlanner({ profileId, plans, tasks, subjects, setData, onSelectDate, draftKey='kono-study-draft', initialOpen=false }: {
  initialOpen?:boolean; draftKey?:string; profileId: string; plans: StudyPlan[]; tasks: Task[]; subjects: Subject[]; setData: Save; onSelectDate: (date: string) => void
}) {
  const [open, setOpen] = useState(initialOpen)
  useEffect(()=>{if(initialOpen)document.getElementById('study-planner-heading')?.scrollIntoView({block:'start'})},[initialOpen])
  const [title, setTitle] = useDraftState(draftKey+':title','')
  const [unit, setUnit] = useDraftState<StudyPlan['unit']>(draftKey+':unit','chapter')
  const [total, setTotal] = useDraftState(draftKey+':total','14')
  const [subjectId, setSubjectId] = useDraftState(draftKey+':subject','')
  const [zone] = useState(defaultStudyZone)
  const [start, setStart] = useDraftState(draftKey+':start',() => dateInZone(zone))
  const [end, setEnd] = useDraftState(draftKey+':end',() => addDays(dateInZone(zone), 13))
  const [weekdays, setWeekdays] = useDraftState(draftKey+':days',[0, 1, 2, 3, 4, 5, 6])
  const [steps, setSteps] = useDraftState(draftKey+':steps','')
  const [preview, setPreview] = useState<{ plan: StudyPlan; tasks: Task[] } | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const saving = useRef(false)
  const [cancelId,setCancelId]=useState<string|null>(null)
  const [showCompleted, setShowCompleted] = useState(false)
  const run = async (action: () => Promise<boolean>, success: () => void) => {
    if (saving.current) return
    saving.current = true; setBusy(true); setMessage('')
    try { if (await action()) success(); else setMessage('This change is not saved yet. Keep this page open and use Retry in the save status above.') }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save. Your draft is still here.') }
    finally { saving.current = false; setBusy(false) }
  }
  const review = (event: FormEvent) => {
    event.preventDefault(); setMessage('')
    try {
      if (!title.trim()) throw new Error('Give this assignment a name.')
      const stepList = unit === 'step' ? steps.split('\n').map(s => s.trim()).filter(Boolean) : undefined
      const plan: StudyPlan = { id: uid('study'), profileId, title: title.trim(), subjectId, unit, total: stepList ? stepList.length : Number(total), start, end, weekdays, timeZone: zone }
      if (start < dateInZone(zone)) throw new Error('Start today or later. Already finished some work? Enter only the work you still need to do.')
      setPreview({ plan, tasks: buildStudyTasks(plan, () => uid('task'), stepList) })
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Check the dates and workload.') }
  }
  const savePreview = () => {
    if (!preview) return
    void run(() => setData(data => {
      if (data.activeProfileId !== profileId) throw new Error('Your active profile changed. Reopen the planner.')
      if (data.studyPlans.some(p => p.id === preview.plan.id)) return data
      return { ...data, studyPlans: [...data.studyPlans, preview.plan], tasks: [...data.tasks, ...preview.tasks] }
    }), () => { onSelectDate(preview.plan.start); setOpen(false); setPreview(null); setTitle(''); setMessage('Added to your calendar. Check off each unit as you finish it; missed work carries forward automatically.') })
  }
  const visiblePlans = plans.filter(p => showCompleted || tasks.some(t => t.studyPlanId === p.id && !t.done))

  return <section className="card study-planner" aria-labelledby="study-planner-heading">
    <div className="card-head"><div><span className="eyebrow">A little each day</span><h3 id="study-planner-heading">Break it into days</h3><p>Enter what’s left and when it’s due. Unfinished work joins your next study day.</p></div><button type="button" className="primary" onClick={() => { setOpen(true); setMessage('') }}>＋ Make a study plan</button></div>
    {message && <p className="study-message" role="status">{message}</p>}
    {open && !preview && <form onSubmit={review} className="study-plan-form">
      <fieldset disabled={busy}>
        <div className="study-form-grid">
          <label>Assignment name<input required maxLength={200} value={title} onChange={e => setTitle(e.target.value)} placeholder="Read The Hobbit" /></label>
          <label>Subject<select value={subjectId} onChange={e => setSubjectId(e.target.value)}><option value="">General study</option>{subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label>What are you working through?<select value={unit} onChange={e => setUnit(e.target.value as StudyPlan['unit'])}>{studyUnits.map(u => <option key={u} value={u}>{u === 'step' ? 'Custom steps / assignment template' : `${u[0].toUpperCase()}${u.slice(1)}s`}</option>)}</select></label>
          {unit !== 'step' && <label>How many {unit}s?<input required type="number" min={1} max={1000} step={1} value={total} onChange={e => setTotal(e.target.value)} /></label>}
          <label>Start date<input required type="date" min={dateInZone(zone)} value={start} onChange={e => setStart(e.target.value)} /></label>
          <label>Finish by (including this day)<input required type="date" min={start} value={end} onChange={e => setEnd(e.target.value)} /></label>
        </div>
        {unit === 'step' && <div className="study-steps"><div className="study-actions"><span>Start with a template:</span><button type="button" className="secondary" onClick={() => setSteps(studyTemplates.essay.join('\n'))}>Essay</button><button type="button" className="secondary" onClick={() => setSteps(studyTemplates.exam.join('\n'))}>Exam preparation</button></div><label>Your steps, in order (one per line)<textarea required rows={7} maxLength={20000} value={steps} onChange={e => setSteps(e.target.value)} placeholder={'Choose a topic\nGather sources\nWrite an outline\nWrite a draft\nRevise and submit'} /></label><VoiceInputButton label="a step" onText={text => setSteps(steps.trim() ? steps + '\n' + text : text)} /></div>}
        <div className="study-actions"><span>Quick date range:</span><button type="button" className="secondary" onClick={() => { try { setEnd(addDays(start, 6)) } catch { setMessage('Choose a start date first.') } }}>1 week</button><button type="button" className="secondary" onClick={() => { try { setEnd(addDays(start, 13)) } catch { setMessage('Choose a start date first.') } }}>2 weeks</button></div>
        <fieldset className="study-weekdays"><legend>Study days</legend>{weekdayLabels.map((day, n) => <label key={day}><input type="checkbox" checked={weekdays.includes(n)} onChange={e => setWeekdays(e.target.checked ? [...weekdays, n].sort() : weekdays.filter(d => d !== n))} />{day}</label>)}</fieldset>
        <p className="study-help">Dates use {zone.replaceAll('_', ' ')} on every device. This uses simple scheduling, not AI, and adds no AI fees or paywall.</p>
        <div className="study-actions"><button className="primary">Preview schedule</button><button type="button" className="secondary" onClick={() => setOpen(false)}>Cancel</button></div>
      </fieldset>
    </form>}
    {preview && <div className="study-review" aria-label="Review study schedule">
      <h4>{preview.plan.title}</h4><p>{preview.plan.total} {preview.plan.unit}{preview.plan.total === 1 ? '' : 's'} · {labelDate(preview.plan.start)}–{labelDate(preview.plan.end)}</p>
      <div className="study-preview-scroll"><table><caption>Your original daily schedule</caption><thead><tr><th scope="col">Date</th><th scope="col">Work</th></tr></thead><tbody>{distributeUnits(preview.plan.total, studyDates(preview.plan.start, preview.plan.end, preview.plan.weekdays)).map(row => <tr key={row.date}><th scope="row">{labelDate(row.date)}</th><td>{row.count ? (preview.plan.unit === 'step' ? preview.tasks.filter(t => t.due === row.date).map(t => t.title.slice(preview.plan.title.length + 3)).join('; ') : unitRange(Array.from({ length: row.count }, (_, i) => row.first + i), preview.plan.unit)) : 'Buffer / review day'}</td></tr>)}</tbody></table></div>
      <p>Miss a day? Its unfinished work moves to the next study day alongside that day’s work. Future days keep their original workload. Nothing is marked complete automatically.</p>
      <div className="study-actions"><button type="button" className="primary" disabled={busy} onClick={savePreview}>{busy ? 'Saving…' : 'Add to my calendar'}</button><button type="button" className="secondary" disabled={busy} onClick={() => setPreview(null)}>Back to edit</button></div>
    </div>}
    {!!plans.length && <div className="study-plan-list"><label className="study-completed-toggle"><input type="checkbox" checked={showCompleted} onChange={e => setShowCompleted(e.target.checked)} />Show finished plans</label>{visiblePlans.map(plan => <StudyPlanSummary onRename={title=>run(()=>setData(d=>({...d,studyPlans:d.studyPlans.map(p=>p.id===plan.id?{...p,title}:p)})),()=>setMessage('Plan renamed.'))} onComplete={done=>run(()=>setData(d=>d.tasks.filter(t=>t.studyPlanId===plan.id).reduce((next,t)=>completeTask(next,t.id,done),d)),()=>setMessage(done?'Plan completed.':'Plan reopened; earned progress is kept.'))} key={plan.id} plan={plan} tasks={tasks.filter(t => t.studyPlanId === plan.id)} busy={busy} onSelectDate={onSelectDate} onReschedule={end => run(() => setData(d => rescheduleStudyPlan(d, plan.id, end)), () => setMessage('Remaining work has been spread across the new dates. Completed work is unchanged.'))} onCancel={() => {
      setCancelId(plan.id)
    }} />)}</div>}
    {cancelId&&<div className="wb-notice" role="alert"><p>Cancel this plan? Unfinished work goes to Trash; completed work and earned progress stay.</p><button disabled={busy} onClick={()=>void run(()=>setData(d=>cancelStudyPlan(d,cancelId)),()=>{setCancelId(null);setMessage('Plan canceled. Restore it from Trash if needed.')})}>Confirm cancel plan</button><button disabled={busy} onClick={()=>setCancelId(null)}>Keep plan</button></div>}
    {!open && !plans.length && <p className="study-example">For example: 14 chapters + 2 weeks = 1 chapter a day. Miss one day and the next day has 2.</p>}
  </section>
}

function StudyPlanSummary({ plan, tasks, busy, onSelectDate, onReschedule, onCancel, onRename, onComplete }: {
  onRename:(title:string)=>Promise<void>;onComplete:(done:boolean)=>Promise<void>; plan: StudyPlan; tasks: Task[]; busy: boolean; onSelectDate: (date: string) => void; onReschedule: (end: string) => Promise<void>; onCancel: () => void
}) {
  const [newEnd, setNewEnd] = useState(plan.end),[name,setName]=useState(plan.title)
  const today = dateInZone(plan.timeZone), pending = tasks.filter(t => !t.done), complete = tasks.length - pending.length
  const carried = pending.filter(t => t.due < today).length
  const next = pending.map(t => calendarTask(t, plan).due).sort()[0]
  return <article className="study-plan-summary"><div><h4>{plan.title}</h4><p>{complete} of {plan.total} {plan.unit}{plan.total === 1 ? '' : 's'} finished · Due {labelDate(plan.end)}</p><progress value={complete} max={plan.total} aria-label={`${plan.title} progress`} />{pending.length > 0 && <p className={today > plan.end ? 'study-overdue' : ''}>{today > plan.end ? `Past deadline · ${pending.length} still to finish.` : carried ? `${carried} unfinished ${plan.unit}${carried === 1 ? '' : 's'} carried forward.` : 'On your original schedule.'}</p>}</div><div className="study-actions"><button disabled={busy} onClick={()=>void onComplete(pending.length>0)}>{pending.length?'Complete remaining':'Reopen plan'}</button>{next && <button type="button" className="secondary" onClick={() => onSelectDate(next)}>See next session</button>}<button type="button" className="secondary" disabled={busy} onClick={onCancel}>{pending.length ? 'Cancel plan' : 'Remove plan, keep history'}</button></div><details><summary>Edit plan name</summary><form onSubmit={e=>{e.preventDefault();if(name.trim())void onRename(name.trim())}}><label>Plan name<input required maxLength={200} value={name} onChange={e=>setName(e.target.value)}/></label><button disabled={busy}>Save name</button></form></details>{pending.length > 0 && <details><summary>Change the deadline / spread remaining work again</summary><form onSubmit={e => { e.preventDefault(); void onReschedule(newEnd) }}><label>New deadline<input required type="date" min={today} value={newEnd} onChange={e => setNewEnd(e.target.value)} /></label><p>Spreads only unfinished work from today through this date, using your selected study days. Your completed work stays unchanged.</p><button className="secondary" disabled={busy}>Reschedule remaining work</button></form></details>}</article>
}

export function StudyDaySessions({ plans, tasks, originalTasks, toggle }: { plans: StudyPlan[]; tasks: Task[]; originalTasks: Task[]; toggle: (id: string) => void }) {
  return <div className="study-day-sessions">{plans.map(plan => {
    const items = tasks.filter(t => t.studyPlanId === plan.id).sort((a, b) => a.unitNumber! - b.unitNumber!)
    if (!items.length) return null
    const remaining = items.filter(t => !t.done), today = dateInZone(plan.timeZone)
    const carried = remaining.filter(t => (originalTasks.find(o => o.id === t.id)?.due ?? t.due) < today)
    return <article key={plan.id} className="study-day-session"><div className="study-session-heading"><div><span className="eyebrow">Study session</span><h4>{plan.title}</h4><p>{remaining.length ? unitRange(remaining.map(t => t.unitNumber!), plan.unit) : 'Session complete'}{carried.length ? ` · ${carried.length} carried forward` : ''}</p></div><strong>{remaining.length} {plan.unit}{remaining.length === 1 ? '' : 's'} left</strong></div>{today > plan.end && !!remaining.length && <p className="study-overdue">Past the {labelDate(plan.end)} deadline. Your unfinished work is still here.</p>}<div className="study-unit-list">{items.map(t => <label className={t.done ? 'study-unit done' : 'study-unit'} key={t.id}><input type="checkbox" checked={t.done} onChange={() => toggle(t.id)} /><span>{t.title.slice(plan.title.length + 3)}</span>{t.done && <small>Finished</small>}</label>)}</div></article>
  })}</div>
}
