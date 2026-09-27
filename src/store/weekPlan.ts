import { dayNames, normalizeData, uid, type AppData, type CalendarEvent } from './model'
import { classOccurrences } from './classSchedule'
import { addDays } from './studyScheduler'
import { aiFail, aiReady, callAi, needsAiMessage, type AiProvider } from './aiProvider'

/** "Plan my week": study sessions for what's due soon, fitted into the free time around classes and
 * events. The AI proposes the plan; every session is checked against the free time before it's shown,
 * and KONO plans it on its own (soonest due first) when the AI isn't available. Nothing is saved until
 * the person reviews the list and adds it. */

export type WeekWork = { ref: string; kind: 'task' | 'exam'; title: string; subjectId: string; subject?: string; due: string; minutes: number }
export type FreeSlot = { date: string; start: string; end: string }
export type WeekSession = { id: string; ref: string; date: string; start: string; end: string; title: string; include: boolean }
export type WeekPlanOptions = { weekday: { from: string; to: string }; weekend: { from: string; to: string }; maxPerDay: number }
export const defaultWeekPlanOptions: WeekPlanOptions = { weekday: { from: '15:30', to: '21:30' }, weekend: { from: '10:00', to: '20:00' }, maxPerDay: 150 }

export const PLAN_DAYS = 7
const EXAM_MINUTES = 180, TASK_MINUTES = 45, BUFFER = 10, MIN_SESSION = 20, MAX_SESSION = 90

export const toMinutes = (clock: string) => { const [h, m] = clock.split(':').map(Number); return h * 60 + m }
export const toClock = (minutes: number) => String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0')
const weekdayOf = (date: string) => new Date(date + 'T12:00:00').getDay()
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/** Future sessions already planned for each item, in minutes, so planning again only fills the rest. */
function plannedMinutes(data: AppData, today: string) {
  const out = new Map<string, number>()
  for (const e of data.calendarEvents) if (e.profileId === data.activeProfileId && e.planFor && e.date >= today && e.time && e.endTime) out.set(e.planFor, (out.get(e.planFor) ?? 0) + Math.max(0, toMinutes(e.endTime) - toMinutes(e.time)))
  return out
}

/** Unfinished assignments and exams due in the planned week (and the two days after it, so early starts
 * are possible), minus the time already planned for them. An assignment with its own start time is
 * already scheduled and is left alone. */
export function weekWork(data: AppData, today: string): WeekWork[] {
  const profileId = data.activeProfileId, last = addDays(today, PLAN_DAYS + 1), planned = plannedMinutes(data, today)
  const subject = (id: string) => data.subjects.find(s => s.id === id && s.profileId === profileId)?.name
  const work: WeekWork[] = [
    ...data.tasks.filter(t => t.profileId === profileId && !t.done && !t.plannedTime && t.due >= today && t.due <= last)
      .map(t => ({ ref: 'task:' + t.id, kind: 'task' as const, title: t.title, subjectId: t.subjectId, subject: subject(t.subjectId), due: t.due, minutes: clamp(t.estimatedMinutes ?? TASK_MINUTES, 15, 240) })),
    ...data.exams.filter(e => e.profileId === profileId && !e.done && e.due > today && e.due <= last)
      .map(e => ({ ref: 'exam:' + e.id, kind: 'exam' as const, title: e.title, subjectId: e.subjectId, subject: subject(e.subjectId), due: e.due, minutes: EXAM_MINUTES })),
  ]
  return work.map(w => ({ ...w, minutes: w.minutes - (planned.get(w.ref) ?? 0) })).filter(w => w.minutes >= 15)
    .sort((a, b) => a.due.localeCompare(b.due) || (a.kind === b.kind ? 0 : a.kind === 'exam' ? -1 : 1))
}

/** Times already taken on a date: classes (not breaks or skipped days), timed events, and assignments
 * with a start time. */
export function busyTimes(data: AppData, date: string): [number, number][] {
  const profileId = data.activeProfileId, busy: [number, number][] = []
  for (const c of classOccurrences(data, date)) {
    const start = c.displayStart ?? c.block.start, end = c.displayEnd ?? c.block.end
    if (c.timePending || c.block.kind === 'break' || c.block.skippedDates?.includes(date) || !start || !end) continue
    busy.push([toMinutes(start), toMinutes(end)])
  }
  for (const e of data.calendarEvents) if (e.profileId === profileId && e.date === date && e.time) busy.push([toMinutes(e.time), e.endTime && e.endTime > e.time ? toMinutes(e.endTime) : toMinutes(e.time) + 60])
  for (const t of data.tasks) if (t.profileId === profileId && t.due === date && t.plannedTime && !t.done) busy.push([toMinutes(t.plannedTime), toMinutes(t.plannedTime) + (t.estimatedMinutes ?? 30)])
  return busy
}

