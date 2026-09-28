import type { SchoolCalendar } from './schoolCalendar'
import type { ScheduleBlock, StudySeason } from './model'
import { uid } from './model'

export type LunchWave = 1 | 2 | 3
/** A school's regular bell schedule: the times of each numbered period (or block); when lunch happens
 * inside one of them, which part of that period each lunch wave eats; and a time that always follows one
 * period with the same class (Duxbury High's ASP after Block 5). */
export type BellSchedule = { periods: [string, string][]; lunch?: { period: number; waves: Record<LunchWave, [string, string]> }; after?: { period: number; label: string; start: string; end: string }; classes?: number }

/** Duxbury High School: five blocks a day on the 7-day rotation. Lunch is inside Block 4, in three
 * waves, and a class's wave follows the department that teaches it (see duxburyLunchWave). ASP
 * (2:05–2:45) always follows Block 5, with the Block 5 class. A student has 7 classes that rotate through
 * the blocks in order: Day 1 is classes 1-2-3-4-5, Day 2 is 6-7-1-2-3, … Day 7 is 3-4-5-6-7. */
export const duxburyHighBells: BellSchedule = {
  periods: [['08:20', '09:19'], ['09:23', '10:22'], ['10:26', '11:25'], ['11:29', '12:58'], ['13:02', '14:05']],
  lunch: { period: 4, waves: { 1: ['11:29', '11:53'], 2: ['11:54', '12:18'], 3: ['12:34', '12:58'] } },
  after: { period: 5, label: 'ASP', start: '14:05', end: '14:45' },
  classes: 7,
}

export const bellScheduleFor = (school?: SchoolCalendar): BellSchedule | undefined =>
  school?.pattern === 'rotation' && school.name === 'Duxbury High School' ? duxburyHighBells : undefined

/** "Period 4" or "Block 4" → 4. */
export const periodNumber = (slot?: string) => { const m = slot?.match(/^(?:Period|Block) (\d{1,2})$/); return m ? Number(m[1]) : 0 }
export const periodTimes = (bells: BellSchedule, slot?: string) => bells.periods[periodNumber(slot) - 1]

// Duxbury High lunch waves by department: 1 · science, math, applied technology; 2 · social studies /
// history, world languages; 3 · English, the arts, PE / health, other electives and study halls.
const wave1 = /\b(science|biology|bio|chemistry|chem|physics|anatomy|physiology|astronomy|forensics?|environmental|earth|marine|geology|ecology|math|mathematics|algebra|geometry|calculus|calc|pre-?calculus|trigonometry|trig|statistics|stats|computer|programming|coding|engineering|robotics|technology|tech|cad|woodworking|manufacturing|electronics|business|accounting|finance|culinary|applied|practical)\b/i
const wave2 = /\b(history|historical|social studies|civics|government|gov|economics|econ|psychology|psych|sociology|geography|law|world issues|holocaust|humanities|spanish|french|latin|german|italian|chinese|mandarin|japanese|portuguese|arabic|asl|sign language|language)\b/i
const wave3 = /\b(english|literature|lit|writing|composition|journalism|poetry|creative|art|arts|drawing|painting|ceramics|sculpture|photography|design|music|band|chorus|choir|orchestra|theater|theatre|drama|dance|physical education|pe|health|wellness|fitness|study hall)\b/i
/** A class's lunch wave from its name, and whether the name actually said which department it's in. */
export function duxburyLunchWave(className: string): { wave: LunchWave; sure: boolean } {
  const name = className.replace(/[·_]/g, ' ')
  // "Music Technology" and "Art History" are the arts; "Computer Science" is still wave 1.
  if (/\b(culinary|practical|applied|industrial)\s+arts?\b/i.test(name)) return { wave: 1, sure: true }
  if (/\b(music|art|arts|theater|theatre|dance)\b/i.test(name) && !/\bmartial\b/i.test(name)) return { wave: 3, sure: true }
  if (wave1.test(name)) return { wave: 1, sure: true }
  if (wave2.test(name)) return { wave: 2, sure: true }
  return { wave: 3, sure: wave3.test(name) }
}
export const lunchWaveFor = (school: SchoolCalendar | undefined, className: string) => bellScheduleFor(school) ? duxburyLunchWave(className) : undefined

/** The lunch shown on a school day: a "Lunch N" break inside the lunch period, for the same dates as the class it's in. */
export function lunchBlock(bells: BellSchedule, wave: LunchWave, dateStart?: string, dateEnd?: string): ScheduleBlock {
  const [start, end] = bells.lunch!.waves[wave]
  return { id: uid('lunch'), label: 'Lunch ' + wave, slot: 'Lunch', start, end, kind: 'break', dateStart, dateEnd, occurrenceNotes: {}, completedDates: [], skippedDates: [] }
}

