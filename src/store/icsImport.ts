import { blankWeek, dayNames, normalizeData, uid, type AppData, type CalendarEventKind, type ScheduleBlock } from './model'

/** Reading a calendar file (.ics) exported from Google Calendar, Apple Calendar or Outlook.
 * Weekly repeating events (classes, practice, shifts) become one weekly schedule; everything else in
 * the next twelve months becomes calendar events. Nothing is saved until the person picks what to add. */

/** `as`: where the item lands. Canvas/Schoology assignments become Planner assignments, quizzes and
 * exams become Exams (under their course), and everything else a Calendar event. */
export type IcsTarget = 'event' | 'assignment' | 'exam'
export type IcsOneTime = { key: string; include: boolean; title: string; date: string; time?: string; endTime?: string; location?: string; as: IcsTarget; course?: string; uid?: string; recurring?: boolean }
export type IcsWeekly = { key: string; include: boolean; title: string; days: number[]; start: string; end: string; from: string; until: string; location?: string; skipped: string[] }
export type IcsImport = { calendarName: string; events: IcsOneTime[]; weekly: IcsWeekly[]; skipped: number }

type Prop = { name: string; params: Record<string, string>; value: string }
type Moment = { date: string; time?: string }

const MAX_EVENTS = 400
const pad = (n: number) => String(n).padStart(2, '0')
const isoDate = (d: Date) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
const dateOf = (iso: string) => new Date(iso + 'T12:00:00')
const addDays = (iso: string, days: number) => { const d = dateOf(iso); d.setDate(d.getDate() + days); return isoDate(d) }
const weekday = (iso: string) => dateOf(iso).getDay()
const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

function unescape(value: string) {
  return value.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1').trim()
}

/** Lines folded onto the next line (CRLF + space) are joined, then each property is split into name, params and value. */
function properties(text: string): Prop[] {
  return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n').flatMap(line => {
    const colon = line.search(/:(?=(?:[^"]*"[^"]*")*[^"]*$)/)
    if (colon < 1) return []
    const [name, ...rawParams] = line.slice(0, colon).split(';')
    const params = Object.fromEntries(rawParams.map(p => { const i = p.indexOf('='); return [p.slice(0, i).toUpperCase(), p.slice(i + 1).replace(/^"|"$/g, '')] }))
    return [{ name: name.toUpperCase(), params, value: line.slice(colon + 1) }]
  })
}

/** 20260915 (all day), 20260915T120000 (wall-clock time, with or without TZID), 20260915T160000Z (UTC → this device's time). */
function moment(prop?: Prop): Moment | null {
  const m = prop?.value.trim().match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/)
  if (!m) return null
  if (!m[4] || prop!.params.VALUE === 'DATE') return { date: `${m[1]}-${m[2]}-${m[3]}` }
  if (m[7]) {
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])))
    return { date: isoDate(d), time: pad(d.getHours()) + ':' + pad(d.getMinutes()) }
  }
  return { date: `${m[1]}-${m[2]}-${m[3]}`, time: `${m[4]}:${m[5]}` }
}

function duration(value?: string) {
  const m = value?.match(/^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?/)
  return m ? ((Number(m[1] ?? 0) * 7 + Number(m[2] ?? 0)) * 24 + Number(m[3] ?? 0)) * 60 + Number(m[4] ?? 0) : 0
}
const minutes = (clock: string) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5))
const clockAfter = (clock: string, mins: number) => { const t = Math.min(minutes(clock) + mins, 23 * 60 + 59); return pad(Math.floor(t / 60)) + ':' + pad(t % 60) }

