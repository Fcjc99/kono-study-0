import type { AppData, StudyPlan, Task } from './model'

const DAY = 86_400_000
export const studyUnits = ['chapter', 'page', 'problem', 'step'] as const
export const studyTemplates = {
  essay: ['Read the instructions and choose a topic', 'Research and collect sources', 'Create an outline', 'Write the first draft', 'Revise the argument and structure', 'Proofread and submit'],
  exam: ['List the topics to review', 'Review the first half of the topics', 'Review the remaining topics', 'Practice questions', 'Review mistakes', 'Final review'],
}

/** Calendar arithmetic: UTC is only a date counter, never an elapsed local day. */
export function dateNumber(value: string): number {
  const n = Date.parse(`${value}T12:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(n) || new Date(n).toISOString().slice(0, 10) !== value) throw new Error('Enter a valid calendar date.')
  return Math.floor(n / DAY)
}
export function addDays(value: string, days: number): string {
  return new Date((dateNumber(value) + days) * DAY).toISOString().slice(0, 10)
}
export function dateInZone(timeZone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const part = (type: string) => parts.find(p => p.type === type)!.value
  return `${part('year')}-${part('month')}-${part('day')}`
}
export const defaultStudyZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

export function studyDates(start: string, end: string, weekdays: number[]): string[] {
  const first = dateNumber(start), last = dateNumber(end)
  if (last < first) throw new Error('The deadline must be on or after the start date.')
  if (last - first > 730) throw new Error('Choose a date range of two years or less.')
  if (!weekdays.length || weekdays.some(n => !Number.isInteger(n) || n < 0 || n > 6) || new Set(weekdays).size !== weekdays.length) throw new Error('Choose at least one study day.')
  const dates: string[] = []
  for (let day = first; day <= last; day++) {
    const d = new Date(day * DAY)
    if (weekdays.includes(d.getUTCDay())) dates.push(d.toISOString().slice(0, 10))
  }
  if (!dates.length) throw new Error('There are no selected study days in this date range.')
  return dates
}

/** Fixed baseline; missed work is carried on display, never copied or re-generated. */
export function distributeUnits(total: number, dates: string[]): { date: string; count: number; first: number; last: number }[] {
  if (!Number.isInteger(total) || total < 1 || total > 1000) throw new Error('Enter a whole number from 1 to 1,000.')
  if (!dates.length) throw new Error('Choose at least one study day.')
  const base = Math.floor(total / dates.length), extra = total % dates.length
  let next = 1
  return dates.map((date, i) => {
    const count = base + (i < extra ? 1 : 0), first = next
    next += count
    return { date, count, first, last: next - 1 }
  })
}

export function buildStudyTasks(plan: StudyPlan, id: () => string, steps?: string[]): Task[] {
  const allocations = distributeUnits(plan.total, studyDates(plan.start, plan.end, plan.weekdays))
  if (steps && (steps.length !== plan.total || steps.some(s => !s.trim() || s.length > 500))) throw new Error('Enter one short, non-empty step per line.')
  return allocations.flatMap(a => Array.from({ length: a.count }, (_, offset) => {
    const unitNumber = a.first + offset
    const detail = steps?.[unitNumber - 1] ?? `${plan.unit[0].toUpperCase()}${plan.unit.slice(1)} ${unitNumber}`
    return { id: id(), profileId: plan.profileId, subjectId: plan.subjectId, title: `${plan.title} · ${detail}`, due: a.date, done: false, notes: '', studyPlanId: plan.id, unitNumber }
  }))
}

export function carryDate(plan: StudyPlan, now = new Date()): string {
  const today = dateInZone(plan.timeZone, now)
  // Once overdue, show the backlog today even on a day normally kept free.
  if (today > plan.end) return today
  let next = today
  for (let i = 0; i < 7; i++, next = addDays(next, 1)) {
    if (next > plan.end) return today
    if (plan.weekdays.includes(new Date(`${next}T12:00:00Z`).getUTCDay())) return next
  }
  return today
}

export function calendarTask(task: Task, plan?: StudyPlan, now = new Date()): Task {
  if (!plan) return task
  if (task.done) {
    const stamp = task.completedAt && new Date(task.completedAt)
    return stamp && Number.isFinite(stamp.getTime()) ? { ...task, due: dateInZone(plan.timeZone, stamp) } : task
  }
  const next = carryDate(plan, now)
  return task.due < next ? { ...task, due: next } : task
}

export function calendarTasks(tasks: Task[], plans: StudyPlan[], now = new Date()): Task[] {
  const byId = new Map(plans.map(p => [p.id, { plan: p, next: carryDate(p, now) }]))
  return tasks.map(t => {
    const entry = t.studyPlanId ? byId.get(t.studyPlanId) : undefined
    if (!entry) return t
    if (t.done) return calendarTask(t, entry.plan, now)
    return t.due < entry.next ? { ...t, due: entry.next } : t
  })
}

export function taskToday(task: Task, plans: StudyPlan[], localToday: string, now = new Date()): string {
  const plan = plans.find(p => p.id === task.studyPlanId)
  return plan ? dateInZone(plan.timeZone, now) : localToday
}

export function compareStudyTasks(a: Task, b: Task): number {
  return a.due.localeCompare(b.due) || (a.studyPlanId && a.studyPlanId === b.studyPlanId ? a.unitNumber! - b.unitNumber! : (a.studyPlanId ?? a.id).localeCompare(b.studyPlanId ?? b.id))
}

export function rescheduleStudyPlan(data: AppData, planId: string, end: string, now = new Date()): AppData {
  const plan = data.studyPlans.find(p => p.id === planId && p.profileId === data.activeProfileId)
  if (!plan) throw new Error('This study plan is no longer available. Reopen the planner.')
  const start = dateInZone(plan.timeZone, now)
  const pending = data.tasks.filter(t => t.studyPlanId === planId && !t.done).sort((a, b) => a.unitNumber! - b.unitNumber!)
  if (!pending.length) return data
  const dates = distributeUnits(pending.length, studyDates(start, end, plan.weekdays)).flatMap(a => Array<string>(a.count).fill(a.date))
  const dueById = new Map(pending.map((t, i) => [t.id, dates[i]]))
  return { ...data, studyPlans: data.studyPlans.map(p => p.id === planId ? { ...p, start, end } : p), tasks: data.tasks.map(t => dueById.has(t.id) ? { ...t, due: dueById.get(t.id)! } : t) }
}

export function cancelStudyPlan(data: AppData, planId: string): AppData {
  const plan = data.studyPlans.find(p => p.id === planId && p.profileId === data.activeProfileId)
  if (!plan) return data
  return {
    ...data,
    studyPlans: data.studyPlans.filter(p => p.id !== planId),
    tasks: data.tasks.filter(t => t.studyPlanId !== planId || t.done).map(t => {
      if (t.studyPlanId !== planId) return t
      const completed = calendarTask(t, plan)
      const { studyPlanId: _plan, unitNumber: _unit, ...kept } = completed
      void _plan; void _unit
      return kept
    }),
  }
}

export function unitRange(numbers: number[], unit: StudyPlan['unit']): string {
  const sorted = [...numbers].sort((a, b) => a - b), ranges: string[] = []
  for (let i = 0; i < sorted.length; i++) {
    const first = sorted[i]
    while (i + 1 < sorted.length && sorted[i + 1] === sorted[i] + 1) i++
    ranges.push(first === sorted[i] ? String(first) : `${first}–${sorted[i]}`)
  }
  return `${unit[0].toUpperCase()}${unit.slice(1)}${numbers.length === 1 ? '' : 's'} ${ranges.join(', ')}`
}