/** The time that follows a period with the same class, e.g. "ASP · Chemistry I" in the Chemistry room. */
export function afterBlock(bells: BellSchedule, classLabel: string, location?: string, dateStart?: string, dateEnd?: string): ScheduleBlock {
  const a = bells.after!
  return { id: uid('after'), label: a.label + ' · ' + classLabel.trim(), slot: a.label, start: a.start, end: a.end, kind: 'routine', location: location?.trim() || undefined, dateStart, dateEnd, occurrenceNotes: {}, completedDates: [], skippedDates: [] }
}

const dayBefore = (iso: string) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10) }

/** A class that changes partway through the year (a semester class): on every rotation day it meets,
 * the old class ends the school day before `from` and the new one takes its period from `from`. Notes
 * and completed days stay with the old class. At a school with lunch waves, the lunch on those days
 * switches to the new class's wave too, and a period that's always followed by the same class (ASP)
 * follows the new class. */
export function switchClass(season: StudySeason, oldLabel: string, next: { label: string; location?: string; from: string; lunchWave?: LunchWave }): StudySeason {
  const label = next.label.trim(), key = oldLabel.trim().toLowerCase()
  if (!label) throw Error('Enter the new class’s name.')
  if (!next.from || next.from <= season.start || next.from > (season.school?.lastClassDate || season.end)) throw Error('Choose a date during the school year for the new class to start.')
  const bells = bellScheduleFor(season.school), result = structuredClone(season)
  const range = (b: ScheduleBlock) => b.fullYear ? [season.start, season.end] : [b.dateStart ?? season.start, b.dateEnd ?? season.end]
  let changed = 0
  for (const [day, blocks] of Object.entries(result.week)) {
    const out: ScheduleBlock[] = []
    let lunchUntil = '', afterUntil = ''
    for (const b of blocks) {
      const [start, end] = range(b)
      if (b.label.trim().toLowerCase() !== key || b.kind !== 'study' || next.from <= start || next.from > end) { out.push(b); continue }
      changed++
      out.push({ ...b, fullYear: false, dateStart: start, dateEnd: dayBefore(next.from) })
      out.push({ ...b, id: uid('block'), label, location: next.location?.trim() || undefined, subjectId: undefined, fullYear: false, dateStart: next.from, dateEnd: end, occurrenceNotes: {}, completedDates: [], skippedDates: [] })
      if (bells?.lunch && next.lunchWave && periodNumber(b.slot) === bells.lunch.period) lunchUntil = end
      if (bells?.after && periodNumber(b.slot) === bells.after.period) afterUntil = end
    }
    const endAt = (slot: string, kind: ScheduleBlock['kind']) => { for (let i = 0; i < out.length; i++) { const l = out[i], [start, end] = range(l); if (l.slot === slot && l.kind === kind && start < next.from && end >= next.from) out[i] = { ...l, fullYear: false, dateStart: start, dateEnd: dayBefore(next.from) } } }
    if (afterUntil && bells?.after) { endAt(bells.after.label, 'routine'); out.push(afterBlock(bells, label, next.location, next.from, afterUntil)) }
    // The lunch inside the changed class's period follows the new class.
    if (lunchUntil && bells && next.lunchWave) {
      endAt('Lunch', 'break')
      out.push(lunchBlock(bells, next.lunchWave, next.from, lunchUntil))
    }
    result.week[day] = out.sort((a, b) => a.start.localeCompare(b.start))
  }
  if (!changed) throw Error('That class doesn’t meet after this date, so there’s nothing to change.')
  return result
}

/** Fixes a class's name everywhere it meets (a typo, or a class renamed by the school). */
export function renameClass(season: StudySeason, oldLabel: string, label: string): StudySeason {
  const name = label.trim(), key = oldLabel.trim().toLowerCase(), after = bellScheduleFor(season.school)?.after
  if (!name) throw Error('Enter the class’s new name.')
  const renamed = (b: ScheduleBlock) => b.label.trim().toLowerCase() === key ? { ...b, label: name } : after && b.slot === after.label && b.label.trim().toLowerCase() === (after.label + ' · ' + key).toLowerCase() ? { ...b, label: after.label + ' · ' + name } : b
  return { ...season, week: Object.fromEntries(Object.entries(season.week).map(([day, blocks]) => [day, blocks.map(renamed)])) }
}