/** Free study time on each of the next days: the study window for that day minus busy times (with a
 * 10-minute cushion), keeping gaps of at least 20 minutes. Today starts from the next quarter hour. */
export function freeSlots(data: AppData, today: string, nowClock: string, options: WeekPlanOptions = defaultWeekPlanOptions): FreeSlot[] {
  const slots: FreeSlot[] = []
  for (let i = 0; i < PLAN_DAYS; i++) {
    const date = addDays(today, i), weekend = [0, 6].includes(weekdayOf(date)), window = weekend ? options.weekend : options.weekday
    let from = toMinutes(window.from)
    const to = toMinutes(window.to)
    if (i === 0) from = Math.max(from, Math.ceil((toMinutes(nowClock) + 5) / 15) * 15)
    const busy = busyTimes(data, date).map(([s, e]) => [s - BUFFER, e + BUFFER]).sort((a, b) => a[0] - b[0])
    let cursor = from
    for (const [s, e] of [...busy, [to, to]]) {
      const end = Math.min(s, to)
      if (end - cursor >= MIN_SESSION) slots.push({ date, start: toClock(cursor), end: toClock(end) })
      cursor = Math.max(cursor, e)
      if (cursor >= to) break
    }
  }
  return slots
}

const sessionTitle = (w: WeekWork, focus?: string) => (focus ? focus : w.kind === 'exam' ? 'Review for ' + w.title : 'Work on ' + w.title).slice(0, 200)

/** Keeps sessions that fit: known item, inside one free slot, before it's due (an exam: by the day
 * before), no overlaps, and within the daily limit. Used for the AI's plan and KONO's own. */
function fitSessions(candidates: { ref: string; date: string; start: string; minutes: number; focus?: string }[], work: WeekWork[], slots: FreeSlot[], maxPerDay: number): WeekSession[] {
  const byRef = new Map(work.map(w => [w.ref, w])), taken: WeekSession[] = [], perDay = new Map<string, number>(), perItem = new Map<string, number>()
  for (const c of candidates) {
    const w = byRef.get(c.ref)
    if (!w || !/^\d{4}-\d{2}-\d{2}$/.test(c.date) || !/^\d{2}:\d{2}$/.test(c.start)) continue
    const minutes = Math.round(clamp(c.minutes, 15, MAX_SESSION)), start = toMinutes(c.start), end = start + minutes
    if (w.kind === 'exam' ? c.date >= w.due : c.date > w.due) continue
    if (!slots.some(s => s.date === c.date && toMinutes(s.start) <= start && end <= toMinutes(s.end))) continue
    if (taken.some(t => t.date === c.date && start < toMinutes(t.end) + BUFFER && toMinutes(t.start) < end + BUFFER)) continue
    if ((perDay.get(c.date) ?? 0) + minutes > maxPerDay) continue
    if ((perItem.get(w.ref) ?? 0) >= w.minutes + 30) continue
    taken.push({ id: uid('session'), ref: w.ref, date: c.date, start: toClock(start), end: toClock(end), title: sessionTitle(w, c.focus), include: true })
    perDay.set(c.date, (perDay.get(c.date) ?? 0) + minutes); perItem.set(w.ref, (perItem.get(w.ref) ?? 0) + minutes)
  }
  return taken.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))
}

/** KONO's own plan: soonest due first, sessions of up to 50 minutes, an exam's review spread over
 * different days, never past the due date or the daily limit. */
export function planWeekSimple(work: WeekWork[], slots: FreeSlot[], maxPerDay: number): WeekSession[] {
  const free = slots.map(s => ({ date: s.date, start: toMinutes(s.start), end: toMinutes(s.end) }))
  const used = new Map<string, number>(), candidates: { ref: string; date: string; start: string; minutes: number }[] = []
  for (const w of work) {
    let left = w.minutes
    const days = new Set<string>()
    for (const slot of free) {
      if (left < 15) break
      if (w.kind === 'exam' ? slot.date >= w.due || days.has(slot.date) : slot.date > w.due) continue
      const room = Math.min(slot.end - slot.start, maxPerDay - (used.get(slot.date) ?? 0))
      const minutes = Math.min(left, 50, room)
      if (minutes < MIN_SESSION && !(minutes >= 15 && minutes === left)) continue
      candidates.push({ ref: w.ref, date: slot.date, start: toClock(slot.start), minutes })
      slot.start += minutes + BUFFER; left -= minutes; days.add(slot.date)
      used.set(slot.date, (used.get(slot.date) ?? 0) + minutes)
    }
  }
  return fitSessions(candidates, work, slots, maxPerDay)
}