type Rule = { freq: string; interval: number; until?: string; count?: number; byDay: number[]; byMonthDay: number[] }
function rule(value?: string): Rule | null {
  if (!value) return null
  const parts = Object.fromEntries(value.split(';').map(p => p.split('=')).map(([k, v]) => [k.toUpperCase(), v ?? '']))
  if (!parts.FREQ) return null
  const until = parts.UNTIL ? moment({ name: 'UNTIL', params: {}, value: parts.UNTIL })?.date : undefined
  return {
    freq: parts.FREQ.toUpperCase(), interval: Math.max(1, Number(parts.INTERVAL) || 1), until, count: parts.COUNT ? Number(parts.COUNT) : undefined,
    byDay: (parts.BYDAY ?? '').split(',').map(d => DAY_CODES.indexOf(d.replace(/^[+-]?\d+/, '').toUpperCase())).filter(d => d >= 0),
    byMonthDay: (parts.BYMONTHDAY ?? '').split(',').map(Number).filter(n => n > 0),
  }
}

/** Every date a repeating event happens on, from its first date up to `windowEnd`. */
function occurrences(first: string, r: Rule, windowEnd: string, cap = 800): string[] {
  const out: string[] = [], last = r.until && r.until < windowEnd ? r.until : windowEnd
  const days = r.byDay.length ? r.byDay : [weekday(first)]
  for (let i = 0, d = first; d <= last && out.length < cap && (!r.count || out.length < r.count); i++) {
    if (r.freq === 'DAILY') { out.push(d); d = addDays(d, r.interval); continue }
    if (r.freq === 'WEEKLY') {
      const weekStart = addDays(first, -weekday(first) + i * 7 * r.interval)
      for (const day of [...days].sort()) { const date = addDays(weekStart, day); if (date >= first && date <= last && (!r.count || out.length < r.count)) out.push(date) }
      d = addDays(weekStart, 7 * r.interval); continue
    }
    if (r.freq === 'MONTHLY') {
      const base = dateOf(first); base.setDate(1); base.setMonth(base.getMonth() + i * r.interval)
      for (const day of r.byMonthDay.length ? r.byMonthDay : [dateOf(first).getDate()]) { const x = new Date(base); x.setDate(day); if (x.getMonth() === base.getMonth()) { const date = isoDate(x); if (date >= first && date <= last) out.push(date) } }
      d = isoDate(new Date(base.getFullYear(), base.getMonth() + 1, 1)); continue
    }
    if (r.freq === 'YEARLY') { const x = dateOf(first); x.setFullYear(x.getFullYear() + i * r.interval); d = isoDate(x); if (d <= last) out.push(d); continue }
    break
  }
  return out
}