type PeriodRow = { include: boolean; day: string; label: string; slot: string; start: string; end: string; dateStart: string; dateEnd: string; kind: string; location?: string; lunchWave?: LunchWave; lunchSure?: boolean }

/** Imported classes listed by period: each gets its period's bell times (unless it already has times),
 * and a class in the lunch period gets a lunch wave guessed from its department. */
export function applyBells<R extends PeriodRow>(rows: R[], bells?: BellSchedule): R[] {
  if (!bells) return rows
  return rows.map(r => {
    const times = periodTimes(bells, r.slot)
    if (!times) return r
    const timed = r.start && r.end ? r : { ...r, start: times[0], end: times[1] }
    if (bells.lunch && periodNumber(r.slot) === bells.lunch.period && r.kind === 'study' && !r.lunchWave) { const guess = duxburyLunchWave(r.label); return { ...timed, lunchWave: guess.wave, lunchSure: guess.sure } }
    return timed
  })
}

/** What the bell schedule adds around the imported classes: the lunch break for each lunch-period
 * class, and the time that follows a period with the same class (ASP), one per day and date range. */
export function addBellBlocks<R extends PeriodRow>(season: StudySeason, rows: R[]): StudySeason {
  const bells = bellScheduleFor(season.school)
  if (!bells) return season
  const next = structuredClone(season)
  const add = (day: string, block: ScheduleBlock) => {
    if (next.week[day].some(b => b.slot === block.slot && b.start === block.start && b.dateStart === block.dateStart && b.dateEnd === block.dateEnd)) return
    next.week[day] = [...next.week[day], block].sort((a, b) => a.start.localeCompare(b.start))
  }
  for (const r of rows) {
    if (!r.include || r.kind !== 'study' || !next.week[r.day]) continue
    if (bells.lunch && r.lunchWave && periodNumber(r.slot) === bells.lunch.period) add(r.day, lunchBlock(bells, r.lunchWave, r.dateStart, r.dateEnd))
    if (bells.after && periodNumber(r.slot) === bells.after.period) add(r.day, afterBlock(bells, r.label, r.location, r.dateStart, r.dateEnd))
  }
  return next
}

/** Days that don't add up: two classes in one period, or (for a school with a known bell schedule) a
 * period with nothing in it. Free periods count, so a study hall or free block fills its period. */
export function periodProblems(rows: PeriodRow[], cycle: string[], bells?: BellSchedule): string[] {
  const problems: string[] = []
  for (const day of cycle) {
    const chosen = rows.filter(r => r.include && r.day === day && periodNumber(r.slot))
    const count = new Map<number, number>()
    for (const r of chosen) count.set(periodNumber(r.slot), (count.get(periodNumber(r.slot)) ?? 0) + 1)
    const doubled = [...count].filter(([, n]) => n > 1).map(([p]) => 'Period ' + p)
    if (doubled.length) problems.push(day + ' has two classes in ' + doubled.join(' and ') + '. Untick the one that’s wrong.')
    if (bells && chosen.length) {
      const missing = bells.periods.map((_, i) => i + 1).filter(p => !count.has(p))
      if (missing.length) problems.push(day + ' has nothing in ' + missing.map(p => 'Period ' + p).join(', ') + '. Add it below (a free block counts) if your schedule has one.')
    }
  }
  return problems
}

/** At a school where a fixed set of classes rotates through the periods in order, which class (0-based)
 * meets on the day at `dayIndex` (0-based) in `period` (1-based). */
export const classIndexFor = (bells: BellSchedule, dayIndex: number, period: number) => (dayIndex * bells.periods.length + period - 1) % (bells.classes ?? bells.periods.length)
/** Every day's classes in period order, as class numbers from 1: Day 1 → [1,2,3,4,5], Day 2 → [6,7,1,2,3]… */
export const rotationGrid = (bells: BellSchedule, days: number) => Array.from({ length: days }, (_, d) => bells.periods.map((_, p) => classIndexFor(bells, d, p + 1) + 1))

export type RotationClass = { label: string; location: string; lunchWave: LunchWave }
const dayIndexOf = (day: string, cycle: string[]) => cycle.indexOf(day)

/** The classes read from a schedule laid out by day and period, put back in class order. Each class is
 * seen on several days; the name seen most often wins, and any disagreement is reported. */