export function weekPlanPrompt(work: WeekWork[], slots: FreeSlot[], maxPerDay: number, today: string): string {
  const items = work.map(w => ({ ref: w.ref, type: w.kind === 'exam' ? 'exam or test' : 'assignment', title: w.title, subject: w.subject ?? null, due: w.due, minutesNeeded: w.minutes }))
  const free = slots.map(s => ({ date: s.date, weekday: dayNames[weekdayOf(s.date)], start: s.start, end: s.end }))
  return `You are a friendly study coach planning a student's week. Today is ${today}.\n` +
    `Schedule study sessions for the work below, using ONLY the free times listed (each session must start and end inside one free time).\n` +
    `Rules: sessions are 25-90 minutes with at least 10 minutes between sessions; at most ${maxPerDay} minutes of study on any day; ` +
    `an assignment's sessions must be on or before its due date; an exam's review must be before its date, spread across several days, with a short final review the day before; ` +
    `plan the soonest-due and biggest work first; split big work into steps. Give each session a short, specific focus (max 60 characters) like "Outline the essay", "Practice problems, ch. 4" or "Review flashcards: cell biology". ` +
    `If something doesn't fit, leave it out rather than breaking a rule.\n` +
    `Respond with a single JSON object: {"sessions": array of {"ref": string (from the work list), "date": "YYYY-MM-DD", "start": "HH:MM" 24-hour, "minutes": number, "focus": string}}. Output ONLY the JSON object, no other text.\n\n` +
    `Work: ${JSON.stringify(items)}\nFree times: ${JSON.stringify(free)}`
}

export function parseWeekPlan(raw: string, work: WeekWork[], slots: FreeSlot[], maxPerDay: number): WeekSession[] {
  let obj: unknown
  try { obj = JSON.parse(raw) } catch { aiFail('The AI response was not valid JSON. Try again.') }
  const list = obj && typeof obj === 'object' ? (obj as Record<string, unknown>).sessions : undefined
  if (!Array.isArray(list)) aiFail('The AI response was not in the expected format. Try again.')
  const candidates = (list as unknown[]).slice(0, 80).flatMap(item => {
    if (!item || typeof item !== 'object') return []
    const s = item as Record<string, unknown>
    const focus = typeof s.focus === 'string' ? s.focus.replace(/\s+/g, ' ').trim().slice(0, 80) : undefined
    return typeof s.ref === 'string' && typeof s.date === 'string' && typeof s.start === 'string' && typeof s.minutes === 'number' && Number.isFinite(s.minutes)
      ? [{ ref: s.ref, date: s.date, start: s.start.trim().padStart(5, '0'), minutes: s.minutes, focus: focus || undefined }] : []
  })
  return fitSessions(candidates, work, slots, maxPerDay)
}

export async function planWeekWithAi(work: WeekWork[], slots: FreeSlot[], maxPerDay: number, today: string, provider: AiProvider, apiKey: string): Promise<WeekSession[]> {
  if (!aiReady(apiKey)) aiFail(needsAiMessage)
  return parseWeekPlan(await callAi(weekPlanPrompt(work, slots, maxPerDay, today), provider, apiKey.trim()), work, slots, maxPerDay)
}

/** What's left unplanned after the sessions, for the "couldn't fit" note. */
export function unplanned(work: WeekWork[], sessions: WeekSession[]) {
  return work.map(w => ({ work: w, left: w.minutes - sessions.filter(s => s.ref === w.ref && s.include).reduce((n, s) => n + toMinutes(s.end) - toMinutes(s.start), 0) })).filter(x => x.left >= 15)
}

/** Adds the chosen sessions as timed study events in the Calendar, linked to their assignment or exam. */
export function applyWeekPlan(data: AppData, profileId: string, sessions: WeekSession[], work: WeekWork[]) {
  if (data.activeProfileId !== profileId) throw Error('Your plan changed. Make the week plan again.')
  const byRef = new Map(work.map(w => [w.ref, w])), next = structuredClone(data)
  let added = 0
  for (const s of sessions.filter(s => s.include)) {
    const w = byRef.get(s.ref)
    if (!w || next.calendarEvents.some(e => e.profileId === profileId && e.planFor === s.ref && e.date === s.date && e.time === s.start)) continue
    const event: CalendarEvent = { id: uid('event'), profileId, date: s.date, title: s.title, kind: 'study', subjectId: w.subjectId || undefined, notes: 'For ' + w.title + ' · due ' + w.due, time: s.start, endTime: s.end, planFor: s.ref }
    next.calendarEvents.push(event); added++
  }
  return { data: normalizeData(next), added }
}

/** Upcoming sessions from earlier week plans (not finished), to clear before planning again. */
export const upcomingPlanned = (data: AppData, today: string) => data.calendarEvents.filter(e => e.profileId === data.activeProfileId && e.planFor && !e.done && e.date >= today)
export function clearUpcomingPlanned(data: AppData, today: string): AppData {
  const ids = new Set(upcomingPlanned(data, today).map(e => e.id))
  return { ...data, calendarEvents: data.calendarEvents.filter(e => !ids.has(e.id)) }
}