export function parseIcs(text: string, today: string, months = 12): IcsImport {
  if (!/BEGIN:VCALENDAR/i.test(text)) throw Error('This isn’t a calendar file. Choose the .ics file your calendar app exported.')
  const windowEnd = isoDate(new Date(dateOf(today).getFullYear(), dateOf(today).getMonth() + months, dateOf(today).getDate()))
  const all = properties(text)
  const calendarName = unescape(all.find(p => p.name === 'X-WR-CALNAME')?.value ?? '').slice(0, 120)
  const blocks: Prop[][] = []
  let current: Prop[] | null = null
  for (const p of all) {
    if (p.name === 'BEGIN' && p.value.toUpperCase() === 'VEVENT') current = []
    else if (p.name === 'END' && p.value.toUpperCase() === 'VEVENT') { if (current) blocks.push(current); current = null }
    else if (current && !(p.name === 'BEGIN' || p.name === 'END')) current.push(p)
  }
  // A changed single instance of a repeating event (RECURRENCE-ID) replaces that date of the series.
  const moved = new Map<string, Set<string>>()
  for (const b of blocks) { const uidValue = b.find(p => p.name === 'UID')?.value, id = moment(b.find(p => p.name === 'RECURRENCE-ID')); if (uidValue && id) { const set = moved.get(uidValue) ?? new Set(); set.add(id.date); moved.set(uidValue, set) } }
  const events: IcsOneTime[] = [], weekly: IcsWeekly[] = []
  let skipped = 0
  for (const b of blocks) {
    const get = (name: string) => b.find(p => p.name === name)
    if (get('STATUS')?.value.toUpperCase() === 'CANCELLED') continue
    const title = unescape(get('SUMMARY')?.value ?? '').replace(/\s+/g, ' ').slice(0, 200) || 'Untitled event'
    const location = unescape(get('LOCATION')?.value ?? '').replace(/\s+/g, ' ').slice(0, 160) || undefined
    const start = moment(get('DTSTART'))
    if (!start) { skipped++; continue }
    const endMoment = moment(get('DTEND'))
    let endTime = start.time ? (endMoment?.time && endMoment.date === start.date ? endMoment.time : clockAfter(start.time, duration(get('DURATION')?.value) || 60)) : undefined
    if (endTime && start.time && endTime <= start.time) endTime = undefined
    const link = get('URL')?.value ?? ''
    // Canvas titles end with the course in brackets: "Essay 1 [ENGL 1010 Fall 2026]".
    const bracket = title.match(/^(.*\S)\s*\[([^\]]{2,120})\]$/)
    const course = bracket ? bracket[2].trim() : undefined
    const target = targetFor(bracket ? bracket[1] : title, link)
    const item = { title: bracket && target !== 'event' ? bracket[1] : title, as: target, course }
    const r = get('RECURRENCE-ID') ? null : rule(get('RRULE')?.value)
    const uidValue = get('UID')?.value ?? uid('ics')
    const exdates = new Set([...b.filter(p => p.name === 'EXDATE').flatMap(p => p.value.split(',').map(v => moment({ ...p, value: v })?.date).filter((v): v is string => !!v)), ...(moved.get(uidValue) ?? [])])
    if (!r) {
      if (start.date < today || start.date > windowEnd) continue
      events.push({ key: uidValue + '@' + start.date, include: true, ...item, date: start.date, time: start.time, endTime, location, uid: get('RECURRENCE-ID') ? undefined : uidValue })
      continue
    }
    const dates = occurrences(start.date, r, windowEnd).filter(d => !exdates.has(d))
    if (!dates.some(d => d >= today)) continue
    if (r.freq === 'WEEKLY' && r.interval === 1 && start.time && endTime) {
      const until = r.until ?? (r.count ? dates.at(-1)! : windowEnd)
      const from = start.date < today ? today : start.date
      weekly.push({ key: uidValue, include: true, title, days: (r.byDay.length ? r.byDay : [weekday(start.date)]).sort(), start: start.time, end: endTime, from, until: until < from ? from : until, location, skipped: [...exdates].filter(d => d >= from).sort() })
      continue
    }
    for (const date of dates) if (date >= today) events.push({ key: uidValue + '@' + date, include: true, ...item, date, time: start.time, endTime, location, uid: uidValue, recurring: true })
  }
  events.sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')))
  if (events.length > MAX_EVENTS) { skipped += events.length - MAX_EVENTS; events.length = MAX_EVENTS }
  return { calendarName, events, weekly, skipped }
}

/** Assignment and quiz links from Canvas (/assignments/, /quizzes/) and Schoology (/assignment/), or a
 * title that says so, decide whether an item is homework, a test, or just an event. */
function targetFor(title: string, link: string): IcsTarget {
  if (/\/(quizzes|assessment)\b/i.test(link)) return 'exam'
  if (/\/(assignments?|discussion_topics)\b/i.test(link)) return /\b(exam|midterm|final|quiz|test)\b/i.test(title) ? 'exam' : 'assignment'
  const kind = guessKind(title)
  return kind === 'assignment' ? 'assignment' : kind === 'exam' || kind === 'quiz' || kind === 'test' ? 'exam' : 'event'
}