export function classesFromRows(rows: { include?: boolean; day: string; label: string; slot: string; location?: string; kind?: string }[], cycle: string[], bells: BellSchedule): { classes: { label: string; location: string }[]; conflicts: string[] } {
  const count = bells.classes ?? bells.periods.length
  const seen = Array.from({ length: count }, () => new Map<string, { n: number; location: string }>())
  for (const r of rows) {
    const d = dayIndexOf(r.day, cycle), p = periodNumber(r.slot)
    if (r.include === false || d < 0 || !p || p > bells.periods.length || !r.label.trim()) continue
    const names = seen[classIndexFor(bells, d, p)], key = r.label.trim(), prev = names.get(key)
    names.set(key, { n: (prev?.n ?? 0) + 1, location: prev?.location || r.location || '' })
  }
  const conflicts: string[] = []
  const classes = seen.map((names, i) => {
    const ranked = [...names].sort((a, b) => b[1].n - a[1].n)
    if (ranked.length > 1) conflicts.push('Class ' + (i + 1) + ' was read as ' + ranked.map(([name]) => name).join(' and ') + '. Check which it is.')
    return { label: ranked[0]?.[0] ?? '', location: ranked[0]?.[1].location ?? '' }
  })
  return { classes, conflicts }
}

/** The classes already in a saved rotation, in class order (the first-semester class of each period). */
export function classesFromWeek(season: StudySeason, bells: BellSchedule): { label: string; location: string; lunchWave?: LunchWave }[] {
  const cycle = season.school?.cycle ?? [], count = bells.classes ?? bells.periods.length
  const found: { label: string; location: string; lunchWave?: LunchWave; from: string }[] = Array.from({ length: count }, () => ({ label: '', location: '', from: '9999' }))
  cycle.forEach((day, d) => {
    for (const b of season.week[day] ?? []) {
      const p = periodNumber(b.slot)
      if (!p || (b.kind !== 'study' && b.kind !== 'break')) continue
      const i = classIndexFor(bells, d, p), from = b.fullYear ? season.start : b.dateStart ?? season.start
      if (from > found[i].from) continue
      // The class's lunch is on whichever day it's in the lunch period.
      const lunch = bells.lunch && p === bells.lunch.period ? (season.week[day] ?? []).find(x => x.slot === 'Lunch' && (x.fullYear ? season.start : x.dateStart ?? season.start) === from)?.label.match(/\d/)?.[0] : undefined
      const lunchWave = lunch ? Number(lunch) as LunchWave : undefined
      if (from === found[i].from) { if (lunchWave) found[i].lunchWave = lunchWave; continue }
      found[i] = { label: b.label, location: b.location ?? '', lunchWave, from }
    }
  })
  return found.map(({ label, location, lunchWave }) => ({ label, location, lunchWave }))
}

/** All rotation days built from the student's classes: each class in its period with the bell times,
 * lunch inside the lunch period for whichever class is there that day, and ASP after the last period.
 * A class named "Free" (or "Open", "Study Hall"…) is a free block rather than a subject. */
export function buildRotationWeek(season: StudySeason, classes: RotationClass[]): StudySeason {
  const bells = bellScheduleFor(season.school), count = bells?.classes
  if (!bells || !count || !season.school) throw Error('This school doesn’t use a class rotation.')
  if (classes.length !== count) throw Error('Enter all ' + count + ' classes.')
  const missing = classes.map((c, i) => c.label.trim() ? 0 : i + 1).filter(Boolean)
  if (missing.length) throw Error('Enter a name for class ' + missing.join(', ') + '. Use “Free” for a free block.')
  const dateStart = season.start, dateEnd = season.school.lastClassDate || season.end
  const week = Object.fromEntries(season.school.cycle.map((day, d) => {
    const blocks: ScheduleBlock[] = []
    bells.periods.forEach(([start, end], p) => {
      const c = classes[classIndexFor(bells, d, p + 1)], label = c.label.trim(), free = /^(free|open|free block|study hall|study)$/i.test(label)
      blocks.push({ id: uid('block'), label, slot: 'Period ' + (p + 1), start, end, kind: free ? 'break' : 'study', location: c.location.trim() || undefined, dateStart, dateEnd, occurrenceNotes: {}, completedDates: [], skippedDates: [] })
      if (bells.lunch && p + 1 === bells.lunch.period) blocks.push(lunchBlock(bells, c.lunchWave, dateStart, dateEnd))
      if (bells.after && p + 1 === bells.after.period) blocks.push(afterBlock(bells, label, c.location, dateStart, dateEnd))
    })
    return [day, blocks.sort((a, b) => a.start.localeCompare(b.start))]
  }))
  return { ...season, week }
}