/** A calendar event's kind from its title: tests and practice show up where students look for them. */
export function guessKind(title: string): CalendarEventKind {
  const t = title.toLowerCase()
  if (/\b(midterm|final exam|exam)\b/.test(t)) return 'exam'
  if (/\bquiz\b/.test(t)) return 'quiz'
  if (/\btest\b/.test(t)) return 'test'
  if (/\b(due|assignment|homework|essay|paper|project)\b/.test(t)) return 'assignment'
  if (/\b(game|match|practice|meet|tournament|scrimmage)\b/.test(t)) return 'sports'
  if (/\b(shift|work)\b/.test(t)) return 'work'
  if (/\b(doctor|dentist|appointment|appt|orthodontist|therapy)\b/.test(t)) return 'appointment'
  if (/\b(study|review|tutoring|office hours)\b/.test(t)) return 'study'
  return 'other'
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** Adds the chosen items to the active plan: one-time events as calendar events, weekly repeats as one
 * weekly schedule named after the calendar. Items already in the plan are skipped, so importing the
 * same calendar again only adds what's new. */
export function applyIcsImport(data: AppData, profileId: string, parsed: IcsImport, sourceName: string) {
  if (data.activeProfileId !== profileId) throw Error('Your plan changed. Reopen the calendar import.')
  const events = parsed.events.filter(e => e.include), weekly = parsed.weekly.filter(w => w.include)
  if (!events.length && !weekly.length) throw Error('Choose at least one event to add.')
  const next = structuredClone(data)
  let added = 0, skipped = 0
  const created: Record<string, LinkedItem> = {}
  // A course named in the calendar ("[BIOL 1100]") matches a subject by name, or becomes one.
  const subjectFor = (course?: string) => {
    if (!course) return ''
    const known = next.subjects.find(s => s.profileId === profileId && (same(s.name, course) || course.toLowerCase().includes(s.name.trim().toLowerCase())))
    if (known) return known.id
    const created = { id: uid('subject'), profileId, name: course.slice(0, 200), color: '#4169a8', resources: [] }
    next.subjects.push(created); return created.id
  }
  for (const e of events) {
    const at = e.time ? ' at ' + e.time + (e.endTime ? '–' + e.endTime : '') : ''
    if (e.as === 'assignment' || e.as === 'exam') {
      const list = e.as === 'assignment' ? next.tasks : next.exams
      const existing = list.find(x => x.profileId === profileId && x.due === e.date && same(x.title, e.title))
      if (existing) { created[e.key] = { c: e.as === 'assignment' ? 'tasks' : 'exams', id: existing.id }; skipped++; continue }
      const item = { id: uid(e.as === 'assignment' ? 'task' : 'exam'), profileId, subjectId: subjectFor(e.course), title: e.title, due: e.date, done: false, notes: [at ? 'Due' + at : '', e.location ? '📍 ' + e.location : ''].filter(Boolean).join('\n') }
      if (e.as === 'assignment') next.tasks.push(item); else next.exams.push(item)
      created[e.key] = { c: e.as === 'assignment' ? 'tasks' : 'exams', id: item.id }
      added++; continue
    }
    const existingEvent = next.calendarEvents.find(x => x.profileId === profileId && x.date === e.date && same(x.title, e.title) && (x.time ?? '') === (e.time ?? ''))
    if (existingEvent) { created[e.key] = { c: 'calendarEvents', id: existingEvent.id }; skipped++; continue }
    const eventId = uid('event')
    next.calendarEvents.push({ id: eventId, profileId, subjectId: e.course ? subjectFor(e.course) : undefined, date: e.date, title: e.title, kind: guessKind(e.title), notes: e.location ? '📍 ' + e.location : '', time: e.time, endTime: e.endTime })
    created[e.key] = { c: 'calendarEvents', id: eventId }
    added++
  }
  if (weekly.length) {
    const name = (sourceName.trim() || 'Imported calendar') + ' · weekly'
    let season = next.studySeasons.find(s => s.profileId === profileId && !s.school && s.name === name)
    if (!season) { season = { id: uid('season'), profileId, name, start: weekly.reduce((m, w) => w.from < m ? w.from : m, weekly[0].from), end: weekly.reduce((m, w) => w.until > m ? w.until : m, weekly[0].until), active: true, week: blankWeek() }; next.studySeasons.push(season) }
    for (const w of weekly) {
      season.start = w.from < season.start ? w.from : season.start
      season.end = w.until > season.end ? w.until : season.end
      let newDays = 0
      for (const d of w.days) {
        const day = dayNames[d], blocks = season.week[day] ?? (season.week[day] = [])
        if (blocks.some(b => same(b.label, w.title) && b.start === w.start && b.end === w.end && (b.dateStart ?? season!.start) <= w.until && (b.dateEnd ?? season!.end) >= w.from)) continue
        const block: ScheduleBlock = { id: uid('block'), label: w.title, start: w.start, end: w.end, kind: 'routine', dateStart: w.from, dateEnd: w.until, location: w.location, skippedDates: w.skipped.filter(x => weekday(x) === d), occurrenceNotes: {} }
        blocks.push(block); newDays++
      }
      // Counted per repeat, like the list the person ticked, not per weekday.
      if (newDays) added++; else skipped++
    }
  }
  return { data: normalizeData(next), added, skipped, created }
}

/** Which plan item a calendar item became, so a linked calendar can update it later. */
export type LinkedItem = { c: 'tasks' | 'exams' | 'calendarEvents'; id: string }

/** Keeping a linked calendar (Canvas, Google, iCloud…) up to date: new items are added; an item KONO
 * already made from it moves when its date or time changed there (unless it's done); an item the
 * person deleted in KONO, or chose not to add, is not brought back. `seen` maps each calendar item
 * this device has already handled to the plan item it became (null: known, but not in the plan). */
export type LinkedSeen = Record<string, LinkedItem | null>

/** One-time items are followed by their calendar ID, so a changed date is a move; each date of a
 * repeat, a moved single date, and each weekly repeat by their own key. */
export const seenKey = (e: IcsOneTime) => e.uid && !e.recurring ? e.uid : e.key
const weeklyKey = (w: IcsWeekly) => 'weekly:' + w.key

/** What `seen` starts as when a calendar is linked right after importing it: everything that was in
 * the list counts as handled, including anything left unticked. */
export function linkSeen(parsed: IcsImport, created: Record<string, LinkedItem>): LinkedSeen {
  const seen: LinkedSeen = {}
  for (const e of parsed.events) seen[seenKey(e)] = created[e.key] ?? null
  for (const w of parsed.weekly) seen[weeklyKey(w)] = null
  return seen
}

export function syncIcs(data: AppData, profileId: string, parsed: IcsImport, sourceName: string, seen: LinkedSeen) {
  const next = structuredClone(data)
  let updated = 0
  const fresh: IcsOneTime[] = []
  for (const e of parsed.events) {
    const k = seenKey(e)
    if (!(k in seen)) { fresh.push({ ...e, include: true }); continue }
    const ref = seen[k]
    if (!ref) continue
    if (ref.c === 'calendarEvents') {
      const item = next.calendarEvents.find(x => x.id === ref.id && x.profileId === profileId)
      if (item && !item.done && (item.date !== e.date || (item.time ?? '') !== (e.time ?? ''))) { item.date = e.date; item.time = e.time; item.endTime = e.endTime; updated++ }
    } else {
      const item = (ref.c === 'tasks' ? next.tasks : next.exams).find(x => x.id === ref.id && x.profileId === profileId)
      if (item && !item.done && item.due !== e.date) { item.due = e.date; updated++ }
    }
  }
  const weekly = parsed.weekly.filter(w => !(weeklyKey(w) in seen)).map(w => ({ ...w, include: true }))
  const nextSeen: LinkedSeen = { ...seen }
  for (const w of weekly) nextSeen[weeklyKey(w)] = null
  if (!fresh.length && !weekly.length) return { data: updated ? normalizeData(next) : data, added: 0, updated, seen: nextSeen }
  const result = applyIcsImport(next, profileId, { ...parsed, events: fresh, weekly }, sourceName)
  for (const e of fresh) nextSeen[seenKey(e)] = result.created[e.key] ?? null
  return { data: result.data, added: result.added, updated, seen: nextSeen }
}
